<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import DevicePane from './ui/DevicePane.svelte';
  import DeviceArt from './ui/DeviceArt.svelte';
  import ThemeSwitch from './ui/ThemeSwitch.svelte';
  import Home from './ui/Home.svelte';
  import Guide from './ui/Guide.svelte';
  import SupportedList from './ui/SupportedList.svelte';
  import ProfileLibrary from './ui/ProfileLibrary.svelte';
  import { devices } from './lib/devices.svelte.ts';
  import { deviceState } from './lib/labels.ts';

  // Views live in the URL hash so Back works: #/ (Home), #/device/<key>, #/supported, #/profiles.
  type View = { name: 'home' } | { name: 'device'; key: string } | { name: 'supported' } | { name: 'profiles' };

  function parse(hash: string): View {
    if (hash.startsWith('#/device/')) return { name: 'device', key: decodeURIComponent(hash.slice(9)) };
    if (hash === '#/supported') return { name: 'supported' };
    if (hash === '#/profiles') return { name: 'profiles' };
    return { name: 'home' };
  }

  // UDB always lands on Home, even when reloaded on a device.
  if (parse(location.hash).name === 'device') history.replaceState(null, '', '#/');
  let view = $state<View>(parse(location.hash));
  const selected = $derived(view.name === 'device' ? devices.list.find((d) => d.key === (view as { key: string }).key) : undefined);
  /** Set when a device was opened from Home in this page, so closing can go Back instead of adding a history entry. */
  let pushed = false;

  onMount(() => {
    // Dev-only design preview with fake devices; tree-shaken from production builds.
    if (import.meta.env.DEV && location.search.includes('preview')) void import('./dev/preview.ts').then((m) => m.load(location.search));
    else void devices.start();
    const onHash = async () => {
      const before = view;
      view = parse(location.hash);
      if (view.name !== 'device') pushed = false;
      await tick();
      // Focus follows the view: the device's heading when it opens, its card when it closes.
      if (view.name === 'device') document.getElementById('device-title')?.focus();
      else if (view.name === 'home' && before.name === 'device') document.querySelector<HTMLElement>(`.home [data-key="${CSS.escape(before.key)}"]`)?.focus();
      else document.querySelector<HTMLElement>('main h1')?.focus();
      if (before.name !== view.name) scrollTo({ top: 0 });
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  const deviceHash = (key: string) => `#/device/${encodeURIComponent(key)}`;

  function open(key: string) {
    if (view.name === 'device') return location.replace(deviceHash(key));
    pushed = true;
    location.hash = deviceHash(key);
  }

  function close() {
    if (pushed) history.back();
    else location.hash = '#/';
  }

  async function add(mode: 'supported' | 'any') {
    const before = devices.list.length;
    await devices.request(mode);
    if (devices.list.length > before) open(devices.list[devices.list.length - 1]!.key);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || view.name !== 'device' || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, select, textarea, [contenteditable], dialog')) return;
    close();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="shell">
  <header class="top">
    <a class="mark" href="#/" aria-label="UDB, Universal Driver Bus: Home">
      <img class="glyph" src="./icons/icon-192.png" alt="" width="36" height="36" />
      <strong>UDB</strong><span>Universal Driver Bus</span>
    </a>
    {#if view.name === 'device' && devices.hid}
      <div class="top-actions">
        <button class="btn quiet" onclick={() => add('any')}>Identify another device</button>
        <button class="btn primary" onclick={() => add('supported')}><Icon name="plus" />Add device</button>
      </div>
    {/if}
    <div class="theme"><ThemeSwitch compact /></div>
  </header>

  {#if devices.outcome.kind !== 'idle'}
    <div class="outcome" role="status">
      <Guide tone="worried" tip={false} size={44}>
        {#if devices.outcome.kind === 'cancelled'}
          <p>
            No device was picked. UDB only sees devices you choose in the browser's list. Check the device is plugged in
            and awake, then try again.
          </p>
        {:else}
          <p>The browser refused the request: {devices.outcome.message}</p>
        {/if}
      </Guide>
    </div>
  {/if}

  {#if view.name === 'supported'}
    <SupportedList />
  {:else if view.name === 'profiles'}
    <ProfileLibrary />
  {:else if view.name === 'device' && selected}
    <div class="workspace">
      <nav class="dock" aria-label="Devices">
        <ul>
          {#each devices.list as d (d.key)}
            {@const s = deviceState(d)}
            <li>
              <button
                class="device"
                class:current={d.key === selected.key}
                class:away={d.presence === 'disconnected'}
                aria-current={d.key === selected.key ? 'true' : undefined}
                onclick={() => open(d.key)}
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
        <button class="btn quiet close" onclick={close} title="Close (Esc)" aria-label="Close {devices.label(selected)} and go to Home">
          <Icon name="close" />Close
        </button>
        {#key selected.key}<DevicePane device={selected} />{/key}
      </main>
    </div>
  {:else}
    <Home onopen={open} onadd={add} />
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
    text-decoration: none;
    border-radius: var(--radius);
  }

  .glyph {
    width: 2.25rem;
    height: 2.25rem;
  }

  .mark strong {
    font: 650 var(--step-2) / 1 var(--font-brand);
    letter-spacing: 0.02em;
    color: var(--accent);
  }

  .mark span {
    margin-left: var(--space-1);
    font-size: var(--step--1);
    color: var(--muted);
  }

  .top-actions {
    display: flex;
    gap: var(--space-2);
    margin-left: auto;
  }

  .theme {
    display: flex;
  }

  .outcome {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-8));
    border-bottom: 1px solid var(--line);
    transition:
      opacity 240ms var(--ease-out),
      transform 240ms var(--ease-out);
  }

  /* It drops in from under the top bar instead of popping. */
  @starting-style {
    .outcome {
      opacity: 0;
      transform: translateY(-8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .outcome {
      transform: none;
      transition: opacity 150ms ease-out !important;
    }
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
    background: color-mix(in srgb, var(--yellow) 9%, var(--surface));
    border-color: color-mix(in srgb, var(--yellow) 70%, transparent);
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
    position: relative;
    min-width: 0;
  }

  .close {
    position: absolute;
    top: var(--space-4);
    right: clamp(var(--space-4), 4vw, var(--space-12));
    z-index: 1;
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

    /* Wordmark and theme on the first row, the device actions under them. */
    .theme {
      order: 1;
      margin-left: auto;
    }

    .top-actions {
      order: 2;
      flex-basis: 100%;
      justify-content: space-between;
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
