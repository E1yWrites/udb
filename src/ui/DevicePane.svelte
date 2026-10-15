<script lang="ts">
  import Icon from './Icon.svelte';
  import { devices, type UdbDevice } from '../lib/devices.svelte.ts';
  import { CONNECTION_ICON, LOCATION, STATUS, featureLabel, hex4 } from '../lib/labels.ts';
  import { deviceReport } from '../lib/report.ts';
  import CompxPanel from './CompxPanel.svelte';
  import Vibe75Panel from './Vibe75Panel.svelte';
  import ViaPanel from './ViaPanel.svelte';

  let { device }: { device: UdbDevice } = $props();

  const entry = $derived(device.match?.entry);
  const title = $derived(devices.label(device));
  const connection = $derived(device.match?.identity.connection);
  let copied = $state(false);

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
  <header class="head">
    <h1 id="device-title">{title}</h1>
    <p class="identity">
      {#if connection}
        <span class="tag"><Icon name={CONNECTION_ICON[connection]} size={14} />{connection}</span>
      {/if}
      <span class="data">{hex4(device.vendorId)}:{hex4(device.productId)}</span>
      {#if device.productName && device.productName !== title}
        <span class="muted">“{device.productName}”</span>
      {/if}
    </p>
  </header>

  {#if device.presence === 'disconnected'}
    <div class="notice">
      <Icon name="unplug" size={20} />
      <div>
        <h2>Disconnected</h2>
        <p>
          Plug it back in or wake it. Devices with a USB serial number come back on their own. Devices without one
          (like the Vibe75) lose the browser’s permission when unplugged, so you have to pick them again.
        </p>
        <button class="btn" onclick={() => devices.request('supported')}>Pick it again</button>
      </div>
    </div>
  {:else if device.presence === 'busy'}
    <div class="notice signal">
      <Icon name="busy" size={20} />
      <div>
        <h2>Another app is using this device</h2>
        <p>
          {#if entry?.conflictingSoftware?.length}
            Close {entry.conflictingSoftware.join(' or ')}, then try again.
          {:else}
            Close the manufacturer's software, then try again.
          {/if}
        </p>
        <p class="detail data">{device.openError}</p>
        <button class="btn" onclick={() => devices.retry(device)}>Try again</button>
      </div>
    </div>
  {:else if !entry}
    <div class="notice">
      <Icon name="blocked" size={20} />
      <div>
        <h2>UDB doesn't support this device yet</h2>
        <p>
          Copy the device report below and
          <a href="https://github.com/E1yWrites/udb/issues/new" target="_blank" rel="noreferrer">open an issue</a>
          so its protocol can be researched. The report holds descriptor details only, never what you type or click.
        </p>
      </div>
    </div>
  {:else if device.match?.identity.byCollection}
    <div class="notice signal">
      <Icon name="unverified" size={20} />
      <div>
        <h2>Recognised by its {entry.vendor} interface</h2>
        <p>
          Many devices share this interface, so the name above is the one the device gives itself. UDB sends nothing
          until you choose “Read from {entry.category}”, and then first checks that it speaks the protocol.
        </p>
      </div>
    </div>
  {:else if !device.match?.modelConfirmed}
    <div class="notice signal">
      <Icon name="unverified" size={20} />
      <div>
        <h2>Receiver recognised, model not confirmed</h2>
        <p>
          This receiver pairs with several {entry.vendor} mice. Use “Read from mouse” below to ask the device
          which model it is. Listed further down is what UDB knows about the {entry.model}.
        </p>
      </div>
    </div>
  {:else}
    <div class="notice">
      <Icon name="check" size={20} />
      <div>
        <h2>Detected</h2>
        <p>
          {#if entry.protocol.family === 'compx'}
            UDB sends nothing until you choose “Read from mouse”.
          {:else if entry.protocol.family === 'vibe75'}
            UDB sends nothing until you choose “Read from keyboard”.
          {:else}
            UDB can identify this device but has no adapter for it yet, so it sends nothing to it.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  {#if entry?.protocol.family === 'compx' && device.presence === 'connected'}
    <CompxPanel {device} />
  {:else if entry?.protocol.family === 'vibe75' && device.presence === 'connected'}
    <Vibe75Panel {device} />
  {:else if entry?.protocol.family === 'qmk-via' && device.presence === 'connected'}
    <ViaPanel {device} />
  {/if}

  {#if entry}
    <section aria-labelledby="known">
      <h2 id="known" class="section">What UDB knows</h2>
      <div class="scroll">
      <table>
        <thead>
          <tr><th scope="col">Setting</th><th scope="col">Stored on</th><th scope="col">Status</th><th scope="col">Read-back</th></tr>
        </thead>
        <tbody>
          {#each entry.features as f (f.id)}
            {@const s = STATUS[f.status]}
            <tr>
              <th scope="row">{featureLabel(f.id)}</th>
              <td><span class="tag">{LOCATION[f.location]}</span></td>
              <td><span class="status {s.tone}"><Icon name={s.icon} size={14} />{s.word}</span></td>
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
    </section>
  {/if}

  <section aria-labelledby="ifaces">
    <h2 id="ifaces" class="section">Interfaces</h2>
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
  </section>

  <footer class="actions">
    <button class="btn" onclick={copyReport}><Icon name="copy" />Copy device report</button>
    <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
  </footer>
</article>

<style>
  .pane {
    min-width: 0;
    display: grid;
    gap: var(--space-8);
    padding: var(--space-8) clamp(var(--space-4), 4vw, var(--space-12));
    max-width: 60rem;
  }

  h1 {
    font: 600 var(--step-3) / 1.15 var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .identity {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-top: var(--space-2);
    color: var(--muted);
  }

  .muted {
    color: var(--muted);
  }

  .notice {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    border-block: 1px solid var(--line);
    color: var(--muted);
  }

  .notice h2 {
    font-size: var(--step-1);
    font-weight: 600;
    color: var(--text);
  }

  .notice p {
    margin-top: var(--space-1);
    max-width: 68ch;
  }

  .notice .btn {
    margin-top: var(--space-3);
  }

  .notice.signal > :global(svg) {
    color: var(--signal);
  }

  .detail {
    color: var(--faint);
  }

  .section {
    font-size: var(--step--1);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: var(--space-3);
  }

  .scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-2) var(--space-4) var(--space-2) 0;
    border-bottom: 1px solid var(--line);
    vertical-align: baseline;
  }

  thead th {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--faint);
    border-bottom-color: var(--line-strong);
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
    margin-top: var(--space-3);
    font-size: var(--step--1);
    color: var(--faint);
    max-width: 72ch;
  }

  .limits {
    margin: var(--space-3) 0 0;
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

  @media (max-width: 40rem) {
    th,
    td {
      padding-right: var(--space-2);
    }
  }
</style>
