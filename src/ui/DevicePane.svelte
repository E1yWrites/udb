<script lang="ts">
  import Icon from './Icon.svelte';
  import { devices, type UdbDevice } from '../lib/devices.svelte.ts';
  import { setContext } from 'svelte';
  import { CONNECTION_ICON, LINE_GROUP, LOCATION, STATUS, deviceState, featureLabel, hex4 } from '../lib/labels.ts';
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

  let {
    device,
    prev,
    next,
    position,
    onstep,
  }: {
    device: UdbDevice;
    /** The neighbours in the device list, waiting dimmed in the rack beside the cartridge. */
    prev?: UdbDevice;
    next?: UdbDevice;
    /** "Mouse · 2 of 4". */
    position: string;
    onstep: (to: UdbDevice) => void;
  } = $props();

  // Setting rows open one at a time (SettingLine.svelte).
  const tiles = $state<{ open: string | null }>({ open: null });
  setContext(LINE_GROUP, tiles);

  /** Families with a live panel below; anything else is identified but never sent to. */
  const PANEL_FAMILIES = ['compx', 'vibe75', 'qmk-via', 'logitech-hidpp', 'razer', 'lamparray', 'corsair-nxp'];

  const entry = $derived(device.match?.entry);
  const title = $derived(devices.label(device));
  const connection = $derived(device.match?.identity.connection);
  let copied = $state(false);
  const image = $derived(imageFor(entry?.id));
  const status = $derived(deviceState(device));
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
  <!-- The console: the open device is a cartridge in the slot; its neighbours wait in the rack. -->
  <section class="console" aria-label="Device">
    {#if prev}
      <button class="rack prev" onclick={() => onstep(prev)} aria-label="Previous device: {devices.label(prev)}">
        <span class="arrow" aria-hidden="true"><Icon name="back" size={18} /></span>
        <span class="rack-art"><DeviceArt entryId={prev.match?.entry.id} kind={prev.match?.entry.category} alt="" /></span>
        <span class="rack-name">{devices.label(prev)}</span>
      </button>
    {:else}<span class="rack prev empty"></span>{/if}

    <div class="cart">
      <div class="label">
        <div class="art" class:photo={!!image}>
          <DeviceArt entryId={entry?.id} kind={entry?.category} alt={entry ? `${entry.vendor} ${entry.model}` : ''} />
        </div>
        <div class="id">
          <span class="page-chip">{position}</span>
          <h1 id="device-title" tabindex="-1">{title}</h1>
          <p class="pills">
            {#if connection && connection !== 'unknown'}
              <span class="pill"><Icon name={CONNECTION_ICON[connection]} size={14} />{connection}</span>
            {/if}
            <span class="pill data">{hex4(device.vendorId)}:{hex4(device.productId)}</span>
          </p>
          <p class="state {status.tone}"><Icon name={status.icon} size={15} />{status.word}</p>
          {#if image && entry && !device.match?.modelConfirmed}
            <p class="caption">Pictured: {entry.vendor} {entry.model}. The model isn't confirmed yet.</p>
          {:else if image?.match === 'line'}
            <p class="caption">Representative image of this product line, not this exact variant.</p>
          {/if}
        </div>
      </div>
    </div>

    {#if next}
      <button class="rack next" onclick={() => onstep(next)} aria-label="Next device: {devices.label(next)}">
        <span class="arrow" aria-hidden="true"><Icon name="chevron" size={18} /></span>
        <span class="rack-art"><DeviceArt entryId={next.match?.entry.id} kind={next.match?.entry.category} alt="" /></span>
        <span class="rack-name">{devices.label(next)}</span>
      </button>
    {:else}<span class="rack next empty"></span>{/if}
    <span class="slot" aria-hidden="true"></span>
  </section>

  <aside class="notes" aria-label="About this device">
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
          Many devices share this interface, so the name on the cartridge is the one the device gives itself. UDB sends nothing
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
    <Guide size={52}>
      <p>
        ← and → swap the cartridge. Reading changes nothing on the device; the value on each row is what it sent back,
        and a write is always read back.
      </p>
    </Guide>
    <dl class="facts">
      <div><dt>In the registry as</dt><dd>{entry ? `${entry.vendor} ${entry.model}` : 'Not listed yet'}</dd></div>
      {#if device.productName}<div><dt>Calls itself</dt><dd>“{device.productName}”</dd></div>{/if}
      <div><dt>UDB adapter</dt><dd>{entry && PANEL_FAMILIES.includes(entry.protocol.family) ? 'Reads and writes' : entry ? 'Identifies only' : 'None'}</dd></div>
      <div><dt>HID interfaces</dt><dd class="num">{device.interfaces.length}</dd></div>
    </dl>
  </aside>

  <!-- The device's printed page: index tabs over one sheet, paper in both themes. -->
  <div class="page paper">
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

    <div class="sheet">
      <h2 class="sheet-title"><span class="page-chip">p. 2</span>{tabs.find((t) => t.id === tab)?.label}</h2>
      {#if live}
        <div id="panel-controls" role="tabpanel" aria-labelledby="tab-controls" class="panel" hidden={tab !== 'controls'}>
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
    </div>
  </div>
</article>

<style>
  /* The spread: the console and its printed page on the left, the notes on the right. */
  .pane {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
    grid-template-rows: auto 1fr;
    grid-template-areas: 'console notes' 'page notes';
    gap: var(--space-6) clamp(var(--space-6), 2.5vw, var(--space-8));
    align-items: start;
    padding: var(--space-6) clamp(var(--space-4), 3vw, var(--space-8)) var(--space-12);
    max-width: 90rem;
    width: 100%;
    margin-inline: auto;
  }

  /* The console is a printed object: the same cover green, band and Dee yellow in both themes. */
  .console {
    grid-area: console;
    position: relative;
    display: grid;
    grid-template-columns: minmax(5.5rem, 9.5rem) minmax(0, 1fr) minmax(5.5rem, 9.5rem);
    align-items: end;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-2) 0;
    border-radius: 22px;
    background: var(--cover);
    border: 3px solid var(--band);
    overflow: hidden;
    --art-line: var(--band);
    --art-fill: var(--page-card);
  }

  .slot {
    position: absolute;
    inset: auto clamp(5rem, 12%, 9.5rem) 0;
    height: 1.625rem;
    background: var(--band);
    border-radius: 12px 12px 0 0;
  }

  .cart {
    position: relative;
    z-index: 1;
    width: min(100%, 38rem);
    margin: 0 auto -6px;
    padding: 2.125rem 1.25rem 2.25rem;
    border-radius: 26px 26px 6px 6px;
    background: #2f8a43;
    border: 3px solid var(--band);
    /* A swap pushes the next cartridge into the slot. */
    animation: insert var(--spring-time) var(--spring) both;
  }

  /* The grip along the top edge. */
  .cart::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0.625rem;
    width: 7.5rem;
    height: 0.625rem;
    translate: -50% 0;
    border-radius: 9px;
    background: var(--band);
    opacity: 0.5;
  }

  @keyframes insert {
    from {
      opacity: 0;
      transform: translateY(1.5rem);
    }
  }

  .label {
    display: grid;
    grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.25fr);
    min-height: 14rem;
    border-radius: 12px;
    background: var(--yellow);
    border: 3px solid var(--band);
    color: var(--page-ink);
    overflow: hidden;
    --art-fill: var(--page-card);
  }

  .art {
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    min-width: 0;
    padding: var(--space-3);
    background: radial-gradient(60% 60% at 50% 50%, #fff6c8, transparent 75%);
  }

  .art :global(.art) {
    max-height: 13rem;
    margin: auto;
  }

  .art.photo :global(.art) {
    filter: drop-shadow(0 12px 0 rgb(13 26 16 / 0.25));
  }

  .id {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-4) var(--space-4) var(--space-2);
    min-width: 0;
  }

  h1 {
    font: 700 clamp(1.6rem, 1rem + 1.4vw, 2.25rem) / 1.02 var(--font-brand);
    color: var(--page-ink);
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  h1:focus {
    outline: none;
  }

  h1:focus-visible {
    outline: 2px solid var(--band);
    outline-offset: 4px;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    min-height: 1.6rem;
    padding: 0 var(--space-3);
    border-radius: 999px;
    border: 1.5px solid var(--band);
    font-size: var(--step--1);
    text-transform: capitalize;
  }

  .pill.data {
    text-transform: none;
  }

  /* Status words darkened for the yellow label (AA on #ffd52e). */
  .state {
    display: flex;
    align-items: center;
    gap: 0.4em;
    font-size: var(--step--1);
    font-weight: 650;
  }

  .state.confirmed {
    color: #0a5257;
  }

  .state.signal {
    color: #8a3d00;
  }

  .state.muted {
    color: var(--page-muted);
  }

  .caption {
    font-size: var(--step--1);
    color: var(--page-muted);
    max-width: 40ch;
  }

  /* The rack: neighbours wait dimmed beside the slot. Only the art dims; the name keeps its contrast. */
  .rack {
    align-self: center;
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 0;
    border-radius: var(--radius-lg);
    background: none;
    color: var(--band);
    font: 600 var(--step--1) / 1.2 var(--font-brand);
    text-align: center;
    cursor: pointer;
    min-width: 0;
  }

  .rack.empty {
    cursor: default;
  }

  .rack-art {
    display: block;
    width: 100%;
    max-width: 8rem;
    height: 5.5rem;
    opacity: 0.55;
    filter: saturate(0.6);
    transition:
      opacity 200ms var(--ease-out),
      filter 200ms var(--ease-out);
  }

  .rack-name {
    overflow-wrap: anywhere;
  }

  .arrow {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 2px solid var(--band);
    background: rgb(255 255 255 / 0.3);
    transition: transform 100ms var(--ease-out);
  }

  @media (hover: hover) and (pointer: fine) {
    .rack:hover .rack-art {
      opacity: 0.9;
      filter: none;
    }

    .rack:hover .arrow {
      background: var(--yellow);
    }
  }

  .rack:active .arrow {
    transform: scale(0.94);
  }

  .rack:focus-visible {
    outline-color: var(--band);
  }

  /* The notes column: status, Dee, facts. */
  .notes {
    grid-area: notes;
    display: grid;
    gap: var(--space-4);
    align-content: start;
    min-width: 0;
  }

  .facts {
    display: grid;
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border: 2px solid var(--keyline);
    border-radius: var(--radius-lg);
    background: var(--surface);
    font-size: var(--step--1);
  }

  .facts div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: 1.5px dotted var(--line-strong);
  }

  .facts div:last-child {
    border-bottom: 0;
  }

  .facts dt {
    color: var(--faint);
    white-space: nowrap;
  }

  .facts dd {
    margin: 0;
    font-weight: 650;
    text-align: right;
    overflow-wrap: anywhere;
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
    border: 1.5px solid var(--line);
    color: var(--muted);
  }

  .notice h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font: 600 var(--step-1) / 1.25 var(--font-brand);
    color: var(--text);
  }

  .notice.signal {
    background: color-mix(in srgb, var(--signal) 8%, var(--surface));
    border-color: color-mix(in oklch, var(--signal) 40%, transparent);
  }

  .notice.signal h2 :global(svg) {
    color: var(--signal);
  }

  .notice.confirmed h2 :global(svg) {
    color: var(--confirmed);
  }

  /* A recovery notice in Dee's bubble. */
  .say {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font: 600 var(--step-1) / 1.25 var(--font-brand);
    color: var(--text);
  }

  .say ~ :global(.btn) {
    justify-self: start;
    margin-top: var(--space-1);
  }

  .say :global(svg) {
    color: var(--signal);
  }

  .detail {
    color: var(--faint);
  }

  /* The printed page: index tabs over one sheet with an ink keyline. */
  .page {
    grid-area: page;
    min-width: 0;
    color: var(--text);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding-inline: var(--space-4);
    overflow-x: auto;
    scrollbar-width: none;
    /* The sheet's top edge runs under the tabs; the open tab paints over it. */
    box-shadow: inset 0 -3px 0 var(--keyline);
  }

  [role='tab'] {
    flex: none;
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border: 3px solid var(--keyline);
    border-radius: 12px 12px 0 0;
    background: var(--rail);
    color: var(--muted);
    font: 600 var(--step--1) / 1 var(--font-brand);
    letter-spacing: 0.01em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 160ms var(--ease-out),
      color 160ms var(--ease-out);
  }

  [role='tab']:hover {
    color: var(--text);
    background: var(--raised);
  }

  [role='tab'][aria-selected='true'] {
    background: var(--surface);
    border-bottom-color: var(--surface);
    color: var(--text);
  }

  [role='tab']:focus-visible {
    outline-offset: -6px;
  }

  .sheet {
    --bleed: clamp(var(--space-4), 2.5vw, var(--space-6));
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4) var(--bleed) var(--bleed);
    border: 3px solid var(--keyline);
    border-top: 0;
    border-radius: 0 0 14px 14px;
    background: var(--surface);
  }

  .sheet-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font: 700 var(--step-2) / 1.1 var(--font-brand);
    color: var(--page-head);
  }

  .sheet-title .page-chip {
    vertical-align: baseline;
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
    border-radius: var(--radius);
    border: 1.5px solid var(--line-strong);
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
    border-bottom: 2px dotted var(--page-dot);
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

  @media (prefers-reduced-motion: reduce) {
    .cart {
      animation: fade 200ms ease-out both !important;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  /* Tablet: the console and its page take the full width; the notes follow the console. */
  @media (max-width: 60rem) {
    .pane {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
      grid-template-areas: 'console' 'notes' 'page';
    }

    .notes {
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      align-items: start;
    }
  }

  /* Phone: the cartridge fills the plate, the label stacks, and the rack shrinks to ‹ › buttons. */
  @media (max-width: 40rem) {
    .console {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: 'cart cart' 'prev next';
      padding: var(--space-4) var(--space-2) var(--space-2);
      gap: var(--space-1);
    }

    .cart {
      grid-area: cart;
      margin-bottom: var(--space-2);
      padding: 1.75rem var(--space-3) var(--space-3);
      border-radius: 22px;
    }

    .label {
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
    }

    .art {
      height: 10rem;
    }

    .id {
      padding: 0 var(--space-4) var(--space-4);
    }

    .slot {
      display: none;
    }

    .rack {
      grid-template-columns: auto minmax(0, 1fr);
      justify-items: start;
      align-items: center;
      text-align: left;
    }

    .prev {
      grid-area: prev;
    }

    .next {
      grid-area: next;
      grid-template-columns: minmax(0, 1fr) auto;
      justify-items: end;
      text-align: right;
    }

    .next .arrow {
      order: 2;
    }

    .rack-art {
      display: none;
    }

    .notes {
      grid-template-columns: minmax(0, 1fr);
    }

    th,
    td {
      padding: var(--space-2) var(--space-3);
    }
  }
</style>
