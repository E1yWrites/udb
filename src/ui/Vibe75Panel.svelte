<script lang="ts">
  import Icon from './Icon.svelte';
  import { Vibe75Session, type ProfileReading } from '../adapters/vibe75-session.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex, type Collection } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let readings = $state<ProfileReading[]>([]);
  let copied = $state(false);
  let session: Vibe75Session | null = null;

  const pairs = (list: Collection[]) =>
    list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));

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
    session = new Vibe75Session(hid, pairs(entry.collections.deny), session?.log ?? []);
    try {
      readings = await session.probe();
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

  let probing = $state(false);
  let probed = $state(false);

  async function extendedProbe() {
    if (!session) return;
    probing = true;
    try {
      await session.extendedProbe(0);
      probed = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    probing = false;
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: new Date().toISOString().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      readings: $state.snapshot(readings),
      log: session?.log ?? [],
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }

  const swatch = (c: [number, number, number]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
</script>

<section class="live" aria-labelledby="kb-live">
  <h2 id="kb-live" class="section">Live from the device</h2>
  {#if phase !== 'ready'}
    <p class="lede">
      UDB asks the keyboard for the lighting stored in each of its five profiles. Reading changes nothing. In this release
      the only command UDB can send to this keyboard is that read.
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
                  <span class="data">{r.block.color.map((x) => x.toString(16).padStart(2, '0')).join('')}</span>
                </td>
                <td class="num">{r.block.brightness}</td>
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
      Decoded with the layout documented for the XVX G75, a keyboard from the same OEM family. The raw replies are in the
      evidence report.
    </p>
    <p class="footnote">
      Extended read: sends the profile 0 read once, then fetches the reply four times over a second and records anything
      the keyboard pushes on its own. It is still read-only.
      {#if probed}<strong>Done. Copy the evidence report.</strong>{/if}
    </p>
    <footer class="actions">
      <button class="btn" onclick={read}>Read again</button>
      <button class="btn" onclick={extendedProbe} disabled={probing}>{probing ? 'Probing…' : 'Extended read'}</button>
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

  .btn {
    justify-self: start;
  }

  .problem {
    display: flex;
    gap: var(--space-2);
    color: var(--danger);
  }

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

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    font-weight: 600;
  }

  .confirmed {
    color: var(--confirmed);
  }

  .muted {
    color: var(--muted);
  }

  .footnote {
    font-size: var(--step--1);
    color: var(--faint);
    max-width: 72ch;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
</style>
