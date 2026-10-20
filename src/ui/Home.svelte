<script lang="ts">
  // Home: where UDB lands and where closing a device returns. Dee on a lit stage
  // with the onboarding (or a greeting), your devices, and the way into the
  // supported-devices list. Nothing here talks to a device.
  import Icon from './Icon.svelte';
  import Dee from './Dee.svelte';
  import Guide from './Guide.svelte';
  import DeviceArt from './DeviceArt.svelte';
  import { devices } from '../lib/devices.svelte.ts';
  import { deviceState } from '../lib/labels.ts';
  import { registry } from '../lib/registry.ts';
  import { prefs, setGuide, setOnboarded } from '../lib/prefs.svelte.ts';
  import { browserStore, loadProfiles } from '../lib/profiles.ts';
  import { migrateV1 } from '../lib/profile-map.ts';

  let {
    onopen,
    onadd,
  }: {
    onopen: (key: string) => void;
    onadd: (mode: 'supported' | 'any') => void;
  } = $props();

  const steps = $derived([
    { done: !!devices.hid, title: 'Open UDB in Chrome or Edge on a computer' },
    { done: devices.list.length > 0, title: 'Add a device' },
    { done: prefs.sawReadBack, title: 'Read its settings' },
  ]);
  const current = $derived(steps.findIndex((s) => !s.done));
  const tone = $derived(!devices.hid ? 'worried' : current === -1 && !prefs.onboarded ? 'happy' : 'neutral');

  const counts = {
    mouse: registry.filter((e) => e.category === 'mouse').length,
    keyboard: registry.filter((e) => e.category === 'keyboard').length,
    headset: registry.filter((e) => e.category === 'headset').length,
  };
  const verified = registry.filter((e) => e.features.some((f) => f.status === 'write-verified')).length;
  const store = browserStore();
  const saved = store ? loadProfiles(store, migrateV1) : [];
  const savedCount = { mouse: saved.filter((p) => p.category === 'mouse').length, keyboard: saved.filter((p) => p.category === 'keyboard').length };

  function replay() {
    setOnboarded(false);
    document.getElementById('home-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<main class="home" aria-labelledby="home-title">
  <section class="hero">
    <div class="stage" aria-hidden="true">
      <Dee {tone} size={280} />
    </div>

    <div class="intro">
      <h1 id="home-title" tabindex="-1"><span class="page-chip">p. 1</span> Start here</h1>

      <Guide {tone} tip={false} avatar={false}>
        {#if !devices.hid}
          <p><strong>I can't reach devices from this browser.</strong></p>
          {#if !devices.secure}
            <p>
              WebHID only works on secure pages. Open UDB over <span class="data">https://</span> or from
              <span class="data">localhost</span>.
            </p>
          {:else}
            <p>UDB uses WebHID, which only Chromium browsers on desktop have. Open this page in Chrome or Edge on Windows, macOS or Linux.</p>
          {/if}
        {:else if !prefs.onboarded}
          <p>
            {current === -1 ? "That's it, you're set. Every value marked Device came from the device itself." : "Hi, I'm Dee. Three steps and you're set."}
          </p>
          <ol class="steps">
            {#each steps as s, i (s.title)}
              <li class:done={s.done} class:now={i === current}>
                <span class="mark">{#if s.done}<Icon name="check" size={14} label="Done" />{:else}<span class="dot"></span>{/if}</span>
                <span class="step">
                  <strong>{s.title}</strong>
                  {#if i === current && i === 1}
                    <span>
                      Your browser lists matching mice, keyboards and headsets. Picking one gives UDB access to it and
                      changes nothing on the device.
                    </span>
                  {:else if i === current && i === 2}
                    <span>
                      Open a device below and choose Read. Each setting then shows <span class="tag">Device</span>, the value
                      the device sent back. That's what UDB goes by, never what you asked for.
                    </span>
                  {/if}
                </span>
              </li>
            {/each}
          </ol>
          <div class="bubble-actions">
            {#if current === -1}
              <button class="btn primary" onclick={() => setOnboarded(true)}>Done</button>
            {:else}
              <button class="btn quiet" onclick={() => setOnboarded(true)}>Skip the tour</button>
            {/if}
          </div>
        {:else if devices.list.length === 0}
          <p>Add your first device and I'll show you what it reports. Granting access changes nothing on it.</p>
        {:else}
          <p>Pick a device to open it. UDB sends nothing to a device until you ask it to read.</p>
        {/if}
      </Guide>

      {#if devices.hid}
        <div class="hero-actions">
          <button class="btn primary big" onclick={() => onadd('supported')}><Icon name="plus" />Add device</button>
          <button class="btn quiet" onclick={() => onadd('any')}>My device isn't listed</button>
        </div>
        <p class="hint">A vendor app that's running can hide or hold a device. If yours is missing, close it and try again.</p>
      {/if}
    </div>
  </section>

  {#if devices.list.length > 0}
    <section class="block" aria-labelledby="your-devices">
      <h2 id="your-devices">Your devices</h2>
      <ul class="cards">
        {#each devices.list as d (d.key)}
          {@const s = deviceState(d)}
          <li>
            <button class="card" class:away={d.presence === 'disconnected'} data-key={d.key} onclick={() => onopen(d.key)}>
              <span class="card-art"><DeviceArt entryId={d.match?.entry.id} kind={d.match?.entry.category} alt="" /></span>
              <span class="card-name">{devices.label(d)}</span>
              <span class="card-state {s.tone}"><Icon name={s.icon} size={14} />{s.word}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="block" aria-labelledby="more">
    <h2 id="more" class="visually-hidden">More</h2>
    <div class="more">
      <a class="tile" href="#/supported">
        <span class="tile-art" aria-hidden="true">
          <span><DeviceArt kind="keyboard" alt="" /></span>
          <span><DeviceArt kind="mouse" alt="" /></span>
          <span><DeviceArt kind="headset" alt="" /></span>
        </span>
        <span class="tile-text">
          <strong>Supported devices</strong>
          <span>
            {registry.length} models UDB recognises: <span class="num">{counts.mouse}</span> mice,
            <span class="num">{counts.keyboard}</span> keyboards, <span class="num">{counts.headset}</span> headsets.
            {verified === 0 ? 'None is verified on real hardware yet.' : `${verified} verified on real hardware.`}
          </span>
        </span>
        <Icon name="chevron" size={18} />
      </a>
      <a class="tile" href="#/profiles">
        <span class="tile-art swatches" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="tile-text">
          <strong>Profiles</strong>
          <span>
            {#if saved.length}
              <span class="num">{savedCount.mouse}</span> mouse and <span class="num">{savedCount.keyboard}</span> keyboard
              {saved.length === 1 ? 'profile' : 'profiles'} in this browser. Make, edit, import and export them here.
            {:else}
              DPI stages, polling rate, colour and brightness, saved once and applied to any mouse or keyboard UDB can write.
            {/if}
          </span>
        </span>
        <Icon name="chevron" size={18} />
      </a>
    </div>
  </section>

  <section class="block prefs" aria-labelledby="prefs-h">
    <h2 id="prefs-h">Settings</h2>
    <label class="toggle">
      <input type="checkbox" role="switch" checked={prefs.guideOn} onchange={(e) => setGuide(e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"></span>
      <span>Dee's tips beside controls, profiles and diagnostics</span>
    </label>
    <button class="btn quiet" onclick={replay}>Replay the tour</button>
    <p class="note">The theme switch is in the top bar. Settings are kept in this browser only.</p>
  </section>
</main>

<style>
  .home {
    flex: 1;
    width: 100%;
    max-width: 76rem;
    margin: 0 auto;
    display: grid;
    align-content: start;
    gap: var(--space-12);
    padding: var(--space-8) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
  }

  /* Dee on a lit stage beside the wordmark and the bubble. */
  .hero {
    display: grid;
    grid-template-columns: minmax(14rem, 0.8fr) minmax(0, 1.2fr);
    gap: var(--space-6) clamp(var(--space-6), 5vw, var(--space-12));
    align-items: center;
  }

  .stage {
    display: grid;
    place-items: end center;
    min-height: 22rem;
    padding-bottom: var(--space-6);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(60% 50% at 50% 46%, color-mix(in srgb, var(--yellow) 22%, transparent), transparent 72%),
      radial-gradient(70% 60% at 50% 40%, var(--stage-light), transparent 75%),
      radial-gradient(38% 7% at 50% 93%, var(--stage-floor), transparent 100%);
    animation: enter var(--spring-time) var(--spring) both;
  }

  @keyframes enter {
    from {
      opacity: 0;
      filter: blur(10px);
      transform: translateY(12px) scale(0.96);
    }
  }

  .intro {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font: 700 var(--step-4) / 1 var(--font-brand);
    letter-spacing: -0.01em;
  }

  .steps {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .steps li {
    display: grid;
    grid-template-columns: 1.25rem minmax(0, 1fr);
    gap: var(--space-2);
    color: var(--faint);
  }

  .steps li.now,
  .steps li.done {
    color: var(--text);
  }

  .steps .mark {
    display: grid;
    place-items: center;
    height: 1.5em;
  }

  .steps .done .mark {
    color: var(--confirmed);
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    border: 1.5px solid currentColor;
  }

  .now .dot {
    background: var(--yellow);
    border-color: color-mix(in srgb, var(--ink) 60%, var(--yellow));
  }

  .step {
    display: grid;
    gap: var(--space-1);
  }

  .step > span {
    color: var(--muted);
    transition: opacity 200ms var(--ease-out);
  }

  /* A finished step's tick lands on the spring; the next step's text fades in. */
  .steps .done .mark :global(svg) {
    transition:
      transform var(--spring-time) var(--spring),
      opacity 200ms var(--ease-out);
  }

  @starting-style {
    .steps .done .mark :global(svg) {
      transform: scale(0.6);
      opacity: 0;
    }

    .step > span {
      opacity: 0;
    }
  }

  .done .step strong {
    font-weight: 500;
  }

  .bubble-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .btn.big {
    min-height: 3rem;
    padding: 0 var(--space-6);
    font-size: var(--step-1);
  }

  .hint,
  .note {
    font-size: var(--step--1);
    color: var(--faint);
    max-width: 60ch;
  }

  .block {
    display: grid;
    gap: var(--space-4);
  }

  h2 {
    font: 600 var(--step-2) / 1.2 var(--font-brand);
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
    gap: var(--space-3);
  }

  .card {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-3) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 160ms var(--ease-out),
      background-color 160ms var(--ease-out),
      transform 100ms var(--ease-out);
  }

  .card:hover {
    border-color: color-mix(in srgb, var(--yellow) 70%, transparent);
    background: color-mix(in srgb, var(--yellow) 6%, var(--surface));
  }

  .card:active {
    transform: scale(0.98);
  }

  .card-art {
    display: block;
    height: 8.5rem;
    margin-bottom: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: radial-gradient(70% 70% at 50% 45%, var(--stage-light), transparent 75%), var(--rail);
  }

  .away .card-art {
    opacity: 0.45;
    filter: grayscale(1);
  }

  .card-name {
    font-weight: 650;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .card-state {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-size: var(--step--1);
    align-self: start;
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

  .tile {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-4) var(--space-6) var(--space-4) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-decoration: none;
    color: var(--muted);
    transition:
      border-color 160ms var(--ease-out),
      background-color 160ms var(--ease-out);
  }

  .tile:hover {
    border-color: color-mix(in oklch, var(--accent) 60%, transparent);
    background: color-mix(in oklch, var(--accent) 5%, var(--surface));
  }

  .tile-art {
    display: grid;
    grid-template-columns: 3.5rem 2rem 2.25rem;
    align-items: center;
    gap: var(--space-1);
  }

  .tile-art > span {
    display: block;
    aspect-ratio: 1;
  }

  .more {
    display: grid;
    gap: var(--space-3);
  }

  /* Profiles: three overlapping colour dots, brand first. */
  .swatches {
    grid-template-columns: repeat(3, 1.75rem);
    gap: 0;
    padding-right: 1.25rem;
  }

  .swatches > span {
    width: 2.6rem;
    border-radius: 50%;
    border: 2px solid var(--surface);
  }

  .swatches > span:nth-child(1) {
    background: var(--accent);
  }

  .swatches > span:nth-child(2) {
    background: var(--yellow);
  }

  .swatches > span:nth-child(3) {
    background: color-mix(in srgb, var(--accent) 55%, var(--ink));
  }

  .tile-text {
    display: grid;
    gap: var(--space-1);
  }

  .tile-text strong {
    font: 600 var(--step-1) / 1.2 var(--font-brand);
    color: var(--text);
  }

  .tile :global(svg:last-child) {
    color: var(--accent);
  }

  .prefs {
    justify-items: start;
    gap: var(--space-3);
    padding-top: var(--space-6);
    border-top: 1px solid var(--line);
  }

  .prefs h2 {
    font-size: var(--step-1);
  }

  /* A checkbox drawn as a switch; the real input stays focusable on top. */
  .toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
  }

  .toggle input {
    position: absolute;
    left: 0;
    width: 2.5rem;
    height: 1.5rem;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }

  .track {
    position: relative;
    flex: none;
    width: 2.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--line-strong);
    transition: background-color 160ms var(--ease-out);
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(1.5rem - 6px);
    height: calc(1.5rem - 6px);
    border-radius: 50%;
    background: var(--muted);
    transition: transform 200ms var(--spring);
  }

  .toggle input:checked + .track {
    background: var(--accent);
    border-color: var(--accent);
  }

  .toggle input:checked + .track::after {
    transform: translateX(1rem);
    background: var(--accent-ink);
  }

  .toggle input:focus-visible + .track {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (max-width: 52rem) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }

    .stage {
      min-height: 0;
      height: 14rem;
    }

    .stage :global(.dee) {
      --size: 180px !important;
    }

    .card-art {
      height: 6rem;
    }

    .tile {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: var(--space-4);
    }

    .tile-art {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage {
      animation: fade 200ms ease-out both !important;
    }

    .steps .done .mark :global(svg) {
      transform: none;
      transition: opacity 150ms ease-out !important;
    }

    .step > span {
      transition: opacity 150ms ease-out !important;
    }

    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
