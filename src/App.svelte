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
    {@const i = devices.list.indexOf(selected)}
    <div class="workspace">
      <main class="detail">
        <button class="btn quiet close" onclick={close} title="Close (Esc)" aria-label="Close {devices.label(selected)} and go to Home">
          <Icon name="close" />Close
        </button>
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
      <!-- The device dock: every granted device as a pill; the open one is yellow. -->
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
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr auto;
  }

  /* The dock sits on the bottom edge, a row of pills; the open device is yellow. */
  .dock {
    position: sticky;
    bottom: 0;
    z-index: 5;
    min-width: 0;
    background: color-mix(in srgb, var(--rail) 88%, transparent);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--line);
    padding: var(--space-2) clamp(var(--space-4), 3vw, var(--space-8));
  }

  @media (prefers-reduced-transparency: reduce) {
    .dock {
      background: var(--rail);
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
    color: var(--text);
    background: color-mix(in srgb, var(--yellow) 9%, var(--surface));
    border-color: color-mix(in srgb, var(--yellow) 75%, transparent);
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

  }
</style>
