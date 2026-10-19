<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import DevicePane from './ui/DevicePane.svelte';
  import DeviceArt from './ui/DeviceArt.svelte';
  import { devices, type UdbDevice } from './lib/devices.svelte.ts';
  import { CONNECTION_ICON } from './lib/labels.ts';
  import type { IconName } from './ui/Icon.svelte';

  let selectedKey = $state<string | null>(null);
  const selected = $derived(devices.list.find((d) => d.key === selectedKey) ?? devices.list[0]);

  onMount(() => {
    // Dev-only design preview with fake devices; tree-shaken from production builds.
    if (import.meta.env.DEV && location.search.includes('preview')) void import('./dev/preview.ts').then((m) => m.load(location.search));
    else void devices.start();
  });

  async function add(mode: 'supported' | 'any') {
    const before = devices.list.length;
    await devices.request(mode);
    if (devices.list.length > before) selectedKey = devices.list[devices.list.length - 1]!.key;
  }

  function railState(d: UdbDevice): { word: string; icon: IconName; tone: string } {
    if (d.presence === 'disconnected') return { word: 'Disconnected', icon: 'unplug', tone: 'muted' };
    if (d.presence === 'busy') return { word: 'In use by another app', icon: 'busy', tone: 'signal' };
    if (!d.match) return { word: 'Unsupported', icon: 'blocked', tone: 'muted' };
    const icon = CONNECTION_ICON[d.match.identity.connection];
    if (d.match.identity.byCollection) return { word: 'Protocol not checked', icon, tone: 'signal' };
    if (!d.match.modelConfirmed) return { word: 'Model not confirmed', icon, tone: 'signal' };
    return { word: 'Detected', icon, tone: 'confirmed' };
  }
</script>

<div class="shell">
  <header class="top">
    <p class="mark">
      <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 12V6M12 12v6M17 12V6" /></svg>
      <strong>UDB</strong><span>Universal Driver Bus</span>
    </p>
    {#if devices.hid && devices.list.length > 0}
      <div class="top-actions">
        <button class="btn quiet" onclick={() => add('any')}>Identify another device</button>
        <button class="btn primary" onclick={() => add('supported')}><Icon name="plus" />Add device</button>
      </div>
    {/if}
  </header>

  {#if devices.outcome.kind !== 'idle'}
    <div class="outcome" role="status">
      <Icon name="alert" size={18} />
      {#if devices.outcome.kind === 'cancelled'}
        <p>
          No device was selected. UDB only sees devices you pick in the browser's list. Check the device is plugged in
          and awake, then try again.
        </p>
      {:else}
        <p>The browser refused the request: {devices.outcome.message}</p>
      {/if}
    </div>
  {/if}

  {#if !devices.hid || devices.list.length === 0}
    <main class="empty">
      <div class="empty-stage" aria-hidden="true">
        <span class="piece keyboard"><DeviceArt kind="keyboard" alt="" /></span>
        <span class="piece mouse"><DeviceArt kind="mouse" alt="" /></span>
        <span class="piece headset"><DeviceArt kind="headset" alt="" /></span>
      </div>
      {#if !devices.hid}
        <h1>UDB can't reach devices from this browser</h1>
        {#if !devices.secure}
          <p>
            WebHID only works on secure pages. Open UDB over <span class="data">https://</span> or from
            <span class="data">localhost</span>.
          </p>
        {:else}
          <p>
            UDB uses WebHID, which only Chromium browsers on desktop provide. Open this page in Chrome or Edge on Windows,
            macOS or Linux.
          </p>
        {/if}
      {:else}
        <h1>Add your first device</h1>
        <p>
          Your browser shows a list of matching mice, keyboards and headsets. Pick one to give UDB access to it. Granting
          access changes nothing on the device, and UDB remembers it for next time.
        </p>
        <div class="empty-actions">
          <button class="btn primary big" onclick={() => add('supported')}><Icon name="plus" />Add device</button>
          <button class="btn quiet" onclick={() => add('any')}>My device isn't listed</button>
        </div>
        <p class="hint">
          A vendor app that's running can hide or hold a device. If yours is missing, close it and try again.
        </p>
      {/if}
    </main>
  {:else}
    <div class="workspace">
      <nav class="dock" aria-label="Devices">
        <ul>
          {#each devices.list as d (d.key)}
            {@const s = railState(d)}
            <li>
              <button
                class="device"
                class:current={d.key === selected?.key}
                class:away={d.presence === 'disconnected'}
                aria-current={d.key === selected?.key ? 'true' : undefined}
                onclick={() => (selectedKey = d.key)}
              >
                <span class="thumb"><DeviceArt entryId={d.match?.entry.id} kind={d.match?.entry.category} alt="" /></span>
                <span class="device-text">
                  <span class="device-name">{devices.label(d)}</span>
                  <span class="device-state {s.tone}"><Icon name={s.icon} size={14} />{s.word}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </nav>
      <main class="detail">
        {#if selected}
          {#key selected.key}<DevicePane device={selected} />{/key}
        {/if}
      </main>
    </div>
  {/if}

  <footer class="foot">
    <p>Nothing is uploaded. UDB runs entirely in this browser.</p>
    <p>
      <a href="https://github.com/E1yWrites/udb/blob/main/SUPPORT.md" target="_blank" rel="noreferrer">Support matrix</a>
      · <a href="https://github.com/E1yWrites/udb/tree/{__COMMIT__}" target="_blank" rel="noreferrer">Source of this build (AGPL-3.0)</a>
      · Product images belong to their makers
    </p>
  </footer>

  <p class="visually-hidden" aria-live="polite">{devices.announcement}</p>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Translucent chrome: content scrolls under it. */
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 3.75rem;
    padding: var(--space-2) clamp(var(--space-4), 3vw, var(--space-8));
    background: var(--chrome);
    backdrop-filter: blur(20px) saturate(160%);
    border-bottom: 1px solid color-mix(in oklch, var(--line) 70%, transparent);
  }

  @media (prefers-reduced-transparency: reduce) {
    .top {
      background: var(--bg);
      backdrop-filter: none;
    }
  }

  .mark {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .glyph {
    width: 1.5rem;
    height: 1.5rem;
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.25;
    stroke-linecap: round;
  }

  .mark strong {
    font: 750 var(--step-1) / 1 var(--font-display);
    letter-spacing: 0.06em;
  }

  .mark span {
    margin-left: var(--space-1);
    font-size: var(--step--1);
    color: var(--muted);
  }

  .top-actions {
    display: flex;
    gap: var(--space-2);
  }

  .outcome {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-8));
    background: color-mix(in srgb, var(--signal) 10%, var(--bg));
    border-bottom: 1px solid color-mix(in oklch, var(--signal) 30%, transparent);
  }

  .outcome :global(svg) {
    color: var(--signal);
    margin-top: 0.15em;
  }

  .outcome p {
    max-width: 75ch;
  }

  /* Empty state: the stage waits for a device. */
  .empty {
    flex: 1;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: var(--space-4);
    padding: var(--space-8) var(--space-4) var(--space-12);
    text-align: center;
    background: radial-gradient(60rem 28rem at 50% 30%, var(--stage-light), transparent 70%);
  }

  .empty-stage {
    position: relative;
    width: min(34rem, 100%);
    aspect-ratio: 2 / 1;
    margin-bottom: var(--space-4);
  }

  .piece {
    position: absolute;
    animation: rise 900ms var(--ease-out) both;
  }

  .piece.keyboard {
    left: 4%;
    top: 22%;
    width: 58%;
    aspect-ratio: 1;
  }

  .piece.mouse {
    left: 60%;
    top: 34%;
    width: 22%;
    aspect-ratio: 1;
    animation-delay: 90ms;
  }

  .piece.headset {
    left: 74%;
    top: -2%;
    width: 26%;
    aspect-ratio: 1;
    animation-delay: 180ms;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  .empty h1 {
    font: 700 var(--step-4) / 1.05 var(--font-display);
    letter-spacing: -0.03em;
    text-wrap: balance;
    max-width: 18ch;
  }

  .empty p {
    color: var(--muted);
    max-width: 58ch;
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .btn.big {
    min-height: 3rem;
    padding: 0 var(--space-6);
    font-size: var(--step-1);
  }

  .hint {
    font-size: var(--step--1);
    margin-top: var(--space-4);
  }

  .workspace {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr);
  }

  /* Device dock: one tile per granted device, product image first. */
  .dock {
    min-width: 0;
    background: var(--rail);
    border-right: 1px solid var(--line);
    padding: var(--space-4) var(--space-3);
  }

  .dock ul {
    position: sticky;
    top: 4.75rem;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .device {
    width: 100%;
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr);
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 160ms var(--ease-out),
      border-color 160ms var(--ease-out),
      transform 100ms var(--ease-out);
  }

  .device:hover {
    background: var(--surface);
  }

  .device:active {
    transform: scale(0.98);
  }

  .device.current {
    background: var(--surface);
    border-color: color-mix(in oklch, var(--accent) 55%, transparent);
    box-shadow: 0 6px 18px -10px oklch(0 0 0 / 0.6);
  }

  .thumb {
    display: block;
    width: 3.5rem;
    height: 3.5rem;
    padding: var(--space-1);
    border-radius: var(--radius);
    background: radial-gradient(circle at 50% 40%, color-mix(in oklch, var(--accent) 14%, var(--raised)), var(--raised) 70%);
  }

  .away .thumb {
    opacity: 0.45;
    filter: grayscale(1);
  }

  .device-text {
    display: grid;
    min-width: 0;
  }

  .device-name {
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .device-state {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-size: var(--step--1);
  }

  .signal {
    color: var(--signal);
  }

  .confirmed {
    color: var(--confirmed);
  }

  .muted {
    color: var(--muted);
  }

  .detail {
    min-width: 0;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2) var(--space-6);
    padding: var(--space-4) clamp(var(--space-4), 3vw, var(--space-8));
    border-top: 1px solid var(--line);
    font-size: var(--step--1);
    color: var(--faint);
  }

  @media (max-width: 48rem) {
    .mark span {
      display: none;
    }

    .top-actions .quiet {
      padding: 0 var(--space-2);
    }

    .workspace {
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
    }

    .dock {
      border-right: 0;
      border-bottom: 1px solid var(--line);
      padding: var(--space-2);
    }

    .dock ul {
      position: static;
      grid-auto-flow: column;
      grid-auto-columns: minmax(13rem, 1fr);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
    }

    .dock li {
      scroll-snap-align: start;
    }
  }
</style>
