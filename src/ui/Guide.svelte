<script lang="ts">
  // Dee speaking: the avatar and a speech bubble. `tip` bubbles follow the
  // Guide switch (prefs.guideOn); recovery notices pass tip={false} and always show.
  import type { Snippet } from 'svelte';
  import Dee, { type Tone } from './Dee.svelte';
  import { prefs } from '../lib/prefs.svelte.ts';

  let {
    tone = 'neutral',
    size = 52,
    tip = true,
    avatar = true,
    children,
  }: { tone?: Tone; size?: number; tip?: boolean; avatar?: boolean; children: Snippet } = $props();
</script>

{#if !tip || prefs.guideOn}
  <div class="guide {tone}">
    {#if avatar}<Dee {tone} {size} />{/if}
    <div class="bubble">
      <span class="who">Dee</span>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .guide {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    max-width: 72ch;
  }

  /* A speech bubble in the mascot's own line work: ink outline, yellow wash. */
  .bubble {
    position: relative;
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-3) var(--space-4);
    border: 1.5px solid color-mix(in srgb, var(--ink) 55%, var(--yellow));
    border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 6px;
    background: color-mix(in srgb, var(--yellow) 12%, var(--surface));
    color: var(--text);
  }

  .worried .bubble {
    border-color: color-mix(in srgb, var(--signal) 55%, transparent);
    background: color-mix(in srgb, var(--signal) 9%, var(--surface));
  }

  .who {
    font: 600 var(--step--1) / 1.2 var(--font-brand);
    letter-spacing: 0.02em;
    color: var(--muted);
  }

  .bubble :global(p) {
    margin: 0;
    max-width: 62ch;
  }
</style>
