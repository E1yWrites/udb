<script lang="ts" module>
  // Last value the device confirmed after a write, per device. Kept across
  // reconnects (module scope) so a re-read can show whether it persisted.
  const confirmedWrites = new Map<string, Record<string, { value: number; reconnects: number }>>();
  // Byte log and write history per device for this page session, so the
  // evidence report covers writes made before an unplug.
  const history = new Map<string, { log: LogEntry[]; writes: WriteRecord[] }>();
  type WriteRecord = { setting: string; requested: number; previous: number; result: unknown; at: string; reconnects: number };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import ProfileBar from './ProfileBar.svelte';
  import { logFor } from '../lib/history.svelte.ts';
  import SettingLine from './SettingLine.svelte';
  import RangeField from './controls/RangeField.svelte';
  import Segments from './controls/Segments.svelte';
  import { rowWriter } from '../lib/commit.ts';
  import { CompxSession } from '../adapters/compx-session.ts';
  import { POLLING_RATES, type Info } from '../adapters/compx.ts';
  import { DPI_SENSORS, type DpiSensor } from '../adapters/compx-dpi.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { resolveByProtocolIdentity } from '../lib/match.ts';
  import { hex, registry, type DeviceEntry } from '../lib/registry.ts';
  import { open, type LogEntry } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  type Reading = { value: number | null; at: string };
  type Row = 'pollingRate' | 'activeStage' | 'debounce' | `dpi${number}`;
  const isDpi = (row: Row): row is `dpi${number}` => row.startsWith('dpi');
  const stageOf = (row: `dpi${number}`) => Number(row.slice(3));
  const LABEL: Record<string, string> = { pollingRate: 'Polling rate', activeStage: 'Active DPI stage', debounce: 'Debounce' };
  const label = (row: Row) => (isDpi(row) ? `DPI, stage ${stageOf(row) + 1}` : LABEL[row]!);
  type Check = { setting: Row; expected: number; observed: number | null; at: string };

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let info = $state<Info | null>(null);
  let battery = $state<{ level: number; charging: boolean } | null>(null);
  let stageCount = $state<number | null>(null);
  let readings = $state<Partial<Record<Row, Reading>>>({});
  let requested = $state<Partial<Record<Row, number>>>({});
  let results = $state<Partial<Record<Row, WriteResult<number> & { at: string }>>>({});
  let busy = $state<Row | null>(null);
  let allowUnverified = $state(false);
  let checks = $state<Check[]>([]);
  let copied = $state(false);
  let session: CompxSession | null = null;
  /** The registry model the device's own CID/MID resolved to (may differ from a shared receiver's first match). */
  let model = $state<DeviceEntry | null>(null);
  let sensor = $state<DpiSensor | null>(null);
  /** Raw X/Y per stage, so asymmetric stages can be shown even though controls set X = Y. */
  let dpiRaw = $state<Record<number, { x: number; y: number } | null>>({});
  const dpiRows = $derived(sensor && stageCount ? Array.from({ length: stageCount }, (_, i) => `dpi${i}` as Row) : []);
  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));

  const now = () => new Date().toISOString();
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const feature = (e: DeviceEntry, id: string) => e.features.find((f) => f.id === id);
  const rates = $derived(POLLING_RATES.filter((r) => !info || r <= info.maxRate));
  const maxDebounce = $derived(Number(feature(model ?? entry, 'debounce-ms')?.constraints?.max ?? 15));

  function sensorFor(e: DeviceEntry): DpiSensor | null {
    const f = feature(e, 'dpi.stages');
    const name = f && f.status !== 'unsupported' ? f.constraints?.sensor : null;
    return typeof name === 'string' ? (DPI_SENSORS[name] ?? null) : null;
  }

  function options(row: Row): { value: number; label: string }[] {
    if (isDpi(row)) return [];
    if (row === 'pollingRate') return rates.map((hz) => ({ value: hz, label: `${hz.toLocaleString()} Hz` }));
    if (row === 'activeStage') return Array.from({ length: stageCount ?? 0 }, (_, i) => ({ value: i, label: `Stage ${i + 1}` }));
    return Array.from({ length: maxDebounce + 1 }, (_, ms) => ({ value: ms, label: `${ms} ms` }));
  }

  function setting(row: Row): Setting<number> {
    if (isDpi(row)) {
      // Controls set X = Y; a read only counts as that value when both axes match it.
      const stage = session!.dpiStage(stageOf(row), sensor!);
      return {
        validate: (v) => stage.validate({ x: v, y: v }),
        write: (v) => stage.write({ x: v, y: v }),
        read: async () => {
          const xy = await stage.read();
          dpiRaw[stageOf(row)] = xy;
          return xy && xy.x === xy.y ? xy.x : null;
        },
      };
    }
    if (row === 'pollingRate') return session!.pollingRate(info!);
    if (row === 'activeStage') return session!.activeStage(stageCount!);
    return session!.debounce(maxDebounce);
  }

  // Dev preview only (`/?preview&autoread`); tree-shaken from production builds.
  if (import.meta.env.DEV && location.search.includes('autoread')) queueMicrotask(() => void connect());

  async function connect() {
    phase = 'reading';
    error = '';
    const use = entry.collections.use.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
    const hid = device.interfaces.find((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)));
    if (!hid) {
      phase = 'error';
      error = 'This device has no command interface UDB can use.';
      return;
    }
    const opened = await open(hid);
    if (!opened.ok) {
      phase = 'error';
      const apps = entry.conflictingSoftware?.join(' or ') ?? 'the manufacturer’s software';
      error = `Could not open the device (${opened.error}). Close ${apps} and try again.`;
      return;
    }
    const deny = entry.collections.deny.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
    session = new CompxSession(hid, deny, past.log);
    try {
      // Identify the way this model's vendor software does, then resolve the exact model.
      if (entry.protocol.params?.identify === 'cidmid') {
        const id = await session.identifyCidMid();
        const ratesFor = feature(entry, 'polling-rate')?.constraints?.values;
        const maxRate = Array.isArray(ratesFor) ? Math.max(...(ratesFor as number[])) : 1000;
        info = { ...id, type: -1, wired: false, maxRate };
      } else {
        info = await session.identify();
      }
      model = resolveByProtocolIdentity(device, registry, info)?.entry ?? null;
      sensor = sensorFor(model ?? entry);
      // A second session whose allowlist knows this model's DPI encoding; same byte log.
      session = new CompxSession(hid, deny, past.log, sensor);
      stageCount = await session.readPair(0x02);
      const rows: Row[] = ['pollingRate', 'activeStage', 'debounce', ...(sensor && stageCount ? Array.from({ length: stageCount }, (_, i) => `dpi${i}` as Row) : [])];
      for (const row of rows) {
        if (row === 'activeStage' && stageCount === null) continue;
        const value = await setting(row).read();
        readings[row] = { value, at: now() };
        if (value !== null) requested[row] = value;
      }
      battery = info.type !== -1 && info.wired ? null : await session.battery().catch(() => null);
      // Only writes confirmed before the latest real disconnect/reconnect count as a persistence check.
      const remembered = Object.entries(confirmedWrites.get(device.key) ?? {}).filter(([, w]) => device.reconnects > w.reconnects);
      checks = remembered.map(([s, w]) => ({
        setting: s as Row,
        expected: w.value,
        observed: readings[s as Row]?.value ?? null,
        at: now(),
      }));
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = message(e);
    }
  }

  /** The slider step for this sensor; the device's read-back has the final say. */
  const dpiStep = $derived(sensor?.family === 'stepped' ? (sensor.xStep ?? 100) : sensor?.family === 'ultra' ? 10 : 50);

  // All writes go through one queue: one at a time, and a control ends on its newest value (src/lib/commit.ts).
  const writer = rowWriter<Row>(applyNow);
  const apply = writer.apply;

  async function applyNow(row: Row) {
    const previous = readings[row]?.value;
    const value = requested[row];
    if (previous == null || value == null || value === previous) return;
    busy = row;
    const result = await applySetting(setting(row), value, previous);
    const at = now();
    results[row] = { ...result, at };
    past.writes.push({ setting: row, requested: value, previous, result, at, reconnects: device.reconnects });
    if (result.kind === 'confirmed') {
      readings[row] = { value: result.value, at };
      confirmedWrites.set(device.key, {
        ...(confirmedWrites.get(device.key) ?? {}),
        [row]: { value: result.value, reconnects: device.reconnects },
      });
    } else if (result.kind === 'mismatch') {
      readings[row] = { value: result.restored, at };
    } else if (result.kind === 'failed') {
      readings[row] = { value: result.actual, at };
    }
    // The control shows what the device returned, unless a newer value is already queued.
    if (!writer.queued(row)) requested[row] = readings[row]?.value ?? requested[row];
    busy = null;
  }

  function show(row: Row, v: number | null | undefined): string {
    if (isDpi(row)) {
      const raw = dpiRaw[stageOf(row)];
      if (v == null) return raw ? `${raw.x.toLocaleString()} × ${raw.y.toLocaleString()}` : 'Unreadable';
      return `${v.toLocaleString()} DPI`;
    }
    if (v == null) return 'Unreadable';
    if (row === 'pollingRate') return `${v.toLocaleString()} Hz`;
    if (row === 'activeStage') return `Stage ${v + 1} of ${stageCount}`;
    return `${v} ms`;
  }

  /** Profile apply: the saved value goes through this panel's own write procedure, read back. */
  async function applyProfileRow(row: string, value: number) {
    results[row as Row] = undefined;
    requested[row as Row] = value;
    await apply(row as Row);
    return results[row as Row];
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: now().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      identity: info,
      resolvedModel: model?.id ?? null,
      dpiSensor: sensor,
      stageCount,
      dpiRaw: $state.snapshot(dpiRaw),
      battery,
      readings: $state.snapshot(readings),
      reconnects: device.reconnects,
      persistenceChecks: $state.snapshot(checks),
      writes: past.writes,
      log: past.log,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }
</script>

<section class="live" aria-labelledby="live-title">
  <h2 id="live-title" class="section">Live from the device</h2>

  {#if phase === 'idle' || phase === 'error'}
    <p class="lede">
      UDB asks the mouse who it is and reads its current settings. Reading changes nothing. The only commands UDB can send
      are identify, link check, battery, settings read, and writes to polling rate, active DPI stage, DPI stage values and
      debounce.
    </p>
    {#if phase === 'error'}
      <p class="problem" role="alert"><Icon name="alert" />{error}</p>
    {/if}
    <button class="btn primary" onclick={connect}>Read from mouse</button>
  {:else if phase === 'reading'}
    <p class="lede" aria-live="polite">Reading from the device…</p>
  {:else if info}
    <dl class="facts">
      <div>
        <dt>Identity</dt>
        <dd>
          <span class="data">CID {info.cid} · MID {info.mid}</span>
          {#if model}
            <span class="status confirmed"><Icon name="check" size={14} />{model.vendor} {model.model}</span>
          {:else}
            <span class="status signal"><Icon name="unverified" size={14} />This CID/MID is not in the registry yet</span>
          {/if}
        </dd>
      </div>
      <div>
        <dt>Link</dt>
        <dd>
          {#if info.type === -1}Not reported by this model{:else}{info.wired ? 'Cable' : 'Wireless'}, up to {info.maxRate.toLocaleString()} Hz{/if}
        </dd>
      </div>
      {#if battery}
        <div>
          <dt>Battery</dt>
          <dd><span class="num">{battery.level}%</span>{battery.charging ? ', charging' : ''}</dd>
        </div>
      {/if}
    </dl>

    {#if checks.length}
      <div class="checks" role="status">
        <h3>After the device reconnected</h3>
        <ul>
          {#each checks as c (c.setting)}
            <li class={c.observed === c.expected ? 'confirmed' : 'signal'}>
              <Icon name={c.observed === c.expected ? 'check' : 'alert'} size={14} />
              {label(c.setting)}:
              {c.observed === c.expected ? 'kept' : 'changed to'} {show(c.setting, c.observed)}
              {#if c.observed !== c.expected}(last confirmed {show(c.setting, c.expected)}){/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <label class="gate">
      <input type="checkbox" bind:checked={allowUnverified} />
      <span>
        Allow writes to unverified settings. UDB reads every write back and restores the previous value if the device
        disagrees.
      </span>
    </label>

    <div class="lines">
      {#each ['pollingRate', 'activeStage', 'debounce', ...dpiRows] as Row[] as row (row)}
        {#if row !== 'activeStage' || (stageCount ?? 0) > 1}
          <SettingLine
            id="ctl-{row}"
            label={label(row)}
            value={readings[row]?.value}
            readAt={readings[row]?.at}
            busy={busy === row}
            result={results[row]}
            show={(v) => show(row, v)}
          >
            {#if isDpi(row) && sensor}
              <RangeField
                id="ctl-{row}"
                label={label(row)}
                min={sensor.minDpi}
                max={sensor.maxDpi}
                step={dpiStep}
                unit="DPI"
                curve
                bind:value={requested[row]}
                disabled={!allowUnverified}
                oncommit={() => writer.commit(row)}
              />
            {:else if row === 'pollingRate' || row === 'activeStage'}
              <Segments
                id="ctl-{row}"
                label={label(row)}
                options={row === 'activeStage'
                  ? options(row).map((o) => ({ ...o, label: readings[`dpi${o.value}`]?.value ? `${o.value + 1} · ${readings[`dpi${o.value}`]!.value!.toLocaleString()}` : `${o.value + 1}` }))
                  : options(row)}
                bind:value={requested[row]}
                disabled={!allowUnverified}
                oncommit={() => writer.commit(row)}
              />
            {:else}
              <select id="ctl-{row}" bind:value={requested[row]} disabled={!allowUnverified || busy !== null}>
                {#each options(row) as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
              </select>
              <button
                class="btn"
                onclick={() => apply(row)}
                disabled={!allowUnverified || busy !== null || requested[row] === readings[row]?.value}
              >
                {busy === row ? 'Writing…' : 'Apply'}
              </button>
            {/if}
          </SettingLine>
        {/if}
      {/each}
    </div>

    {#if stageCount === 1}
      <p class="note">This mouse has one DPI stage configured, so there is no stage to switch to.</p>
    {/if}

    <ProfileBar
      entryId={(model ?? entry).id}
      current={Object.fromEntries(Object.entries(readings).map(([r, x]) => [r, x?.value]))}
      label={(r) => label(r as Row)}
      show={(r, v) => show(r as Row, v)}
      canWrite={allowUnverified}
      busy={busy !== null}
      apply={applyProfileRow}
    />

    <footer class="actions">
      <button class="btn" onclick={connect}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>

