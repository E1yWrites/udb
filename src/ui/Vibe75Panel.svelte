<script lang="ts" module>
  import type { LogEntry } from '../lib/transport.ts';
  // Per device for this page session: byte log, writes, and the last brightness the
  // device confirmed (with the reconnect count at that moment) for persistence checks.
  const history = new Map<string, { log: LogEntry[]; writes: unknown[]; confirmed?: { value: number; reconnects: number } }>();
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import SettingLine from './SettingLine.svelte';
  import { Vibe75Session, type ProfileReading } from '../adapters/vibe75-session.ts';
  import { BRIGHTNESS_MAX } from '../adapters/vibe75.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex, type Collection } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { applySetting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: [], writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let readings = $state<ProfileReading[]>([]);
  let readAt = $state('');
  let requested = $state(1);
  let result = $state<(WriteResult<number> & { at: string }) | null>(null);
  let busy = $state(false);
  let allowUnverified = $state(false);
  let check = $state<{ expected: number; observed: number | null } | null>(null);
  let copied = $state(false);
  let session: Vibe75Session | null = null;

  const stored = $derived(readings.find((r) => r.block)?.block ?? null);
  const pairs = (list: Collection[]) => list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));

  async function read() {
    phase = 'reading';
    error = '';
    const use = pairs(entry.collections.use);
    const hid = device.interfaces.find((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)));
    if (!hid) {
      phase = 'error';
      error = 'The keyboard’s settings interface (FF13) is not granted. Use “Add device” and pick the Vibe75 again.';
      return;
    }
    const opened = await open(hid);
    if (!opened.ok) {
      phase = 'error';
      error = `Could not open the keyboard (${opened.error}). Close the Mechlands driver and try again.`;
      return;
    }
    session = new Vibe75Session(hid, pairs(entry.collections.deny), past.log);
    try {
      readings = await session.probe();
      readAt = new Date().toISOString();
      const block = readings.find((r) => r.block)?.block;
      if (block) requested = block.brightness;
      const c = past.confirmed;
      check = c && device.reconnects > c.reconnects ? { expected: c.value, observed: block?.brightness ?? null } : null;
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function apply() {
    if (!session || !stored) return;
    busy = true;
    const previous = stored.brightness;
    const r = await applySetting(session.brightness($state.snapshot(stored)), requested, previous);
    const at = new Date().toISOString();
    result = { ...r, at };
    past.writes.push({ setting: 'lighting.brightness', profile: stored.profile, requested, previous, result: r, at, reconnects: device.reconnects });
    const actual = r.kind === 'confirmed' ? r.value : r.kind === 'mismatch' ? r.restored : r.kind === 'failed' ? r.actual : previous;
    if (r.kind === 'confirmed') past.confirmed = { value: r.value, reconnects: device.reconnects };
    readings = readings.map((x) => (x.block && x.profile === stored.profile && actual !== null ? { ...x, block: { ...x.block, brightness: actual } } : x));
    readAt = at;
    busy = false;
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: new Date().toISOString().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      readings: $state.snapshot(readings),
      reconnects: device.reconnects,
      persistenceCheck: $state.snapshot(check),
      writes: past.writes,
      log: past.log,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }

  const swatch = (c: [number, number, number]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
  const hexColor = (c: [number, number, number]) => c.map((x) => x.toString(16).padStart(2, '0')).join('');
</script>

<section class="live" aria-labelledby="kb-live">
  <h2 id="kb-live" class="section">Live from the device</h2>
  {#if phase !== 'ready'}
    <p class="lede">
      UDB asks the keyboard for the lighting stored in each of its five profiles. Reading changes nothing. The only
      commands UDB can send to this keyboard are that read and the vendor’s lighting write, used only when you apply a
      brightness below.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : 'Read from keyboard'}
    </button>
  {:else}
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Profile</th><th scope="col">Stored</th><th scope="col">Mode</th><th scope="col">Colour</th>
            <th scope="col">Brightness</th><th scope="col">Speed</th>
          </tr>
        </thead>
        <tbody>
          {#each readings as r (r.profile)}
            <tr>
              <th scope="row" class="num">{r.profile}</th>
              {#if r.block}
                <td><span class="status confirmed"><Icon name="check" size={14} />Yes</span></td>
                <td class="num">{r.block.mode}</td>
                <td>
                  <span class="chip" style:background-color={swatch(r.block.color)} aria-hidden="true"></span>
                  <span class="data">{hexColor(r.block.color)}</span>
                </td>
                <td class="num">{r.block.brightness} / {BRIGHTNESS_MAX}</td>
                <td class="num">{r.block.speed}</td>
              {:else}
                <td class="muted" colspan="5">No lighting block</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="footnote">
      This is the lighting stored in the keyboard, decoded with the layout of the same OEM family (XVX G75). Mode numbers
      are shown raw because their names on the Vibe75 are not confirmed. Whether the LEDs are switched on is held
      elsewhere.
    </p>

    {#if check}
      <div class="checks" role="status">
        <h3>After the device reconnected</h3>
        <p class={check.observed === check.expected ? 'confirmed' : 'signal'}>
          <Icon name={check.observed === check.expected ? 'check' : 'alert'} size={14} />
          Brightness {check.observed === check.expected ? 'kept' : 'changed to'} {check.observed ?? 'unreadable'}
          {#if check.observed !== check.expected}(last confirmed {check.expected}){/if}
        </p>
      </div>
    {/if}

    {#if stored}
      <label class="gate">
        <input type="checkbox" bind:checked={allowUnverified} />
        <span>
          Allow writes to unverified settings. UDB replays the vendor’s lighting write with only brightness changed, reads
          the block back, and restores the previous value if the keyboard disagrees.
        </span>
      </label>

      <SettingLine
        id="kb-brightness"
        label="Brightness (profile {stored.profile})"
        value={stored.brightness}
        {readAt}
        {busy}
        result={result ?? undefined}
        show={(v) => (v == null ? 'Unreadable' : `${v} / ${BRIGHTNESS_MAX}`)}
      >
        <select id="kb-brightness" bind:value={requested} disabled={!allowUnverified || busy}>
          {#each Array.from({ length: BRIGHTNESS_MAX }, (_, i) => i + 1) as b (b)}<option value={b}>{b}</option>{/each}
        </select>
        <button class="btn" onclick={apply} disabled={!allowUnverified || busy || requested === stored.brightness}>
          {busy ? 'Writing…' : 'Apply'}
        </button>
      </SettingLine>
    {/if}

    <footer class="actions">
      <button class="btn" onclick={read} disabled={busy}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>

<style>
  .scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-2) var(--space-4) var(--space-2) 0;
    border-bottom: 1px solid var(--line);
  }

  thead th {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--faint);
    border-bottom-color: var(--line-strong);
  }

  .chip {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border: 1px solid var(--line-strong);
    vertical-align: -0.1em;
    margin-right: var(--space-2);
  }

  .footnote {
    font-size: var(--step--1);
    color: var(--faint);
    max-width: 72ch;
  }
</style>
