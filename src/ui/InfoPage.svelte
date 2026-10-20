<script lang="ts">
  // The booklet's back pages: terms, contact, and the page that isn't there.
  // Plain reading pages on booklet paper; contact goes through GitHub only.
  import Icon from './Icon.svelte';
  import Dee from './Dee.svelte';

  let { kind }: { kind: 'terms' | 'contact' | 'missing' } = $props();

  const REPO = 'https://github.com/E1yWrites/udb';
</script>

<main class="info" aria-labelledby="info-title">
  <article class="sheet">
    {#if kind === 'terms'}
      <header>
        <h1 id="info-title" tabindex="-1">Terms of use</h1>
        <p class="lede">Short version: UDB is free software, it runs only in your browser, and you use it at your own risk.</p>
      </header>
      <section>
        <h2>The software</h2>
        <p>
          UDB is free software under the GNU General Public License, version 3 or later. Some protocol code is ported from
          projects under the GNU Affero General Public License 3.0, so the hosted app as a whole is offered under AGPL-3.0
          terms: you can get the exact source of the build you are using from the link at the foot of every page.
        </p>
        <p>
          There is no warranty. To the extent the law allows, UDB is provided "as is", without any warranty of fitness for a
          particular purpose, and its authors aren't liable for damage arising from its use. The licence text in the
          repository has the full terms.
        </p>
      </section>
      <section>
        <h2>Your devices</h2>
        <p>
          UDB writes settings to devices you choose. It reads every write back and puts the previous value back when the
          device disagrees, but most settings are marked unverified: they come from protocol research and haven't been
          confirmed on real hardware. Writes to unverified settings stay off until you allow them on each device.
        </p>
        <p>
          UDB never sends firmware, bootloader, pairing or factory-reset commands. Changing settings with third-party
          software may affect your manufacturer's warranty or support; check with them if that matters to you.
        </p>
      </section>
      <section>
        <h2>Your data</h2>
        <p>
          UDB collects nothing. There is no account, no analytics and no telemetry, and nothing is uploaded. Profiles, your
          theme and the onboarding state are kept in this browser's storage; clearing your site data removes them. Device
          reports and evidence are copied to your clipboard only when you ask.
        </p>
        <p>
          The site is hosted on GitHub Pages, so GitHub serves the files and may log requests the way any web host does. See
          GitHub's privacy statement for what it keeps.
        </p>
      </section>
      <section>
        <h2>Names and images</h2>
        <p>
          Product names, trademarks and product images belong to their makers. UDB isn't affiliated with, endorsed by or
          sponsored by any device maker. An image only identifies a product; it never means the product is supported.
        </p>
      </section>
      <p class="stamp">Last updated 20 October 2026</p>
    {:else if kind === 'contact'}
      <header>
        <h1 id="info-title" tabindex="-1">Contact</h1>
        <p class="lede">UDB is run in the open on GitHub. Every question, bug and device request goes there, so the answer helps the next person too.</p>
      </header>
      <ul class="ways">
        <li>
          <h2>Something broke</h2>
          <p>Say what you did, what you expected and what UDB showed. Include your browser and device.</p>
          <a class="btn" href="{REPO}/issues/new" target="_blank" rel="noreferrer"><Icon name="external" />Report a bug</a>
        </li>
        <li>
          <h2>Support my device</h2>
          <p>
            Open your device in UDB, go to Interfaces &amp; diagnostics and choose Copy device report. It holds descriptor
            details only, never what you type or click. Paste it into the issue.
          </p>
          <a class="btn" href="{REPO}/issues/new" target="_blank" rel="noreferrer"><Icon name="external" />Request a device</a>
        </li>
        <li>
          <h2>Help verify</h2>
          <p>Own a device marked unverified? The contributor guide says how to check a setting on real hardware.</p>
          <a class="btn" href="{REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer"><Icon name="external" />Contributor guide</a>
        </li>
        <li>
          <h2>A security problem</h2>
          <p>Please don't post it publicly. Use Report a vulnerability on the repository's Security tab.</p>
          <a class="btn" href="{REPO}/security" target="_blank" rel="noreferrer"><Icon name="external" />Security tab</a>
        </li>
      </ul>
      <p class="note">Already reported? <a href="{REPO}/issues" target="_blank" rel="noreferrer">Search the open issues</a>.</p>
    {:else}
      <div class="missing">
        <Dee tone="worried" size={160} />
        <div>
          <h1 id="info-title" tabindex="-1"><span class="page-chip">p. 404</span> This page isn't in the booklet</h1>
          <p class="lede">The link may be old or mistyped. Nothing was sent to any device.</p>
          <div class="links">
            <a class="btn primary" href="#/app">Open UDB</a>
            <a class="btn" href="#/">Back to the cover</a>
            <a class="btn quiet" href="#/supported">Compatible devices</a>
          </div>
        </div>
      </div>
    {/if}
  </article>
</main>

<style>
  .info {
    flex: 1;
    width: 100%;
    max-width: 56rem;
    margin: 0 auto;
    padding: var(--space-8) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
  }

  /* One printed page: booklet paper and the cover's ink frame, in both themes. */
  .sheet {
    display: grid;
    gap: var(--space-6);
    padding: clamp(var(--space-6), 4vw, var(--space-12));
    border-radius: 14px;
    background: var(--paper);
    color: var(--page-ink);
    border: 3px solid var(--band);
    box-shadow: 0 30px 40px -34px rgb(0 0 0 / 0.6);
  }

  header {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
    padding-bottom: var(--space-4);
    border-bottom: 2px dotted var(--page-dot);
  }

  h1 {
    margin: 0;
    font: 700 clamp(2.25rem, 1.6rem + 2.2vw, 3.25rem) / 1.02 var(--font-brand);
    letter-spacing: -0.01em;
    color: var(--page-head);
    text-wrap: balance;
  }

  h1:focus {
    outline: none;
  }

  h2 {
    margin: 0 0 var(--space-2);
    font: 650 1.375rem / 1.15 var(--font-brand);
    color: var(--page-ink);
  }

  p {
    max-width: 66ch;
    color: var(--page-muted);
  }

  section p + p {
    margin-top: var(--space-3);
  }

  .lede {
    font-size: var(--step-1);
    color: var(--page-ink);
  }

  a {
    color: var(--page-head);
    font-weight: 600;
  }

  .stamp {
    font-size: var(--step--1);
    color: var(--page-faint);
  }

  .ways {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
    gap: var(--space-4);
  }

  .ways li {
    display: grid;
    align-content: start;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 2px solid var(--page-ink);
    border-radius: var(--radius-lg);
    background: var(--page-card);
  }

  .ways .btn {
    justify-self: start;
    margin-top: var(--space-1);
  }

  .btn {
    border-color: var(--page-ink);
    color: var(--page-ink);
    text-decoration: none;
  }

  .btn:hover {
    background: var(--page-hover);
  }

  .btn.primary {
    color: var(--yellow-ink);
  }

  .btn.primary:hover {
    background: color-mix(in srgb, var(--yellow) 88%, var(--page-ink));
  }

  .note {
    font-size: var(--step--1);
  }

  .missing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
  }

  .missing > div {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
    flex: 1 1 18rem;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
