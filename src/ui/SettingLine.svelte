<script lang="ts" generics="T">
  // One setting in a live panel: the control (passed in), the last value the
  // device returned, and the outcome of the last write, as a dotted-rule row that
  // opens to its control. Styles: app.css (.live).
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { WriteResult } from '../lib/write.ts';
  import { noteReadBack } from '../lib/prefs.svelte.ts';
  import { getContext } from 'svelte';
  import { LINE_GROUP } from '../lib/labels.ts';

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
  $effect(() => {
    if (value != null) noteReadBack();
  });

  // Rows in one device view open one at a time (DevicePane sets the group); the first one mounted starts open.
  const group = getContext<{ open: string | null } | undefined>(LINE_GROUP);
  // svelte-ignore state_referenced_locally
  if (group && group.open === null) group.open = id;
  const open = $derived(!group || group.open === id);
  /** The closed row's word for the last write; the open row spells the outcome out. */
  const WORD = { confirmed: 'confirmed', muted: 'writing…', signal: 'needs a look', danger: 'failed' } as const;
  const tone = $derived(
    busy ? 'muted' : result?.kind === 'confirmed' ? 'confirmed' : result?.kind === 'failed' ? 'danger' : result ? ('signal' as const) : null,
  );
</script>

<div class="line" class:open>
  <button type="button" class="head" aria-expanded={open} aria-controls="{id}-body" onclick={() => group && (group.open = id)}>
    <span class="name">{label}</span>
    <span class="reads"><span class="tag">Device</span>{#key value}<span class="value num settle">{show(value)}</span>{/key}</span>
    {#if !open}
      {#if tone}
        <span class="mini {tone}"><Icon name={tone === 'confirmed' ? 'check' : tone === 'muted' ? 'busy' : 'alert'} size={14} />{WORD[tone]}</span>
      {:else}
        <span class="mini when">read {readAt ? clock(readAt) : '–'}</span>
      {/if}
    {/if}
  </button>
  <div id="{id}-body" class="body" hidden={!open}>
    <label class="visually-hidden" for={id}>{label}</label>
    <div class="ask">{@render children()}</div>
    <span class="when">read {readAt ? clock(readAt) : '–'}</span>
  </div>
  <p class="outcome" class:visually-hidden={!open} aria-live="polite">
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
