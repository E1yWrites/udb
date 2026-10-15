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
  import { CompxSession } from '../adapters/compx-session.ts';
  import { POLLING_RATES, type Info } from '../adapters/compx.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex } from '../lib/registry.ts';
  import { open, type LogEntry } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  type Reading = { value: number | null; at: string };
  type Row = 'pollingRate' | 'activeStage' | 'debounce';
  const LABEL: Record<Row, string> = { pollingRate: 'Polling rate', activeStage: 'Active DPI stage', debounce: 'Debounce' };
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
  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: [], writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));

  const now = () => new Date().toISOString();
  const clock = (iso: string) => new Date(iso).toLocaleTimeString();
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const expectedMid = $derived(device.match?.identity.protocolIdentity?.mid ?? null);
  const rates = $derived(POLLING_RATES.filter((r) => !info || r <= info.maxRate));
  const maxDebounce = $derived(Number(entry.features.find((f) => f.id === 'debounce-ms')?.constraints?.max ?? 15));

  function options(row: Row): { value: number; label: string }[] {
    if (row === 'pollingRate') return rates.map((hz) => ({ value: hz, label: `${hz.toLocaleString()} Hz` }));
    if (row === 'activeStage') return Array.from({ length: stageCount ?? 0 }, (_, i) => ({ value: i, label: `Stage ${i + 1}` }));
    return Array.from({ length: maxDebounce + 1 }, (_, ms) => ({ value: ms, label: `${ms} ms` }));
  }

  function setting(row: Row): Setting<number> {
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
      error = `Could not open the device (${opened.error}). Close Pulsar's software and try again.`;
      return;
    }
    const deny = entry.collections.deny.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));
    session = new CompxSession(hid, deny, past.log);
    try {
      info = await session.identify();
      stageCount = await session.readPair(0x02);
      for (const row of ['pollingRate', 'activeStage', 'debounce'] as Row[]) {
        if (row === 'activeStage' && stageCount === null) continue;
        const value = await setting(row).read();
        readings[row] = { value, at: now() };
        if (value !== null) requested[row] = value;
      }
      battery = info.wired ? null : await session.battery().catch(() => null);
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
      confirmedWrites.set(device.key, {
        ...(confirmedWrites.get(device.key) ?? {}),
        [row]: { value: result.value, reconnects: device.reconnects },
      });
    } else if (result.kind === 'mismatch') {
      readings[row] = { value: result.restored, at };
    } else if (result.kind === 'failed') {
      readings[row] = { value: result.actual, at };
    }
    busy = null;
  }

  function show(row: Row, v: number | null | undefined): string {
    if (v == null) return 'Unreadable';
    if (row === 'pollingRate') return `${v.toLocaleString()} Hz`;
    if (row === 'activeStage') return `Stage ${v + 1} of ${stageCount}`;
    return `${v} ms`;
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: now().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      identity: info,
      stageCount,
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
      are identify, link check, battery, settings read, and writes to polling rate, active DPI stage and debounce.
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
          {#if expectedMid === info.mid}
            <span class="status confirmed"><Icon name="check" size={14} />Matches {entry.model}</span>
          {:else}
            <span class="status signal"><Icon name="unverified" size={14} />MID not yet recorded for this model</span>
          {/if}
        </dd>
      </div>
      <div>
        <dt>Link</dt>
        <dd>{info.wired ? 'Cable' : 'Wireless'}, up to {info.maxRate.toLocaleString()} Hz</dd>
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
              {LABEL[c.setting]}:
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
      {#each ['pollingRate', 'activeStage', 'debounce'] as const as row (row)}
        {#if row !== 'activeStage' || (stageCount ?? 0) > 1}
          {@const r = results[row]}
          <div class="line">
            <label class="name" for="ctl-{row}">{LABEL[row]}</label>
            <div class="ask">
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
            </div>
            <div class="told">
              <span class="tag">Device</span>
              <span class="value num">{show(row, readings[row]?.value)}</span>
              <span class="when">read {readings[row] ? clock(readings[row].at) : '–'}</span>
            </div>
            <p class="outcome" aria-live="polite">
              {#if busy === row}
                <span class="status muted">Writing, then reading back…</span>
              {:else if r?.kind === 'confirmed'}
                <span class="status confirmed"><Icon name="check" size={14} />Confirmed by device at {clock(r.at)}</span>
              {:else if r?.kind === 'mismatch'}
                <span class="status signal"><Icon name="alert" size={14} />
                  Device returned {show(row, r.actual)} instead of {show(row, r.requested)}.
                  {r.restoreConfirmed ? `Restored to ${show(row, r.restored)}.` : `Restore not confirmed: device reads ${show(row, r.restored)}.`}
                </span>
              {:else if r?.kind === 'failed'}
                <span class="status danger"><Icon name="alert" size={14} />{r.error}. Device now reads {show(row, r.actual)}.</span>
              {:else if r?.kind === 'invalid'}
                <span class="status signal"><Icon name="alert" size={14} />{r.reason}</span>
              {/if}
            </p>
          </div>
        {/if}
      {/each}
    </div>

    {#if stageCount === 1}
      <p class="note">This mouse has one DPI stage configured, so there is no stage to switch to.</p>
    {/if}

    <footer class="actions">
      <button class="btn" onclick={connect}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>

<style>
  .live {
    display: grid;
    gap: var(--space-4);
  }

  .section {
    font-size: var(--step--1);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .lede {
    color: var(--muted);
    max-width: 68ch;
  }

  .lede + .btn,
  .problem + .btn {
    justify-self: start;
  }

  .problem {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    color: var(--danger);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4) var(--space-8);
    margin: 0;
  }

  .facts dt {
    font-size: var(--step--1);
    color: var(--faint);
  }

  .facts dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    align-items: baseline;
  }

  .checks h3 {
    font-size: var(--step-0);
    font-weight: 600;
  }

  .checks ul {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .checks li {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .gate {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) 0;
    border-block: 1px solid var(--line);
    color: var(--muted);
    max-width: 75ch;
    cursor: pointer;
  }

  .gate input {
    margin-top: 0.3em;
    accent-color: var(--signal);
  }

  .lines {
    display: grid;
  }

  .line {
    display: grid;
    grid-template-columns: minmax(9rem, 12rem) auto 1fr;
    grid-template-areas: 'name ask told' '. outcome outcome';
    gap: var(--space-2) var(--space-6);
    align-items: center;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--line);
  }

  .name {
    grid-area: name;
    font-weight: 600;
  }

  .ask {
    grid-area: ask;
    display: flex;
    gap: var(--space-2);
  }

  select {
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  select:disabled {
    opacity: 0.5;
  }

  .told {
    grid-area: told;
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .value {
    font-size: var(--step-1);
    font-weight: 600;
  }

  .when {
    font-size: var(--step--1);
    color: var(--faint);
  }

  .outcome {
    grid-area: outcome;
    min-height: 1.5em;
  }

  .outcome:empty {
    display: none;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    font-weight: 600;
  }

  .confirmed {
    color: var(--confirmed);
  }

  .signal {
    color: var(--signal);
  }

  .danger {
    color: var(--danger);
  }

  .muted {
    color: var(--muted);
  }

  .note {
    font-size: var(--step--1);
    color: var(--faint);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  @media (max-width: 40rem) {
    .line {
      grid-template-columns: 1fr;
      grid-template-areas: 'name' 'told' 'ask' 'outcome';
    }
  }
</style>
