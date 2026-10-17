<script lang="ts" module>
  import type { LogEntry } from '../lib/transport.ts';
  // Per device for this page session (kept across reconnects): byte log, writes,
  // and the last value each setting confirmed, for persistence checks.
  const history = new Map<string, { log: LogEntry[]; writes: unknown[] }>();
  const confirmedWrites = new Map<string, Record<string, { value: number; reconnects: number }>>();
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import { logFor } from '../lib/history.svelte.ts';
  import SettingLine from './SettingLine.svelte';
  import { paramsFrom, RazerSession, type Params } from '../adapters/razer-session.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex, type Collection } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);
  const params = $derived(paramsFrom(device.match?.identity.params));

  type Row = 'dpi' | 'polling' | 'sleep' | 'lowPower';
  const LABEL: Record<Row, string> = { dpi: 'DPI', polling: 'Polling rate', sleep: 'Auto sleep', lowPower: 'Low-power mode at' };

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let firmware = $state<string | null>(null);
  let battery = $state<{ percent: number; charging: boolean | null } | null>(null);
  let readings = $state<Partial<Record<Row, { value: number | null; at: string }>>>({});
  let requested = $state<Partial<Record<Row, number>>>({});
  let results = $state<Partial<Record<Row, WriteResult<number> & { at: string }>>>({});
  let busy = $state<Row | null>(null);
  let allowUnverified = $state(false);
  let checks = $state<{ row: Row; expected: number; observed: number | null }[]>([]);
  let copied = $state(false);
  let session: RazerSession | null = null;

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));
  const now = () => new Date().toISOString();
  const pairs = (list: Collection[]) => list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
  const rows = $derived<Row[]>(params?.battery ? ['dpi', 'polling', 'sleep', 'lowPower'] : ['dpi', 'polling']);

  function setting(row: Row): Setting<number> {
    const s = session!;
    return row === 'dpi' ? s.dpi() : row === 'polling' ? s.polling() : row === 'sleep' ? s.sleepTimeout() : s.lowPower();
  }

  function show(row: Row, v: number | null | undefined): string {
    if (v == null) return 'Unreadable';
    if (row === 'dpi') return `${v.toLocaleString()} DPI`;
    if (row === 'polling') return `${v.toLocaleString()} Hz`;
    if (row === 'sleep') return v % 60 === 0 ? `${v / 60} min` : `${v} s`;
    return `${v}% battery`;
  }

  function options(row: Row, p: Params): number[] {
    if (row === 'polling') return p.pollingRates;
    if (row === 'sleep') return Array.from({ length: 15 }, (_, i) => (i + 1) * 60);
    return Array.from({ length: 20 }, (_, i) => (i + 1) * 5);
  }

  async function read() {
    if (!params) {
      phase = 'error';
      error = 'The registry entry for this connection has no Razer protocol parameters.';
      return;
    }
    phase = 'reading';
    error = '';
    const use = pairs(entry.collections.use);
    // The control channel is normally the interface whose only collection is the mouse one; try those first.
    const candidates = device.interfaces
      .filter((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)))
      .sort((a, b) => a.collections.length - b.collections.length);
    const guard = {
      deny: pairs(entry.collections.deny),
      undeclared: entry.collections.use.filter((c) => c.undeclaredFeatureReports).flatMap((c) => (c.reportIds ?? []).map((reportId) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage), reportId }))),
    };
    const failures: string[] = [];
    session = null;
    // A receiver can expose two identical mouse interfaces; only the control one answers.
    for (const hid of candidates) {
      const opened = await open(hid);
      if (!opened.ok) {
        failures.push(opened.error);
        continue;
      }
      const s = new RazerSession(hid, guard, params, past.log);
      try {
        firmware = await s.firmware();
        session = s;
        break;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (!session) {
      phase = 'error';
      error = candidates.length
        ? `No granted interface answered (${failures.join('; ')}). Quit Razer Synapse, then add the device again and pick the other entry if the browser lists two.`
        : 'The mouse’s control interface is not granted. Use “Add device” and pick the mouse again.';
      return;
    }
    try {
      battery = await session.battery();
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

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: now().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      params,
      firmware,
      battery: $state.snapshot(battery),
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

<section class="live" aria-labelledby="razer-live">
  <h2 id="razer-live" class="section">Live from the device</h2>

  {#if phase !== 'ready'}
    <p class="lede">
      UDB asks the mouse for its firmware version, then reads battery, DPI, polling rate and power settings. Reading
      changes nothing. UDB never reads the serial number and never sends firmware, button or lighting commands.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : 'Read from mouse'}
    </button>
  {:else if params}
    <dl class="facts">
      <div>
        <dt>Firmware</dt>
        <dd class="num">{firmware}</dd>
      </div>
      {#if battery}
        <div>
          <dt>Battery</dt>
          <dd class="num">{battery.percent}%{battery.charging === null ? '' : battery.charging ? ', charging' : ', not charging'}</dd>
        </div>
      {/if}
    </dl>

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
          id="razer-{row}"
          label={LABEL[row]}
          value={readings[row]?.value}
          readAt={readings[row]?.at}
          busy={busy === row}
          result={results[row]}
          show={(v) => show(row, v)}
        >
          {#if row === 'dpi'}
            <input
              id="razer-dpi"
              type="number"
              inputmode="numeric"
              min="100"
              max={params.maxDpi}
              step="50"
              bind:value={requested.dpi}
              disabled={!allowUnverified || busy !== null}
            />
          {:else}
            <select id="razer-{row}" bind:value={requested[row]} disabled={!allowUnverified || busy !== null}>
              {#each options(row, params) as v (v)}<option value={v}>{show(row, v)}</option>{/each}
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
    {#if params.battery}
      <p class="note">Low-power mode is unavailable above 1,000 Hz; UDB checks the mouse’s polling rate before writing it.</p>
    {/if}

    <footer class="actions">
      <button class="btn" onclick={read} disabled={busy !== null}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>
