<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import DevicePane from './ui/DevicePane.svelte';
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
    if (!d.match.modelConfirmed) return { word: 'Model not confirmed', icon, tone: 'signal' };
    return { word: 'Detected', icon, tone: 'confirmed' };
  }
</script>

<div class="shell">
  <header class="top">
    <p class="mark"><strong>UDB</strong><span>Universal Driver Bus</span></p>
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

  {#if !devices.hid}
    <main class="empty">
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
    </main>
  {:else if devices.list.length === 0}
    <main class="empty">
      <h1>Add your first device</h1>
      <p>
        Your browser shows a list of matching mice, keyboards and headsets. Pick one to give UDB access to it. Granting
        access changes nothing on the device, and UDB remembers it for next time.
      </p>
      <div class="empty-actions">
        <button class="btn primary" onclick={() => add('supported')}><Icon name="plus" />Add device</button>
        <button class="btn quiet" onclick={() => add('any')}>My device isn't listed</button>
      </div>
      <p class="hint">
        A vendor app that's running can hide or hold a device. If yours is missing, close it and try again.
      </p>
    </main>
  {:else}
    <div class="workspace">
      <nav class="rail" aria-label="Devices">
        <ul>
          {#each devices.list as d (d.key)}
            {@const s = railState(d)}
            <li>
              <button
                class="device"
                class:current={d.key === selected?.key}
                aria-current={d.key === selected?.key ? 'true' : undefined}
                onclick={() => (selectedKey = d.key)}
              >
                <span class="device-icon {s.tone}"><Icon name={s.icon} size={18} /></span>
                <span class="device-text">
                  <span class="device-name">{devices.label(d)}</span>
                  <span class="device-state {s.tone}">{s.word}</span>
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
      · <a href="https://github.com/E1yWrites/udb" target="_blank" rel="noreferrer">Source (GPL-3.0)</a>
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

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-8));
    border-bottom: 1px solid var(--line);
  }

  .mark {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .mark strong {
    font: 700 var(--step-1) / 1 var(--font-display);
    letter-spacing: 0.04em;
  }

  .mark span {
    font-size: var(--step--1);
    color: var(--muted);
  }

  .top-actions {
    display: flex;
    gap: var(--space-2);
  }

  .btn.quiet {
    border-color: transparent;
    color: var(--muted);
    font-weight: 500;
  }

  .btn.quiet:hover {
    color: var(--text);
    border-color: var(--line);
  }

  .outcome {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-8));
    border-bottom: 1px solid var(--line);
    color: var(--text);
  }

  .outcome :global(svg) {
    color: var(--signal);
    margin-top: 0.15em;
  }

  .outcome p {
    max-width: 75ch;
  }

  .empty {
    flex: 1;
    align-self: center;
    align-content: center;
    display: grid;
    gap: var(--space-4);
    max-width: 38rem;
    padding: var(--space-12) var(--space-4);
  }

  .empty h1 {
    font: 600 var(--step-3) / 1.15 var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .empty p {
    color: var(--muted);
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .hint {
    font-size: var(--step--1);
    border-top: 1px solid var(--line);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
  }

  .workspace {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr);
  }

  .rail {
    min-width: 0;
    background: var(--rail);
    border-right: 1px solid var(--line);
    padding: var(--space-4) var(--space-2);
  }

  .rail ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .device {
    width: 100%;
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color 160ms var(--ease-out), border-color 160ms var(--ease-out);
  }

  .device:hover {
    background: var(--raised);
  }

  .device.current {
    background: var(--raised);
    border-color: var(--line-strong);
  }

  .device-icon {
    margin-top: 0.1em;
  }

  .device-text {
    display: grid;
    min-width: 0;
  }

  .device-name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .device-state {
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

    .workspace {
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
    }

    .rail {
      border-right: 0;
      border-bottom: 1px solid var(--line);
      padding: var(--space-2);
    }

    .rail ul {
      grid-auto-flow: column;
      grid-auto-columns: minmax(12rem, 1fr);
      overflow-x: auto;
    }
  }
</style>
