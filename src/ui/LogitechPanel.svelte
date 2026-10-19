<script lang="ts" module>
  import type { LogEntry } from '../lib/transport.ts';
  // Per device for this page session (kept across reconnects): byte log, writes,
  // and the last value each setting confirmed, for persistence checks.
  const history = new Map<string, { log: LogEntry[]; writes: unknown[] }>();
  const confirmedWrites = new Map<string, Record<string, { value: number; reconnects: number }>>();
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import ProfileBar from './ProfileBar.svelte';
  import { logFor } from '../lib/history.svelte.ts';
  import SettingLine from './SettingLine.svelte';
  import RangeField from './controls/RangeField.svelte';
  import Segments from './controls/Segments.svelte';
  import { rowWriter } from '../lib/commit.ts';
  import { HidppSession, type Identity } from '../adapters/logitech-hidpp-session.ts';
  import { DIRECT, type Battery } from '../adapters/logitech-hidpp.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { matchDevice } from '../lib/match.ts';
  import { hex, registry, type Collection, type DeviceEntry } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  type Row = 'dpi' | 'rate' | 'sidetone';
  const LABEL: Record<Row, string> = { dpi: 'DPI', rate: 'Report rate', sidetone: 'Sidetone' };

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let identity = $state<Identity | null>(null);
  let model = $state<DeviceEntry | null>(null);
  let battery = $state<Battery | null>(null);
  let mode = $state<'onboard' | 'host' | null>(null);
  let dpiOptions = $state<number[] | null>(null);
  let rateOptions = $state<number[] | null>(null);
  let sidetone = $state<Setting<number> | null>(null);
  let readings = $state<Partial<Record<Row, { value: number | null; at: string }>>>({});
  let requested = $state<Partial<Record<Row, number>>>({});
  let results = $state<Partial<Record<Row, WriteResult<number> & { at: string }>>>({});
  let busy = $state<Row | null>(null);
  let allowUnverified = $state(false);
  let checks = $state<{ row: Row; expected: number; observed: number | null }[]>([]);
  let copied = $state(false);
  let session: HidppSession | null = null;

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));
  const now = () => new Date().toISOString();
  const pairs = (list: Collection[]) => list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
  const pid = (n: number | null) => (n === null ? '–' : n.toString(16).toUpperCase().padStart(4, '0'));
  const rows = $derived((['dpi', 'rate', 'sidetone'] as Row[]).filter((r) => (r === 'sidetone' ? sidetone : (r === 'dpi' ? dpiOptions : rateOptions)?.length)));
  /** The common step of the advertised DPI values, for the number input. */
  const dpiStep = $derived(dpiOptions && dpiOptions.length > 1 ? Math.min(...dpiOptions.slice(1).map((v, i) => v - dpiOptions![i]!)) : 1);

  function setting(row: Row): Setting<number> {
    if (row === 'sidetone') return sidetone!;
    return row === 'dpi' ? session!.dpi(dpiOptions!) : session!.reportRate(rateOptions!, identity!.wired);
  }

  function show(row: Row, v: number | null | undefined): string {
    if (v == null) return 'Unreadable';
    if (row === 'sidetone') return `${v} of 100`;
    return row === 'dpi' ? `${v.toLocaleString()} DPI` : `${v.toLocaleString()} Hz`;
  }

  /** How the device is connected. Without transport PIDs (e.g. a headset on its own dongle), the registry's connection. */
  function link(id: Identity): string {
    const { usbPid, wirelessPid, blePid, bluetoothPid } = id.info;
    if (usbPid === null && wirelessPid === null && blePid === null && bluetoothPid === null) {
      const c = device.match?.identity.connection;
      return c === 'dongle' ? 'Wireless dongle' : c === 'bluetooth' ? 'Bluetooth' : c === 'wired' ? 'Cable' : 'Not reported';
    }
    return id.wired ? 'Cable' : id.deviceIndex === DIRECT ? 'Wireless' : `Receiver slot ${id.deviceIndex}`;
  }

  /** The registry model for the PID the device reports for its current link. */
  function resolve(id: Identity): DeviceEntry | null {
    const pids = id.wired ? [id.info.usbPid] : [id.info.wirelessPid, id.info.blePid, id.info.bluetoothPid];
    for (const p of pids) {
      const m = p === null ? null : matchDevice({ vendorId: device.vendorId, productId: p, productName: '' }, registry);
      if (m?.modelConfirmed) return m.entry;
    }
    return device.match?.modelConfirmed ? entry : null;
  }

  async function read() {
    phase = 'reading';
    error = '';
    const use = pairs(entry.collections.use);
    const hids = device.interfaces.filter((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)));
    if (!hids.length) {
      phase = 'error';
      error = 'No HID++ interface is granted. Use “Add device” and pick the device again; for a Bolt receiver, pick both entries.';
      return;
    }
    for (const hid of hids) {
      const opened = await open(hid);
      if (!opened.ok) {
        phase = 'error';
        error = `Could not open the device (${opened.error}). Close ${entry.conflictingSoftware?.join(' or ') ?? 'Logitech’s software'} and try again.`;
        return;
      }
    }
    session = new HidppSession(hids, device.productId, pairs(entry.collections.deny), past.log);
    try {
      await session.connect();
      identity = await session.identify();
      model = resolve(identity);
      battery = await session.battery();
      mode = await session.onboardMode();
      dpiOptions = await session.dpiOptions();
      rateOptions = await session.rateOptions(identity.wired);
      sidetone = await session.sidetone();
      readings = {};
      results = {};
      for (const row of rows) {
        const value = await setting(row).read();
        readings[row] = { value, at: now() };
        if (value !== null) requested[row] = value;
      }
      const remembered = Object.entries(confirmedWrites.get(device.key) ?? {}).filter(([, w]) => device.reconnects > w.reconnects);
      checks = remembered.map(([row, w]) => ({ row: row as Row, expected: w.value, observed: readings[row as Row]?.value ?? null }));
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

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
      confirmedWrites.set(device.key, { ...(confirmedWrites.get(device.key) ?? {}), [row]: { value: result.value, reconnects: device.reconnects } });
    } else if (result.kind === 'mismatch') {
      readings[row] = { value: result.restored, at };
    } else if (result.kind === 'failed') {
      readings[row] = { value: result.actual, at };
    }
    // The control shows what the device returned, unless a newer value is already queued.
    if (!writer.queued(row)) requested[row] = readings[row]?.value ?? requested[row];
    busy = null;
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
      identity: $state.snapshot(identity),
      resolvedModel: model?.id ?? null,
      battery: $state.snapshot(battery),
      onboardMode: mode,
      dpiOptions: $state.snapshot(dpiOptions),
      rateOptions: $state.snapshot(rateOptions),
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

<section class="live" aria-labelledby="hidpp-live">
  <h2 id="hidpp-live" class="section">Live from the device</h2>

  {#if phase !== 'ready'}
    <p class="lede">
      UDB finds which HID++ device answers on this connection, asks its name and features, then reads battery, DPI,
      report rate and sidetone, whichever the device has. Reading changes nothing. UDB never switches the onboard-profile mode, and never sends firmware,
      reset or pairing commands.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : `Read from ${entry.category}`}
    </button>
  {:else if identity}
    <dl class="facts">
      <div>
        <dt>Device</dt>
        <dd>
          <span>{identity.name ?? 'No name reported'}</span>
          {#if model}
            <span class="status confirmed"><Icon name="check" size={14} />{model.vendor} {model.model}</span>
          {:else}
            <span class="status signal"><Icon name="unverified" size={14} />Model not in the registry yet</span>
          {/if}
        </dd>
      </div>
      <div>
        <dt>Link</dt>
        <dd>
          {link(identity)}
          {#if identity.info.wirelessPid !== null}<span class="data">wireless PID {pid(identity.info.wirelessPid)}</span>{/if}
        </dd>
      </div>
      <div>
        <dt>HID++</dt>
        <dd class="num">{identity.protocol.major}.{identity.protocol.minor}</dd>
      </div>
      {#if battery}
        <div>
          <dt>Battery</dt>
          <dd class="num">{battery.percent === null ? 'Level not reported' : `${battery.percent}%`}{battery.state === 'unknown' ? '' : `, ${battery.state}`}</dd>
        </div>
      {/if}
      {#if mode}
        <div>
          <dt>Settings source</dt>
          <dd>{mode === 'onboard' ? 'Onboard profile' : 'Host (software)'}</dd>
        </div>
      {/if}
    </dl>

    {#if mode === 'onboard'}
      <p class="note">
        The mouse is using its onboard profile. It may refuse live changes, or replace them at the next profile or DPI
        stage change. UDB does not switch it to host mode, because that change outlasts this page.
      </p>
    {:else if mode === 'host'}
      <p class="note">The mouse takes its settings from software. Values set here last until it powers off.</p>
    {/if}

    {#if checks.length}
      <div class="checks" role="status">
        <h3>After the device reconnected</h3>
        <ul>
          {#each checks as c (c.row)}
            {@const kept = c.observed === c.expected}
            <li class={kept ? 'confirmed' : 'signal'}>
              <Icon name={kept ? 'check' : 'alert'} size={14} />
              {LABEL[c.row]}: {kept ? 'kept' : 'changed to'} {show(c.row, c.observed)}
              {#if !kept}(last confirmed {show(c.row, c.expected)}){/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if rows.length}
      <label class="gate">
        <input type="checkbox" bind:checked={allowUnverified} />
        <span>
          Allow writes to unverified settings. UDB reads every write back and restores the previous value if the device
          disagrees.
        </span>
      </label>

      <div class="lines">
        {#each rows as row (row)}
          <SettingLine
            id="hidpp-{row}"
            label={LABEL[row]}
            value={readings[row]?.value}
            readAt={readings[row]?.at}
            busy={busy === row}
            result={results[row]}
            show={(v) => show(row, v)}
          >
            {#if row === 'dpi' && dpiOptions}
              <RangeField
                id="hidpp-dpi"
                label={LABEL.dpi}
                min={dpiOptions[0]!}
                max={dpiOptions[dpiOptions.length - 1]!}
                step={dpiStep}
                unit="DPI"
                curve
                bind:value={requested.dpi}
                disabled={!allowUnverified}
                oncommit={() => writer.commit('dpi')}
              />
            {:else if row === 'sidetone'}
              <RangeField
                id="hidpp-sidetone"
                label={LABEL.sidetone}
                min={0}
                max={100}
                bind:value={requested.sidetone}
                disabled={!allowUnverified}
                oncommit={() => writer.commit('sidetone')}
              />
            {:else if rateOptions}
              <Segments
                id="hidpp-rate"
                label={LABEL.rate}
                options={rateOptions.map((hz) => ({ value: hz, label: `${hz.toLocaleString()} Hz` }))}
                bind:value={requested.rate}
                disabled={!allowUnverified}
                oncommit={() => writer.commit('rate')}
              />
            {/if}
          </SettingLine>
        {/each}
      </div>
    {:else}
      <p class="note">This device reports no DPI, report-rate or sidetone feature that UDB can change.</p>
    {/if}

    <ProfileBar
      family={entry.protocol.family}
      category={entry.category}
      current={Object.fromEntries(Object.entries(readings).map(([r, x]) => [r, x?.value]))}
      label={(r) => LABEL[r as Row]}
      show={(r, v) => show(r as Row, v)}
      canWrite={allowUnverified}
      busy={busy !== null}
      apply={applyProfileRow}
    />

    <footer class="actions">
      <button class="btn" onclick={read} disabled={busy !== null}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>
