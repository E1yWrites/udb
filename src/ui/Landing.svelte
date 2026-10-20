<script lang="ts">
  // The public landing page, set as UDB's own instruction booklet: the cover
  // (with START, the real permission request), then its spreads. Every count
  // comes from the registry; nothing here talks to a device until START.
  import Icon from './Icon.svelte';
  import DeviceArt from './DeviceArt.svelte';
  import { devices } from '../lib/devices.svelte.ts';
  import { registry, type FeatureStatus } from '../lib/registry.ts';

  let { onadd }: { onadd: (mode: 'supported' | 'any') => void } = $props();

  const has = (s: FeatureStatus) => registry.filter((e) => e.features.some((f) => f.status === s)).length;
  const verified = has('write-verified');
  const unverified = registry.filter((e) => !e.features.some((f) => f.status === 'write-verified') && e.features.some((f) => f.status === 'experimental')).length;
  const recognised = registry.length - verified - unverified;
  const byCategory = (c: string) => registry.filter((e) => e.category === c).length;
  const brands = Object.entries(
    registry.reduce<Record<string, number>>((m, e) => ((m[e.vendor] = (m[e.vendor] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1]);

  // Shelf on the compatibility spread: the two verified models first, then well-known lines.
  const SHELF = ['pulsar/x2-crazylight', 'mechlands/vibe75', 'razer/viper-v3-pro', 'logitech/pro-x-superlight-2', 'wooting/60he', 'hyperx/cloud-iii'];
  const shelf = SHELF.flatMap((id) => {
    const e = registry.find((x) => x.id === id);
    if (!e) return [];
    const word = e.features.some((f) => f.status === 'write-verified')
      ? { text: 'Verified on hardware', tone: 'confirmed', icon: 'check' as const }
      : e.features.some((f) => f.status === 'experimental')
        ? { text: 'Unverified', tone: 'signal', icon: 'unverified' as const }
        : { text: 'Recognised only', tone: 'muted', icon: 'blocked' as const };
    return [{ e, word }];
  });
</script>

<main class="landing" aria-labelledby="cover-title">
  <section class="cover">
    <p class="band"><span>Instruction booklet</span><span class="req">For mice, keyboards &amp; headsets · Chrome or Edge on a computer</span></p>
    <div class="front">
      <h1 id="cover-title" tabindex="-1"><svg class="title" viewBox="-14 -14 310 140" role="img" aria-label="UDB">
        <defs>
          <path id="udb-wm" d="M12 12V58A30 30 0 0 0 72 58V12M112 12V88H138A38 38 0 0 0 138 12ZM216 12V88M216 12H244A19 19 0 0 1 244 50H216M216 50H248A19 19 0 0 1 248 88H216" />
        </defs>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <use href="#udb-wm" class="wm-drop" stroke-width="40" transform="translate(0 10)" />
          <use href="#udb-wm" class="wm-edge" stroke-width="40" />
          <use href="#udb-wm" class="wm-fill" stroke-width="24" />
        </g>
      </svg><span class="sub">Universal Driver Bus</span></h1>
      <p class="promise">
        One bus. Every device. Change DPI, polling rate, lighting and keys in your browser, and believe only what the device
        sends back.
      </p>
      {#if devices.hid}
        <div class="start">
          <button class="press" onclick={() => onadd('supported')}><span class="key" aria-hidden="true">START</span>Plug in &amp; add your device</button>
          <a class="select" href="#/supported">Is mine compatible?</a>
        </div>
        <p class="fine">Your browser asks which device UDB may use. Picking one changes nothing on it. No install, no account, nothing uploaded.</p>
      {:else}
        <div class="nohid" role="note">
          <Icon name="alert" size={18} />
          <p>
            {#if !devices.secure}
              Devices only connect on a secure page. Open UDB over <span class="data">https://</span>.
            {:else}
              Devices connect through WebHID, which only Chrome and Edge on a computer have. Open this page there to start.
            {/if}
            <a href="#/supported">See what's compatible</a> meanwhile.
          </p>
        </div>
      {/if}
    </div>
    <div class="art" aria-hidden="true">
      <img class="dee" src="./brand/dee.webp" alt="" width="480" height="720" />
      <span class="seal"><b class="num">{registry.length}</b>compatible<br />models</span>
    </div>
    <dl class="rating">
      <dt>Truth rating</dt>
      <dd><span class="num">{verified}</span> verified on hardware</dd>
      <dd><span class="num">{unverified}</span> unverified: researched, not yet confirmed on a device</dd>
      <dd><span class="num">{recognised}</span> recognised: identified, no controls yet</dd>
    </dl>
  </section>

  <section class="spread" id="how" aria-label="How it works">
    <article class="page" data-folio="2">
      <h2><span class="page-chip">p. 2</span> Controls</h2>
      <dl class="rows">
        <div><dt>Read</dt><dd>UDB asks the device for its settings. Nothing changes on it.</dd></div>
        <div><dt>Change</dt><dd>Slide or pick a value. It's written once, when you let go.</dd></div>
        <div><dt>Read back</dt><dd>The device's own answer replaces your request on screen. If it disagrees, UDB puts the old value back and says so.</dd></div>
        <div><dt>Profiles</dt><dd>Save a mouse or keyboard setup in this browser and apply it to any compatible device.</dd></div>
      </dl>
    </article>
    <article class="page" data-folio="3">
      <h2><span class="page-chip">p. 3</span> Warnings</h2>
      <dl class="rows">
        <div><dt>No firmware</dt><dd>UDB never sends firmware, bootloader, pairing or factory-reset commands.</dd></div>
        <div><dt>No upload</dt><dd>No telemetry and no account. Everything runs on this page.</dd></div>
        <div><dt>Vendor apps</dt><dd>Close Synapse, G HUB, iCUE and the like first. A running vendor app can hold the device.</dd></div>
        <div><dt>Unverified</dt><dd>Most settings are researched but not yet confirmed on real hardware. UDB labels every one.</dd></div>
      </dl>
    </article>
  </section>

  <section class="spread compat" id="compatible" aria-label="Compatible devices">
    <article class="page" data-folio="4">
      <h2><span class="page-chip">p. 4</span> Compatible devices</h2>
      <p class="counts">
        <span><b class="num">{byCategory('mouse')}</b> mice</span>
        <span><b class="num">{byCategory('keyboard')}</b> keyboards</span>
        <span><b class="num">{byCategory('headset')}</b> headsets</span>
      </p>
      <ul class="brands">
        {#each brands as [vendor, n] (vendor)}
          <li>{vendor} <span class="num">{n}</span></li>
        {/each}
      </ul>
      <a class="btn" href="#/supported"><Icon name="search" />Search all {registry.length} models</a>
    </article>
    <article class="page" data-folio="5">
      <h2><span class="page-chip">p. 5</span> On the shelf</h2>
      <ul class="shelf">
        {#each shelf as { e, word } (e.id)}
          <li>
            <span class="shelf-art"><DeviceArt entryId={e.id} kind={e.category} alt="" /></span>
            <span class="shelf-name">{e.vendor} {e.model.replace(/\s*\(.*\)$/, '')}</span>
            <span class="shelf-state {word.tone}"><Icon name={word.icon} size={14} />{word.text}</span>
          </li>
        {/each}
      </ul>
      <p class="fine">Recognised isn't the same as verified. Product names and images belong to their makers; UDB isn't affiliated with any of them.</p>
    </article>
  </section>

  <section class="spread" aria-label="Before you start">
    <article class="page" data-folio="6">
      <h2><span class="page-chip">p. 6</span> Before you start</h2>
      <dl class="rows">
        <div><dt>Browser</dt><dd>Chrome or Edge on Windows, macOS or Linux. Phones and Firefox don't have WebHID.</dd></div>
        <div><dt>Page</dt><dd>A secure page (https). The hosted UDB is one; so is localhost.</dd></div>
        <div><dt>Offline</dt><dd>Once loaded, UDB installs as an app and works without a connection.</dd></div>
      </dl>
    </article>
    <article class="page last" data-folio="7">
      <h2><span class="page-chip">p. 7</span> Free and open</h2>
      <p>
        UDB is free software. Read the code, check the protocol notes behind every setting, or help verify a device you own.
      </p>
      <div class="links">
        <a class="btn" href="https://github.com/E1yWrites/udb" target="_blank" rel="noreferrer"><Icon name="external" />GitHub</a>
        <a class="btn quiet" href="#/contact">Contact</a>
        <a class="btn primary" href="#/app">Open UDB</a>
      </div>
    </article>
  </section>
</main>

<style>
  .landing {
    width: 100%;
    max-width: 80rem;
    margin: 0 auto;
    display: grid;
    gap: var(--space-8);
    padding: var(--space-6) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
  }

  /* The cover: green board, deep band across the top, ink keyline frame. */
  .cover {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(16rem, 0.85fr);
    grid-template-rows: auto 1fr;
    min-height: min(46rem, 82vh);
    border-radius: 28px;
    background: var(--cover);
    color: var(--band);
    border: 4px solid var(--band);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--cover) 45%, var(--band)),
      0 48px 64px -40px rgb(0 0 0 / 0.7);
    overflow: hidden;
  }

  .band {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2) var(--space-6);
    min-height: 4.5rem;
    margin: 0;
    padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-8));
    background: var(--band);
    color: var(--yellow);
    font: 600 1.125rem / 1.1 var(--font-brand);
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .band .req {
    color: var(--band-muted);
    font-size: var(--step--1);
    letter-spacing: 0.08em;
  }

  .front {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: var(--space-4);
    padding: var(--space-8) 0 var(--space-12) clamp(var(--space-4), 4vw, var(--space-12));
  }

  h1 {
    display: grid;
    margin: 0;
  }

  h1:focus {
    outline: none;
  }

  /* The cover wordmark, drawn as rounded strokes in Dee's lettering: the B keeps
     two open counters, which Fredoka's heavy B doesn't. */
  .title {
    display: block;
    width: auto;
    height: clamp(5.5rem, 2.5rem + 9vw, 11rem);
    overflow: visible;
  }

  .wm-drop,
  .wm-edge {
    stroke: var(--band);
  }

  .wm-fill {
    stroke: var(--yellow);
  }

  .sub {
    margin-top: var(--space-3);
    font: 650 clamp(1.5rem, 1rem + 1.4vw, 2.25rem) / 1.05 var(--font-brand);
  }

  .promise {
    max-width: 36ch;
    font-size: var(--step-1);
    line-height: 1.45;
  }

  .start {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  /* START: the cartridge-label button that opens the browser's device list. */
  .press {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 3.75rem;
    padding: 0 var(--space-6) 0 var(--space-2);
    border: 0;
    border-radius: 999px;
    background: var(--band);
    color: var(--yellow);
    font: 650 1.25rem / 1 var(--font-brand);
    cursor: pointer;
    transition: transform 100ms var(--ease-out);
  }

  .press:active {
    transform: scale(0.97);
  }

  .press .key {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    background: var(--yellow);
    color: var(--band);
    font-size: 0.6875rem;
    letter-spacing: 0.03em;
  }

  .press:focus-visible,
  .select:focus-visible {
    outline: 3px solid var(--yellow);
    outline-offset: 3px;
  }

  .select {
    display: inline-flex;
    align-items: center;
    min-height: 3.75rem;
    padding: 0 var(--space-6);
    border: 3px solid var(--band);
    border-radius: 999px;
    color: var(--band);
    font: 650 1.0625rem / 1 var(--font-brand);
    text-decoration: none;
  }

  .select:hover {
    background: rgb(13 26 16 / 0.08);
  }

  .fine {
    max-width: 52ch;
    font-size: var(--step--1);
  }

  .cover .fine {
    color: color-mix(in srgb, var(--band) 85%, var(--cover));
  }

  .nohid {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    max-width: 46ch;
    padding: var(--space-3) var(--space-4);
    border: 3px solid var(--band);
    border-radius: var(--radius-lg);
    background: var(--paper);
  }

  .nohid a {
    font-weight: 600;
  }

  .art {
    position: relative;
    background: radial-gradient(56% 46% at 50% 58%, var(--yellow), transparent 72%);
  }

  .dee {
    position: absolute;
    left: 50%;
    bottom: 2.5rem;
    height: min(36rem, 88%);
    width: auto;
    translate: -50% 0;
    filter: drop-shadow(0 1.25rem 0 color-mix(in srgb, var(--cover) 45%, var(--band)));
    animation: rise var(--spring-time) var(--spring) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
  }

  .seal {
    position: absolute;
    left: var(--space-4);
    top: var(--space-8);
    width: 9.5rem;
    height: 9.5rem;
    display: grid;
    place-content: center;
    text-align: center;
    border-radius: 50%;
    background: var(--yellow);
    border: 4px solid var(--band);
    font: 650 0.9375rem / 1.1 var(--font-brand);
    rotate: -10deg;
  }

  .seal b {
    font-size: 2.6rem;
    line-height: 1;
  }

  .rating {
    position: absolute;
    right: var(--space-4);
    bottom: var(--space-4);
    width: 15rem;
    margin: 0;
    padding: var(--space-3) var(--space-4);
    background: var(--paper);
    color: var(--page-ink);
    border: 3px solid var(--band);
    font-size: var(--step--1);
    line-height: 1.35;
  }

  .rating dt {
    font: 650 0.875rem / 1.2 var(--font-brand);
    margin-bottom: var(--space-1);
  }

  .rating dd {
    margin: 0;
  }

  .rating .num {
    font-weight: 700;
  }

  /* Spreads: two printed pages on one gutter. Always paper, in both themes. */
  .spread {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-radius: 14px;
    overflow: hidden;
    background: var(--paper);
    color: var(--page-ink);
    border: 3px solid var(--band);
    box-shadow: 0 30px 40px -34px rgb(0 0 0 / 0.6);
    scroll-margin-top: 5rem;
  }

  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-8) clamp(var(--space-4), 3vw, var(--space-8));
    min-width: 0;
  }

  /* The folio at the foot of each printed page. */
  .page::after {
    content: '— ' attr(data-folio) ' —';
    margin-top: auto;
    padding-top: var(--space-4);
    align-self: center;
    font: 600 var(--step--1) / 1 var(--font-brand);
    color: var(--page-faint);
    letter-spacing: 0.06em;
  }

  .page + .page {
    border-left: 2px solid var(--page-rule);
    background: linear-gradient(to right, rgb(19 32 15 / 0.06), transparent 2.5rem);
  }

  .page h2 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0;
    font: 700 clamp(1.75rem, 1.3rem + 1.2vw, 2.25rem) / 1 var(--font-brand);
    color: var(--page-head);
  }

  .page p {
    max-width: 58ch;
    color: var(--page-muted);
  }

  .rows {
    margin: 0;
    display: grid;
  }

  .rows div {
    display: grid;
    grid-template-columns: 8.5rem minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 2px dotted var(--page-dot);
  }

  .rows dt {
    font: 650 1.0625rem / 1.3 var(--font-brand);
  }

  .rows dd {
    margin: 0;
    color: var(--page-muted);
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-6);
    font-size: var(--step-1);
  }

  .counts b {
    font: 700 2.5rem / 1 var(--font-brand);
    color: var(--page-head);
    margin-right: var(--space-1);
  }

  .brands {
    list-style: none;
    margin: 0;
    padding: 0;
    columns: 3 9rem;
    column-gap: var(--space-6);
    font: 600 1rem / 2 var(--font-brand);
  }

  .brands .num {
    margin-left: var(--space-1);
    font: 500 var(--step--1) var(--font-ui);
    color: var(--page-faint);
  }

  .spread .btn {
    align-self: flex-start;
    border-color: var(--page-ink);
    color: var(--page-ink);
    text-decoration: none;
  }

  .spread .btn:hover {
    background: var(--page-hover);
  }

  .spread .btn.primary {
    color: var(--yellow-ink);
  }

  .spread .btn.primary:hover {
    background: color-mix(in srgb, var(--yellow) 88%, var(--page-ink));
  }

  .shelf {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-3);
  }

  .shelf li {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 2px solid var(--page-ink);
    border-radius: var(--radius-lg);
    background: var(--page-card);
  }

  .shelf-art {
    display: block;
    height: 5.5rem;
    border-radius: var(--radius);
    background: radial-gradient(60% 60% at 50% 50%, rgb(255 213 46 / 0.55), transparent 75%);
  }

  .shelf-name {
    font: 600 0.9375rem / 1.25 var(--font-brand);
  }

  .shelf-state {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .shelf-state.confirmed {
    color: var(--page-confirmed);
  }

  .shelf-state.signal {
    color: var(--page-signal);
  }

  .shelf-state.muted {
    color: var(--page-faint);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  @media (max-width: 60rem) {
    .cover {
      grid-template-columns: minmax(0, 1fr);
    }

    .front {
      padding-bottom: var(--space-6);
    }

    .art {
      min-height: 26rem;
    }

    .seal {
      left: auto;
      right: var(--space-4);
      top: var(--space-4);
    }

    .rating {
      position: static;
      width: auto;
      margin: 0 var(--space-4) var(--space-4);
    }

    .spread {
      grid-template-columns: minmax(0, 1fr);
    }

    .page + .page {
      border-left: 0;
      border-top: 2px solid var(--page-rule);
      background: none;
    }
  }

  @media (max-width: 30rem) {
    .rows div {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }

    .seal {
      width: 7.5rem;
      height: 7.5rem;
    }

    .seal b {
      font-size: 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dee {
      animation: fade 200ms ease-out both !important;
    }

    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
