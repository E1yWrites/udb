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
  import { CorsairNxpSession } from '../adapters/corsair-nxp-session.ts';
  import { enabledStages, type Ident, type Stage } from '../adapters/corsair-nxp.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex, type Collection } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  type Row = 'active' | 'lift' | 'snap' | `stage${number}`;
  const isStage = (r: Row): r is `stage${number}` => r.startsWith('stage');
  const stageOf = (r: `stage${number}`) => Number(r.slice(5));
  const stageName = (n: number) => (n === 0 ? 'Sniper' : `Stage ${n}`);
  const label = (r: Row) => (isStage(r) ? `${stageName(stageOf(r))} DPI` : { active: 'Active stage', lift: 'Lift-off height', snap: 'Angle snapping' }[r]);

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let ident = $state<Ident | null>(null);
  let enabled = $state<number[]>([]);
  let stages = $state<Record<number, Stage | null>>({});
  let readings = $state<Partial<Record<Row, { value: number | null; at: string }>>>({});
  let requested = $state<Partial<Record<Row, number>>>({});
  let results = $state<Partial<Record<Row, WriteResult<number> & { at: string }>>>({});
  let busy = $state<Row | null>(null);
  let allowUnverified = $state(false);
  let checks = $state<{ row: Row; expected: number; observed: number | null }[]>([]);
  let copied = $state(false);
  let session: CorsairNxpSession | null = null;

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));
  const now = () => new Date().toISOString();
  const pairs = (list: Collection[]) => list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
  const dpiRange = $derived.by(() => {
    const c = entry.features.find((f) => f.id === 'dpi.stages')?.constraints;
    return { min: Number(c?.min ?? 100), max: Number(c?.max ?? 18000) };
  });
  const rows = $derived<Row[]>(['active', ...enabled.map((n) => `stage${n}` as Row), 'lift', 'snap']);

  function setting(row: Row): Setting<number> {
    const s = session!;
    if (isStage(row)) return s.stageDpi(stageOf(row), enabled, dpiRange);
    return row === 'active' ? s.activeStage(enabled) : row === 'lift' ? s.lift() : s.snap();
  }

  function show(row: Row, v: number | null | undefined): string {
    if (v == null) return 'Unreadable';
    if (isStage(row)) return `${v.toLocaleString()} DPI`;
    if (row === 'active') return stageName(v);
    if (row === 'snap') return v ? 'On' : 'Off';
    return `${v} of 5`;
  }

  async function read() {
    phase = 'reading';
    error = '';
    const use = pairs(entry.collections.use);
    const hid = device.interfaces.find((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)));
    if (!hid) {
      phase = 'error';
      error = 'The mouse’s config interface (FFC2, usage 4) is not granted. Use “Add device” and pick the other entry for this mouse.';
      return;
    }
    const opened = await open(hid);
    if (!opened.ok) {
      phase = 'error';
      error = `Could not open the mouse (${opened.error}).`;
      return;
    }
    session = new CorsairNxpSession(hid, pairs(entry.collections.deny), past.log);
    try {
      ident = await session.ident();
      enabled = enabledStages((await session.mask()) ?? 0);
      stages = {};
      for (const n of enabled) stages[n] = await session.stage(n);
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

  async function apply(row: Row) {
    const previous = readings[row]?.value;
    const value = requested[row];
    if (previous == null || value == null) return;
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
      ident: $state.snapshot(ident),
      enabledStages: $state.snapshot(enabled),
      stages: $state.snapshot(stages),
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

<section class="live" aria-labelledby="corsair-live">
  <h2 id="corsair-live" class="section">Live from the device</h2>

  {#if phase !== 'ready'}
    <p class="lede">
      UDB reads the mouse’s identity and its live DPI stages, lift-off height and angle snapping. Reading changes nothing.
      UDB never writes the onboard profile, the polling rate or firmware.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : 'Read from mouse'}
    </button>
  {:else}
    <dl class="facts">
      {#if ident}
        <div>
          <dt>Firmware</dt>
          <dd class="num">{ident.firmware} (bootloader {ident.bootloader})</dd>
        </div>
        <div>
          <dt>Polling</dt>
          <dd class="num">{ident.pollingRateHz === null ? 'Not reported' : `${ident.pollingRateHz.toLocaleString()} Hz`}</dd>
        </div>
      {/if}
      <div>
        <dt>Enabled stages</dt>
        <dd>{enabled.map(stageName).join(', ') || 'None'}</dd>
      </div>
    </dl>
    <p class="note">
      These are live settings: the mouse forgets them when it powers off and starts from its onboard profile, and iCUE
      replaces them when it re-applies its own profile.
    </p>

    {#if checks.length}
      <div class="checks" role="status">
        <h3>After the device reconnected</h3>
        <ul>
          {#each checks as c (c.row)}
            {@const kept = c.observed === c.expected}
            <li class={kept ? 'confirmed' : 'signal'}>
              <Icon name={kept ? 'check' : 'alert'} size={14} />
              {label(c.row)}: {kept ? 'kept' : 'changed to'} {show(c.row, c.observed)}
              {#if !kept}(last confirmed {show(c.row, c.expected)}){/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <label class="gate">
      <input type="checkbox" bind:checked={allowUnverified} />
      <span>
        Allow writes to unverified settings. UDB reads every write back and restores the previous value if the mouse
        disagrees.
      </span>
    </label>

    <div class="lines">
      {#each rows as row (row)}
        <SettingLine
          id="corsair-{row}"
          label={label(row)}
          value={readings[row]?.value}
          readAt={readings[row]?.at}
          busy={busy === row}
          result={results[row]}
          show={(v) => show(row, v)}
        >
          {#if isStage(row)}
            <input
              id="corsair-{row}"
              type="number"
              inputmode="numeric"
              min={dpiRange.min}
              max={dpiRange.max}
              step="50"
              bind:value={requested[row]}
              disabled={!allowUnverified || busy !== null}
            />
          {:else}
            <select id="corsair-{row}" bind:value={requested[row]} disabled={!allowUnverified || busy !== null}>
              {#if row === 'active'}
                {#each enabled as n (n)}<option value={n}>{stageName(n)}</option>{/each}
              {:else if row === 'lift'}
                {#each [1, 2, 3, 4, 5] as h (h)}<option value={h}>{h}</option>{/each}
              {:else}
                <option value={0}>Off</option>
                <option value={1}>On</option>
              {/if}
            </select>
          {/if}
          <button
            class="btn"
            onclick={() => apply(row)}
            disabled={!allowUnverified || busy !== null || requested[row] == null || requested[row] === readings[row]?.value}
          >
            {busy === row ? 'Writing…' : 'Apply'}
          </button>
        </SettingLine>
      {/each}
    </div>

    <ProfileBar
      entryId={entry.id}
      current={Object.fromEntries(Object.entries(readings).map(([r, x]) => [r, x?.value]))}
      label={(r) => label(r as Row)}
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
