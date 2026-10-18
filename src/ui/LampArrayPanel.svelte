<script lang="ts" module>
  import type { LogEntry } from '../lib/transport.ts';
  // Byte log and sends per device for this page session.
  const history = new Map<string, { log: LogEntry[]; sends: unknown[] }>();
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import { logFor } from '../lib/history.svelte.ts';
  import { LampArraySession } from '../adapters/lamparray-session.ts';
  import { KINDS, layoutOf, PAGE, U, type Attributes, type Lamp } from '../adapters/lamparray.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { sendSetting, type SendResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let attributes = $state<Attributes | null>(null);
  let lamps = $state<Lamp[]>([]);
  let readAt = $state('');
  let color = $state('#ff4000');
  let intensity = $state(255);
  let allowUnverified = $state(false);
  let busy = $state(false);
  let result = $state<SendResult | null>(null);
  let released = $state<string | null>(null);
  let copied = $state(false);
  let session = $state.raw<LampArraySession | null>(null);

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), sends: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));
  const clock = (iso: string) => new Date(iso).toLocaleTimeString();
  const mm = (um: number) => `${(um / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} mm`;
  const rgb = (hexColor: string) => [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16)) as [number, number, number];

  /** What the lamps can show, from their own attributes. */
  const summary = $derived.by(() => {
    if (!lamps.length) return null;
    const programmable = lamps.filter((l) => l.programmable).length;
    const keys = lamps.filter((l) => l.inputBinding !== 0).length;
    const levels = new Set(lamps.map((l) => `${l.levels.red}/${l.levels.green}/${l.levels.blue}`));
    return { programmable, keys, levels: [...levels] };
  });

  async function read() {
    phase = 'reading';
    error = '';
    result = null;
    const hid = device.interfaces.find((i) => i.collections.some((c) => c.usagePage === PAGE && c.usage === U.lampArray));
    const collection = hid?.collections.find((c) => c.usagePage === PAGE && c.usage === U.lampArray);
    const layout = collection ? layoutOf(collection) : null;
    if (!hid || !layout) {
      phase = 'error';
      error = hid ? 'The LampArray collection lacks the attribute reports UDB reads.' : 'The LampArray interface (0059) is not granted. Use “Add device” and pick the device again.';
      return;
    }
    const opened = await open(hid);
    if (!opened.ok) {
      phase = 'error';
      error = `Could not open the device (${opened.error}). Close ${entry.conflictingSoftware?.join(' or ') ?? 'other lighting apps'} and try again.`;
      return;
    }
    session = new LampArraySession(hid, layout, entry.collections.deny.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) })), past.log);
    try {
      attributes = await session.attributes();
      lamps = await session.lamps(attributes.lampCount);
      readAt = new Date().toISOString();
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function sendColor() {
    if (!session || !attributes) return;
    busy = true;
    const [r, g, b] = rgb(color);
    const value = { r, g, b, i: intensity };
    result = await sendSetting(session.color(attributes.lampCount), value);
    past.sends.push({ setting: 'lighting.color', value, result: $state.snapshot(result) });
    released = null;
    busy = false;
  }

  async function release() {
    if (!session) return;
    busy = true;
    try {
      await session.release();
      released = new Date().toISOString();
      past.sends.push({ setting: 'lighting.autonomous', value: true, at: released });
    } catch (e) {
      result = { kind: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
    busy = false;
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: new Date().toISOString().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      layout: session?.layout ?? null,
      attributes: $state.snapshot(attributes),
      lamps: $state.snapshot(lamps),
      sends: past.sends,
      log: past.log,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }
</script>

<section class="live" aria-labelledby="lamp-live">
  <h2 id="lamp-live" class="section">Live from the device</h2>

  {#if phase !== 'ready'}
    <p class="lede">
      UDB reads the lighting layout the device describes: how many lamps, where they sit, and what colours they can show.
      Reading changes nothing. Colours can be sent, but no LampArray device reports them back.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : `Read from ${entry.category}`}
    </button>
  {:else if attributes}
    <dl class="facts">
      <div>
        <dt>Lamps</dt>
        <dd class="num">{attributes.lampCount}</dd>
      </div>
      <div>
        <dt>Kind</dt>
        <dd>{KINDS[attributes.kind] ?? `Undefined (${attributes.kind})`}</dd>
      </div>
      <div>
        <dt>Size</dt>
        <dd class="num">{mm(attributes.size.width)} × {mm(attributes.size.height)} × {mm(attributes.size.depth)}</dd>
      </div>
      <div>
        <dt>Fastest update</dt>
        <dd class="num">every {(attributes.minUpdateIntervalUs / 1000).toLocaleString()} ms</dd>
      </div>
      {#if summary}
        <div>
          <dt>Programmable</dt>
          <dd class="num">{summary.programmable} of {lamps.length}{summary.keys ? `, ${summary.keys} under keys` : ''}</dd>
        </div>
        <div>
          <dt>Colour levels (R/G/B)</dt>
          <dd class="num">{summary.levels.join(', ')}</dd>
        </div>
      {/if}
    </dl>
    <p class="note">Read from the device at {clock(readAt)}.</p>

    {#if session?.canSetColor}
      <label class="gate">
        <input type="checkbox" bind:checked={allowUnverified} />
        <span>
          Allow sending colours. This takes lighting control from the device until you hand it back or it restarts. The
          device cannot report colours back, so UDB can only say they were sent.
        </span>
      </label>

      <div class="send">
        <label class="name" for="lamp-color">All lamps</label>
        <input id="lamp-color" type="color" bind:value={color} disabled={!allowUnverified || busy} />
        <label class="visually-hidden" for="lamp-intensity">Intensity</label>
        <input id="lamp-intensity" type="range" min="0" max="255" bind:value={intensity} disabled={!allowUnverified || busy} />
        <span class="num muted">intensity {intensity}</span>
        <button class="btn" onclick={sendColor} disabled={!allowUnverified || busy}>{busy ? 'Sending…' : 'Send'}</button>
        <button class="btn" onclick={release} disabled={!allowUnverified || busy}>Hand lighting back to the device</button>
      </div>
      <p class="outcome" aria-live="polite">
        {#if released}
          <span class="status muted"><Icon name="check" size={14} />Autonomous mode sent at {clock(released)}. The device runs its own lighting again.</span>
        {:else if result?.kind === 'sent'}
          <span class="status signal"><Icon name="unverified" size={14} />Sent at {clock(result.at)}. The device does not report colours back, so this is not confirmed.</span>
        {:else if result?.kind === 'invalid'}
          <span class="status signal"><Icon name="alert" size={14} />{result.reason}</span>
        {:else if result?.kind === 'failed'}
          <span class="status danger"><Icon name="alert" size={14} />{result.error}</span>
        {/if}
      </p>
      <p class="note">If the colour does not change or changes back, Windows Dynamic Lighting or the maker’s app is driving the device.</p>
    {:else}
      <p class="note">This device has no range-update or control report, so UDB only reads its layout.</p>
    {/if}

    <footer class="actions">
      <button class="btn" onclick={read} disabled={busy}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>

<style>
  .send {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .send .name {
    font-weight: 600;
    min-width: 9rem;
  }

  input[type='color'] {
    inline-size: 3rem;
    block-size: 2.25rem;
    padding: 2px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--raised);
  }

  input[type='range'] {
    accent-color: var(--text);
  }

  input:disabled {
    opacity: 0.5;
  }
</style>
