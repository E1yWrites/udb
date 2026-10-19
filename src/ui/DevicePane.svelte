<script lang="ts">
  import Icon from './Icon.svelte';
  import { devices, type UdbDevice } from '../lib/devices.svelte.ts';
  import { CONNECTION_ICON, LOCATION, STATUS, featureLabel, hex4 } from '../lib/labels.ts';
  import { deviceReport } from '../lib/report.ts';
  import CompxPanel from './CompxPanel.svelte';
  import Vibe75Panel from './Vibe75Panel.svelte';
  import ViaPanel from './ViaPanel.svelte';
  import LogitechPanel from './LogitechPanel.svelte';
  import RazerPanel from './RazerPanel.svelte';
  import LampArrayPanel from './LampArrayPanel.svelte';
  import CorsairPanel from './CorsairPanel.svelte';
  import Diagnostics from './Diagnostics.svelte';
  import DeviceArt from './DeviceArt.svelte';
  import Guide from './Guide.svelte';
  import { imageFor } from '../lib/images.ts';

  let { device }: { device: UdbDevice } = $props();

  /** Families with a live panel below; anything else is identified but never sent to. */
  const PANEL_FAMILIES = ['compx', 'vibe75', 'qmk-via', 'logitech-hidpp', 'razer', 'lamparray', 'corsair-nxp'];

  const entry = $derived(device.match?.entry);
  const title = $derived(devices.label(device));
  const connection = $derived(device.match?.identity.connection);
  let copied = $state(false);
  const image = $derived(imageFor(entry?.id));
  const live = $derived(!!entry && PANEL_FAMILIES.includes(entry.protocol.family) && device.presence === 'connected');

  type Tab = 'controls' | 'support' | 'interfaces';
  const tabs = $derived(
    [
      live && { id: 'controls' as const, label: 'Controls' },
      entry && { id: 'support' as const, label: 'What UDB knows' },
      { id: 'interfaces' as const, label: 'Interfaces & diagnostics' },
    ].filter((t): t is { id: Tab; label: string } => !!t),
  );
  let chosen = $state<Tab | null>(null);
  const tab = $derived(tabs.find((t) => t.id === chosen)?.id ?? tabs[0]!.id);

  // Arrow keys move along the tab list (WAI-ARIA tabs, automatic activation).
  function tabKey(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    chosen = tabs[(next + tabs.length) % tabs.length]!.id;
    queueMicrotask(() => document.getElementById(`tab-${chosen}`)?.focus());
  }

  const matches = (list: { usagePage: string; usage: string }[], c: HIDCollectionInfo) =>
    list.some((u) => parseInt(u.usagePage, 16) === c.usagePage && parseInt(u.usage, 16) === c.usage);

  function role(c: HIDCollectionInfo): 'used' | 'denied' | null {
    if (!entry) return null;
    if (matches(entry.collections.deny, c)) return 'denied';
    return matches(entry.collections.use, c) ? 'used' : null;
  }

  const sizes = (list: HIDReportInfo[] | undefined) =>
    (list ?? [])
      .map((r) => Math.ceil((r.items ?? []).reduce((s, i) => s + (i.reportSize ?? 0) * (i.reportCount ?? 0), 0) / 8))
      .join(', ') || '–';

  async function copyReport() {
    const json = JSON.stringify(deviceReport(device, new Date(), navigator.userAgent), null, 2);
    await navigator.clipboard.writeText(json);
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }
</script>

<article class="pane" aria-labelledby="device-title">
  <section class="hero">
    <figure class="stage">
      <div class="art" class:photo={!!image}>
        <DeviceArt entryId={entry?.id} kind={entry?.category} alt={entry ? `${entry.vendor} ${entry.model}` : ''} />
      </div>
      {#if image && entry && !device.match?.modelConfirmed}
        <figcaption>Pictured: {entry.vendor} {entry.model}. The model isn't confirmed yet.</figcaption>
      {:else if image?.match === 'line'}
        <figcaption>Representative image of this product line, not this exact variant.</figcaption>
      {/if}
    </figure>

    <header class="head">
      <h1 id="device-title" tabindex="-1">{title}</h1>
      <p class="identity">
        {#if connection && connection !== 'unknown'}
          <span class="chip"><Icon name={CONNECTION_ICON[connection]} size={14} />{connection}</span>
        {/if}
        <span class="chip data">{hex4(device.vendorId)}:{hex4(device.productId)}</span>
        {#if device.productName && device.productName !== title}
          <span class="chip">“{device.productName}”</span>
        {/if}
      </p>

      {#if device.presence === 'disconnected'}
        <Guide tone="worried" tip={false}>
          <h2 class="say"><Icon name="unplug" size={18} />Disconnected</h2>
          <p>
            Plug it back in or wake it. Devices with a USB serial number come back on their own. Devices without one
            (like the Vibe75) lose the browser’s permission when unplugged, so you have to pick them again.
          </p>
          <button class="btn" onclick={() => devices.request('supported')}>Pick it again</button>
        </Guide>
      {:else if device.presence === 'busy'}
        <Guide tone="worried" tip={false}>
          <h2 class="say"><Icon name="busy" size={18} />Another app is using this device</h2>
          <p>
            {#if entry?.conflictingSoftware?.length}
              Close {entry.conflictingSoftware.join(' or ')}, then try again.
            {:else}
              Close the manufacturer's software, then try again.
            {/if}
          </p>
          <p class="detail data">{device.openError}</p>
          <button class="btn" onclick={() => devices.retry(device)}>Try again</button>
        </Guide>
      {:else if !entry}
        <Guide tone="worried" tip={false}>
          <h2 class="say"><Icon name="blocked" size={18} />UDB doesn't support this device yet</h2>
          <p>
            Copy the device report under “Interfaces & diagnostics” and
            <a href="https://github.com/E1yWrites/udb/issues/new" target="_blank" rel="noreferrer">open an issue</a>
            so its protocol can be researched. The report holds descriptor details only, never what you type or click.
          </p>
        </Guide>
      {:else if device.match?.identity.byCollection}
        <div class="notice signal">
          <h2><Icon name="unverified" size={18} />Recognised by its {entry.vendor} interface</h2>
          <p>
            Many devices share this interface, so the name above is the one the device gives itself. UDB sends nothing
            until you choose “Read from {entry.category}”, and then first checks that it speaks the protocol.
          </p>
        </div>
      {:else if !device.match?.modelConfirmed}
        <div class="notice signal">
          <h2><Icon name="unverified" size={18} />Receiver recognised, model not confirmed</h2>
          <p>
            This receiver pairs with several {entry.vendor} mice. Use “Read from mouse” under Controls to ask the device
            which model it is. “What UDB knows” describes the {entry.model}.
          </p>
        </div>
      {:else}
        <div class="notice confirmed">
          <h2><Icon name="check" size={18} />Detected</h2>
          <p>
            {#if live}
              UDB sends nothing until you choose “Read from {entry.category}”.
            {:else}
              UDB can identify this device but has no adapter for it yet, so it sends nothing to it.
            {/if}
          </p>
        </div>
      {/if}
    </header>
  </section>

  <div class="tabs" role="tablist" aria-label="Device sections">
    {#each tabs as t (t.id)}
      <button
        id="tab-{t.id}"
        role="tab"
        aria-selected={tab === t.id}
        aria-controls="panel-{t.id}"
        tabindex={tab === t.id ? 0 : -1}
        onclick={() => (chosen = t.id)}
        onkeydown={tabKey}
      >
        {t.label}
      </button>
    {/each}
  </div>

  {#if live}
    <div id="panel-controls" role="tabpanel" aria-labelledby="tab-controls" class="panel" hidden={tab !== 'controls'}>
      <Guide size={56}>
        <p>
          Read first: nothing changes on the device. Each setting then shows <span class="tag">Device</span>, the value it
          sent back. A write is always read back, and if the device returns something else, I put the old value back and
          say so.
        </p>
      </Guide>
      {#if entry?.protocol.family === 'compx'}
        <CompxPanel {device} />
      {:else if entry?.protocol.family === 'vibe75'}
        <Vibe75Panel {device} />
      {:else if entry?.protocol.family === 'qmk-via'}
        <ViaPanel {device} />
      {:else if entry?.protocol.family === 'logitech-hidpp'}
        <LogitechPanel {device} />
      {:else if entry?.protocol.family === 'razer'}
        <RazerPanel {device} />
      {:else if entry?.protocol.family === 'lamparray'}
        <LampArrayPanel {device} />
      {:else if entry?.protocol.family === 'corsair-nxp'}
        <CorsairPanel {device} />
      {/if}
    </div>
  {/if}

  {#if entry}
    <div id="panel-support" role="tabpanel" aria-labelledby="tab-support" class="panel" hidden={tab !== 'support'}>
      <div class="scroll">
        <table>
          <thead>
            <tr><th scope="col">Setting</th><th scope="col">Stored on</th><th scope="col">Status</th><th scope="col">Read-back</th></tr>
          </thead>
          <tbody>
            {#each entry.features as f (f.id)}
              {@const st = STATUS[f.status]}
              <tr>
                <th scope="row">{featureLabel(f.id)}</th>
                <td><span class="tag">{LOCATION[f.location]}</span></td>
                <td><span class="status {st.tone}"><Icon name={st.icon} size={14} />{st.word}</span></td>
                <td class="muted">{f.readBack === undefined ? '–' : f.readBack ? 'Yes' : 'No'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="footnote">
        Unverified means the protocol was researched but no result has been observed on real hardware yet.
        <a href="https://github.com/E1yWrites/udb/blob/main/{entry.protocol.doc}" target="_blank" rel="noreferrer">Protocol notes</a>
      </p>
      {#if entry.limitations.length}
        <ul class="limits">
          {#each entry.limitations as l (l)}<li>{l}</li>{/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div id="panel-interfaces" role="tabpanel" aria-labelledby="tab-interfaces" class="panel" hidden={tab !== 'interfaces'}>
    {#if device.interfaces.length === 0}
      <p class="muted">No interfaces while disconnected.</p>
    {:else}
      <div class="scroll">
        <table>
          <thead>
            <tr><th scope="col">Usage</th><th scope="col">In</th><th scope="col">Out</th><th scope="col">Feature</th><th scope="col"><span class="visually-hidden">Role</span></th></tr>
          </thead>
          <tbody>
            {#each device.interfaces as hid, i (i)}
              {#each hid.collections as c, j (j)}
                {@const r = role(c)}
                <tr>
                  <th scope="row" class="data">{hex4(c.usagePage ?? 0)}:{hex4(c.usage ?? 0)}</th>
                  <td class="num">{sizes(c.inputReports)}</td>
                  <td class="num">{sizes(c.outputReports)}</td>
                  <td class="num">{sizes(c.featureReports)}</td>
                  <td>
                    {#if r === 'used'}<span class="tag">Used by UDB</span>{/if}
                    {#if r === 'denied'}<span class="status danger"><Icon name="blocked" size={14} />Blocked</span>{/if}
                  </td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
      <p class="footnote">Report sizes in bytes, excluding the report ID.</p>
    {/if}

    <Guide size={56}>
      <p>
        Want this device supported? “Copy device report” gives a maintainer the descriptor details they need. It never
        includes what you type or click.
      </p>
    </Guide>

    <Diagnostics {device} />

    <footer class="actions">
      <button class="btn" onclick={copyReport}><Icon name="copy" />Copy device report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  </div>
</article>

<style>
  .pane {
    min-width: 0;
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
    max-width: 76rem;
  }

  /* The device on its stage, with what UDB knows about it beside it. */
  .hero {
    display: grid;
    grid-template-columns: minmax(16rem, 1.1fr) minmax(0, 1fr);
    gap: var(--space-6) clamp(var(--space-6), 4vw, var(--space-12));
    align-items: center;
  }

  .stage {
    margin: 0;
    display: grid;
    gap: var(--space-2);
    justify-items: center;
    padding: var(--space-6) var(--space-4) var(--space-4);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(70% 55% at 50% 42%, var(--stage-light), transparent 72%),
      radial-gradient(46% 9% at 50% 90%, var(--stage-floor), transparent 100%),
      var(--rail);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .art {
    width: min(100%, 26rem);
    height: clamp(14rem, 30vw, 22rem);
    animation: enter var(--spring-time) var(--spring) both;
  }

  .art.photo {
    filter: drop-shadow(0 24px 22px oklch(0 0 0 / 0.5));
  }

  /* The device materialises: scale, blur and opacity together. */
  @keyframes enter {
    from {
      opacity: 0;
      filter: blur(10px);
      transform: translateY(10px) scale(0.96);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .art {
      animation: fade 200ms ease-out both !important;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  figcaption {
    font-size: var(--step--1);
    color: var(--faint);
    text-align: center;
    max-width: 44ch;
  }

  .head {
    display: grid;
    gap: var(--space-4);
    align-content: center;
    min-width: 0;
  }

  h1 {
    font: 600 var(--step-4) / 1.04 var(--font-brand);
    letter-spacing: -0.01em;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .identity {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    min-height: 1.75rem;
    padding: 0 var(--space-3);
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: var(--step--1);
    color: var(--muted);
    text-transform: capitalize;
  }

  .chip.data {
    text-transform: none;
    font-size: var(--step--1);
  }

  .muted {
    color: var(--muted);
  }

  .notice {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--muted);
  }

  .notice h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--step-1);
    font-weight: 650;
    color: var(--text);
  }

  .notice.signal {
    background: color-mix(in srgb, var(--signal) 8%, var(--surface));
    border-color: color-mix(in oklch, var(--signal) 32%, transparent);
  }

  .notice.signal h2 :global(svg) {
    color: var(--signal);
  }

  .notice.confirmed h2 :global(svg) {
    color: var(--confirmed);
  }

  .notice p {
    max-width: 62ch;
  }

  /* A recovery notice in Dee's bubble. */
  .say {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--step-1);
    font-weight: 650;
    color: var(--text);
  }

  .say ~ :global(.btn) {
    justify-self: start;
    margin-top: var(--space-1);
  }

  .say :global(svg) {
    color: var(--signal);
  }

  h1:focus {
    outline: none;
  }

  h1:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  .detail {
    color: var(--faint);
  }

  /* Tabs: a segmented control over the sections. */
  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: 999px;
    background: var(--rail);
    border: 1px solid var(--line);
    justify-self: start;
    max-width: 100%;
    overflow-x: auto;
  }

  [role='tab'] {
    min-height: 2.25rem;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 200ms var(--ease-out),
      color 200ms var(--ease-out);
  }

  [role='tab']:hover {
    color: var(--text);
  }

  [role='tab'][aria-selected='true'] {
    background: var(--raised);
    color: var(--text);
    box-shadow: 0 2px 8px -4px oklch(0 0 0 / 0.5);
  }

  .panel {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .panel[hidden] {
    display: none;
  }

  .scroll {
    overflow-x: auto;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--line);
    vertical-align: baseline;
  }

  tbody tr:last-child > * {
    border-bottom: 0;
  }

  thead th {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--faint);
    background: var(--rail);
  }

  tbody th {
    font-weight: 500;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    font-weight: 600;
    white-space: nowrap;
  }

  .status.signal {
    color: var(--signal);
  }

  .status.confirmed {
    color: var(--confirmed);
  }

  .status.muted {
    color: var(--muted);
  }

  .status.danger {
    color: var(--danger);
  }

  .footnote {
    font-size: var(--step--1);
    color: var(--faint);
    max-width: 72ch;
  }

  .limits {
    margin: 0;
    padding-left: 1.1em;
    font-size: var(--step--1);
    color: var(--muted);
    max-width: 72ch;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  @media (max-width: 60rem) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 40rem) {
    th,
    td {
      padding: var(--space-2) var(--space-3);
    }
  }
</style>
