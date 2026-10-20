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
  import Landing from './ui/Landing.svelte';
  import InfoPage from './ui/InfoPage.svelte';
  import { prefs, noteAppSeen } from './lib/prefs.svelte.ts';
  import { devices } from './lib/devices.svelte.ts';
  import { deviceState } from './lib/labels.ts';

  // `url` is set when rendering on the server (src/prerender.ts); the browser reads location.
  let { url }: { url?: string } = $props();

  // The public pages are real paths, prerendered for search engines: / (the landing),
  // /terms/ and /contact/. The app lives behind hashes on / so Back works:
  // #/app (Home), #/device/<key>, #/supported, #/profiles.
  type View =
    | { name: 'landing' | 'home' | 'supported' | 'profiles' | 'terms' | 'contact' | 'missing' }
    | { name: 'device'; key: string };
  type Page = Exclude<View['name'], 'device'>;
  const PATHS: Record<string, Page> = { '/terms/': 'terms', '/contact/': 'contact' };
  const PAGES: Record<string, Page> = { '#/app': 'home', '#/supported': 'supported', '#/profiles': 'profiles', '#/terms': 'terms', '#/contact': 'contact' };
  /** The public pages' old hash routes, replaced by their paths. */
  const MOVED: Record<string, string> = { '#/terms': '/terms/', '#/contact': '/contact/' };

  function parse(path: string, hash: string): View {
    const p = path.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');
    if (p !== '/') return { name: PATHS[p] ?? 'missing' };
    if (hash.startsWith('#/device/')) return { name: 'device', key: decodeURIComponent(hash.slice(9)) };
    if (hash === '' || hash === '#' || hash === '#/') return { name: 'landing' };
    // In-page anchors on the landing (#how, #compatible) aren't routes.
    if (!hash.startsWith('#/')) return { name: 'landing' };
    return { name: PAGES[hash] ?? 'missing' };
  }

  const here = () => parse(url ?? location.pathname, url ? '' : location.hash);
  // svelte-ignore state_referenced_locally
  if (!url) {
    if (location.pathname === '/' && MOVED[location.hash]) location.replace(MOVED[location.hash]!);
    // A reload on a device lands on Home; someone who has used the app skips the landing.
    else if (here().name === 'device' || (location.pathname === '/' && location.hash === '' && prefs.appSeen)) history.replaceState(null, '', '#/app');
  }
  let view = $state<View>(here());
  const selected = $derived(view.name === 'device' ? devices.list.find((d) => d.key === (view as { key: string }).key) : undefined);
  /** Set when a device was opened from Home in this page, so closing can go Back instead of adding a history entry. */
  let pushed = false;
  /** Where the Supported and Profiles pages go back to: the cover when opened from it, else the app's Home. */
  let backTo = $state(here().name === 'landing' ? '/#/' : '/#/app');

  onMount(() => {
    // Dev-only design preview with fake devices; tree-shaken from production builds.
    if (import.meta.env.DEV && location.search.includes('preview')) void import('./dev/preview.ts').then((m) => m.load(location.search));
    else void devices.start();
    const onHash = async () => {
      if (location.pathname === '/' && MOVED[location.hash]) return location.replace(MOVED[location.hash]!);
      const before = view;
      view = here();
      if (view.name === 'supported' || view.name === 'profiles') {
        if (before.name !== 'supported' && before.name !== 'profiles') backTo = before.name === 'landing' ? '/#/' : '/#/app';
      }
      // A request's notice belongs to the page it was made on.
      if (before.name !== view.name) devices.outcome = { kind: 'idle' };
      if (view.name !== 'device') pushed = false;
      // An in-page anchor (#how): show the landing, then scroll to the section.
      if (!location.hash.startsWith('#/') && location.hash.length > 1) {
        await tick();
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
        return;
      }
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
    else location.hash = '#/app';
  }

  const APP = new Set(['home', 'device', 'supported', 'profiles']);
  const inApp = $derived(APP.has(view.name));
  $effect(() => {
    if (view.name === 'home' || view.name === 'device') noteAppSeen();
  });

  async function add(mode: 'supported' | 'any') {
    const before = devices.list.length;
    await devices.request(mode);
    if (devices.list.length > before) open(devices.list[devices.list.length - 1]!.key);
  }

  const CATEGORY: Record<string, string> = { mouse: 'Mouse', keyboard: 'Keyboard', headset: 'Headset' };

  // Esc closes the device; ← and → step to its neighbours. Never while a control,
  // the tab list or a radio group owns the keys.
  function onkey(e: KeyboardEvent) {
    if (view.name !== 'device' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, select, textarea, [contenteditable], dialog')) return;
    if (e.key === 'Escape') return close();
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (t?.closest('[role=tablist], [role=radiogroup]')) return;
    const list = devices.list;
    const to = list[list.findIndex((d) => d.key === (view as { key: string }).key) + (e.key === 'ArrowLeft' ? -1 : 1)];
    if (!to) return;
    e.preventDefault();
    open(to.key);
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="shell">
  <header class="top">
    <a class="mark" href="/#/" aria-label="UDB, Universal Driver Bus: the cover">
      <img class="glyph" src="/icons/icon-192.png" alt="" width="36" height="36" />
      <strong>UDB</strong><span>Universal Driver Bus</span>
    </a>
    {#if !inApp}
      <nav class="site" aria-label="Site">
        <a href="/#how">How it works</a>
        <a href="/#/supported">Compatible devices</a>
        <a href="https://github.com/E1yWrites/udb" target="_blank" rel="noreferrer">GitHub</a>
        <a class="btn primary" href="/#/app">Open UDB</a>
      </nav>
    {/if}
    {#if view.name === 'device'}
      <div class="top-actions">
        {#if devices.hid}
          <button class="btn quiet" onclick={() => add('any')}>Identify another device</button>
          <button class="btn primary" onclick={() => add('supported')}><Icon name="plus" />Add device</button>
        {/if}
        {#if selected}
          <button class="btn close" onclick={close} title="Close (Esc)" aria-label="Close {devices.label(selected)} and go to Home">
            <Icon name="close" /><span class="close-word">Close</span>
          </button>
        {/if}
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
      <button class="btn quiet dismiss" onclick={() => (devices.outcome = { kind: 'idle' })} aria-label="Dismiss this notice"><Icon name="close" /></button>
    </div>
  {/if}

  {#if view.name === 'landing'}
    <Landing onadd={add} />
  {:else if view.name === 'terms' || view.name === 'contact' || view.name === 'missing'}
    <InfoPage kind={view.name} />
  {:else if view.name === 'supported'}
    <SupportedList back={backTo} />
  {:else if view.name === 'profiles'}
    <ProfileLibrary back={backTo} />
  {:else if view.name === 'device' && selected}
    {@const i = devices.list.indexOf(selected)}
    <div class="workspace">
      <main class="detail">
        {#key selected.key}
          <DevicePane
            device={selected}
            prev={devices.list[i - 1]}
            next={devices.list[i + 1]}
            position="{CATEGORY[selected.match?.entry.category ?? ''] ?? 'Device'} · {i + 1} of {devices.list.length}"
            onstep={(d) => open(d.key)}
          />
        {/key}
      </main>
      <!-- The device dock: the band again, every granted device as a pill; the open one is yellow. -->
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
                <span class="device-name">{devices.label(d)}</span>
                {#if s.tone !== 'confirmed'}<span class="device-state {s.tone}"><Icon name={s.icon} size={14} />{s.word}</span>{:else}<span class="visually-hidden">, {s.word}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      </nav>
    </div>
  {:else}
    <Home onopen={open} onadd={add} />
  {/if}

  <!-- The booklet's back cover: every page ends here. -->
  <footer class="foot">
    <div class="foot-mark">
      <img src="/icons/icon-192.png" alt="" width="32" height="32" />
      <p><strong>UDB</strong> · One bus. Every device.<br />Nothing is uploaded. UDB runs entirely in this browser.</p>
    </div>
    <nav aria-label="Footer">
      <a href="https://github.com/E1yWrites/udb" target="_blank" rel="noreferrer">GitHub</a>
      <a href="/terms/">Terms</a>
      <a href="/contact/">Contact</a>
      <a href="https://github.com/E1yWrites/udb/blob/main/SUPPORT.md" target="_blank" rel="noreferrer">Support matrix</a>
      <a href="https://github.com/E1yWrites/udb/tree/{__COMMIT__}" target="_blank" rel="noreferrer">Source of this build (AGPL-3.0)</a>
    </nav>
    <p class="foot-fine">Product names and images belong to their makers. UDB isn't affiliated with any of them.</p>
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
    /* The booklet's band: deep green in both themes, so the bar carries its own dark tokens. */
    color-scheme: dark;
    --text: var(--paper);
    --muted: var(--band-muted);
    --rail: #091309;
    --surface: #1c3a22;
    --raised: #24462b;
    --line: #2b4a31;
    --line-strong: #4e7354;
    --keyline: #4e7354;
    --accent: #5cc46a;
    color: var(--text);
    background: rgb(13 26 16 / 0.94);
    backdrop-filter: blur(20px) saturate(160%);
    border-bottom: 3px solid var(--cover);
  }

  .site {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-6);
    margin-left: auto;
    margin-right: var(--space-4);
  }

  .site a:not(.btn) {
    color: var(--muted);
    font-weight: 600;
    font-size: var(--step--1);
    text-decoration: none;
  }

  .site a:not(.btn):hover {
    color: var(--text);
  }

  .site .btn {
    min-height: 2.25rem;
    text-decoration: none;
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

  .outcome .dismiss {
    margin-left: auto;
    flex: none;
    padding: 0 var(--space-3);
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
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr auto;
  }

  /* The dock sits on the bottom edge: the band, a row of pills; the open device is yellow. */
  .dock {
    position: sticky;
    bottom: 0;
    z-index: 5;
    min-width: 0;
    color-scheme: dark;
    --text: var(--paper);
    --muted: var(--band-muted);
    --surface: #1c3a22;
    --signal: #ffa04d;
    --confirmed: #7fd6d0;
    --art-line: #7fa785;
    --art-fill: #1c3a22;
    background: rgb(13 26 16 / 0.94);
    backdrop-filter: blur(16px);
    border-top: 3px solid var(--cover);
    padding: var(--space-2) clamp(var(--space-4), 3vw, var(--space-8));
  }

  @media (prefers-reduced-transparency: reduce) {
    .dock {
      background: var(--band);
      backdrop-filter: none;
    }
  }

  .dock ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }

  .dock li {
    flex: none;
    scroll-snap-align: start;
  }

  .device {
    /* Contains the visually hidden state text, which would otherwise escape the dock's scroll strip. */
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 3rem;
    padding: var(--space-1) var(--space-4) var(--space-1) var(--space-1);
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    font-size: var(--step--1);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 160ms var(--ease-out),
      border-color 160ms var(--ease-out),
      transform 100ms var(--ease-out);
  }

  .device:hover {
    background: var(--surface);
    color: var(--text);
  }

  .device:active {
    transform: scale(0.97);
  }

  .device.current {
    color: var(--yellow-ink);
    background: var(--yellow);
    border-color: var(--ink);
  }

  .device.current .device-state {
    color: inherit;
  }

  /* AA on the yellow pill. */
  .device.current .signal {
    color: #8a3d00;
  }

  .thumb {
    display: block;
    width: 2.5rem;
    height: 2.5rem;
    padding: 3px;
    border-radius: 50%;
    background: var(--surface);
  }

  .away .thumb {
    opacity: 0.45;
    filter: grayscale(1);
  }

  .device-state {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
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



  /* The back cover: the band again, with every way out. */
  .foot {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4) var(--space-8);
    align-items: center;
    padding: var(--space-6) clamp(var(--space-4), 3vw, var(--space-8));
    background: var(--band);
    color: var(--band-muted);
    border-top: 3px solid var(--cover);
    font-size: var(--step--1);
  }

  .foot-mark {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .foot-mark strong {
    font: 650 1.0625rem / 1 var(--font-brand);
    color: var(--yellow);
  }

  .foot nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-6);
  }

  .foot a {
    color: var(--paper);
    font-weight: 600;
    text-decoration-color: #4e7354;
  }

  .foot-fine {
    grid-column: 1 / -1;
    color: var(--band-faint);
  }

  @media (max-width: 48rem) {
    .mark span {
      display: none;
    }

    .top-actions .quiet {
      padding: 0 var(--space-1);
    }

    .site {
      order: 2;
      flex-basis: 100%;
      margin: 0;
      justify-content: space-between;
      gap: var(--space-1) var(--space-3);
    }

    /* The in-page anchor is the one link a phone can drop; the device list and START stay. */
    .site a[href='/#how'] {
      display: none;
    }

    .foot {
      grid-template-columns: minmax(0, 1fr);
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

    /* The × and its accessible name are enough on a phone. */
    .close-word {
      display: none;
    }

    .top-actions .close {
      padding: 0 var(--space-3);
    }

  }
</style>
