<script lang="ts" generics="T">
  // One setting in a live panel: the control (passed in), the last value the
  // device returned, and the outcome of the last write. Styles: app.css (.live).
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { WriteResult } from '../lib/write.ts';

  let {
    id,
    label,
    value,
    readAt,
    busy,
    result,
    show,
    children,
  }: {
    /** The id of the control in `children`, for the label. */
    id: string;
    label: string;
    /** The last value the device returned, never the requested one. */
    value: T | null | undefined;
    readAt: string | undefined;
    busy: boolean;
    result: (WriteResult<T> & { at: string }) | undefined;
    show: (v: T | null | undefined) => string;
    /** The input and its Apply button. */
    children: Snippet;
  } = $props();

  const clock = (iso: string) => new Date(iso).toLocaleTimeString();
</script>

<div class="line">
  <label class="name" for={id}>{label}</label>
  <div class="ask">{@render children()}</div>
  <div class="told">
    <span class="tag">Device</span>
    <span class="value num">{show(value)}</span>
    <span class="when">read {readAt ? clock(readAt) : '–'}</span>
  </div>
  <p class="outcome" aria-live="polite">
    {#if busy}
      <span class="status muted">Writing, then reading back…</span>
    {:else if result?.kind === 'confirmed'}
      <span class="status confirmed"><Icon name="check" size={14} />Confirmed by device at {clock(result.at)}</span>
    {:else if result?.kind === 'mismatch'}
      <span class="status signal"><Icon name="alert" size={14} />
        Device returned {show(result.actual)} instead of {show(result.requested)}.
        {result.restoreConfirmed ? `Restored to ${show(result.restored)}.` : `Restore not confirmed: device reads ${show(result.restored)}.`}
      </span>
    {:else if result?.kind === 'failed'}
      <span class="status danger"><Icon name="alert" size={14} />{result.error}. Device now reads {show(result.actual)}.</span>
    {:else if result?.kind === 'invalid'}
      <span class="status signal"><Icon name="alert" size={14} />{result.reason}</span>
    {/if}
  </p>
</div>
