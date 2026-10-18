<script lang="ts">
  import Icon from './Icon.svelte';
  import { descriptorLines } from '../lib/descriptor.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { logFor } from '../lib/history.svelte.ts';
  import { hex4 } from '../lib/labels.ts';
  import { diagnosticsReport } from '../lib/report.ts';

  let { device }: { device: UdbDevice } = $props();

  /** The last entries shown; the export always holds all of them. */
  const SHOWN = 200;

  const log = $derived(logFor(device.key));
  const recent = $derived(log.slice(-SHOWN));
  const descriptor = $derived(device.interfaces.map((i) => descriptorLines(i.collections)));
  let notice = $state('');

  const json = () => JSON.stringify(diagnosticsReport(device, $state.snapshot(log), new Date(), navigator.userAgent), null, 2);

  function say(text: string) {
    notice = text;
    setTimeout(() => (notice = ''), 2500);
  }

  async function copy() {
    await navigator.clipboard.writeText(json());
    say('Copied to clipboard');
  }

  // Saved by the browser from a local blob: nothing is sent anywhere.
  function download() {
    const url = URL.createObjectURL(new Blob([json()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `udb-diagnostics-${hex4(device.vendorId)}-${hex4(device.productId)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    say('Saved to your downloads');
  }
</script>

<section aria-labelledby="diagnostics">
  <details>
    <summary id="diagnostics" class="section">Diagnostics</summary>

    <div class="body">
      <h3>Report descriptor</h3>
      {#if descriptor.length === 0}
        <p class="muted">No interfaces while disconnected.</p>
      {:else}
        {#each descriptor as lines, i (i)}
          <h4>Interface {i + 1}</h4>
          <!-- A scrollable region has to take keyboard focus, or keyboard users can't read it. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre class="data" tabindex="0" aria-label="Report descriptor of interface {i + 1}">{lines.join('\n')}</pre>
        {/each}
        <p class="footnote">As the browser parsed it. Sizes are in bytes, excluding the report ID.</p>
      {/if}

      <h3>Report log</h3>
      <p class="muted">
        Every report UDB sent to this device and every reply it matched, since this page was opened. Nothing you type or
        click is logged.
      </p>
      {#if log.length === 0}
        <p class="muted">Nothing sent yet. UDB sends nothing until you read from the device.</p>
      {:else}
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Dir</th>
                <th scope="col">Report</th>
                <th scope="col">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {#each recent as e, i (log.length - recent.length + i)}
                <tr>
                  <td class="num">{e.at.slice(11, 23)}</td>
                  <td>{e.dir === 'tx' ? 'Sent' : 'Received'}{e.via ? ` (${e.via})` : ''}</td>
                  <td class="data">0x{e.reportId.toString(16).padStart(2, '0')}</td>
                  <td class="data bytes">{e.hex}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="footnote">
          {log.length > SHOWN ? `Showing the last ${SHOWN} of ${log.length}. ` : ''}The export holds all {log.length}.
        </p>
      {/if}

      <p class="warn">
        <Icon name="alert" size={16} />
        Replies can contain identifiers such as serial numbers or firmware strings. Read the file before you share it. The
        export stays on this computer until you attach it somewhere.
      </p>
      <div class="actions">
        <button class="btn" onclick={copy}><Icon name="copy" />Copy diagnostics</button>
        <button class="btn" onclick={download}>Save as file</button>
        <span class="muted" aria-live="polite">{notice}</span>
      </div>
    </div>
  </details>
</section>

<style>
  summary {
    cursor: pointer;
    width: fit-content;
  }

  .section {
    font-size: var(--step--1);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .body {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  h3 {
    font-size: var(--step-0);
    font-weight: 600;
    margin-top: var(--space-3);
  }

  h4 {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--faint);
  }

  .muted,
  .footnote {
    color: var(--muted);
    max-width: 68ch;
  }

  .footnote {
    font-size: var(--step--1);
    color: var(--faint);
  }

  pre {
    margin: 0;
    padding: var(--space-3);
    max-height: 20rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--rail);
    line-height: 1.45;
  }

  .scroll {
    max-height: 24rem;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-1) var(--space-4) var(--space-1) 0;
    border-bottom: 1px solid var(--line);
    vertical-align: baseline;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--bg);
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--faint);
    border-bottom-color: var(--line-strong);
  }

  .bytes {
    word-break: break-all;
  }

  .warn {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    color: var(--signal);
    max-width: 68ch;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
</style>
