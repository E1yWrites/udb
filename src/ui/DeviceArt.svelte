<script lang="ts" module>
  // Authored top-down drawings, used when no product image exists (ADR 10) and
  // on the empty stage. 200 × 200 grid, one stroke weight; "F " marks a filled shape.
  const DRAWINGS = {
    mouse: [
      'F M100 22c-34 0-52 30-52 74v26c0 34 22 58 52 58s52-24 52-58V96c0-44-18-74-52-74z',
      'M100 22v14M100 64v22M48 92c18 6 34 8 52 8s34-2 52-8',
      'M95 41a5 5 0 0 1 10 0v14a5 5 0 0 1-10 0z',
    ],
    keyboard: [
      'F M22 64h156a10 10 0 0 1 10 10v52a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V74a10 10 0 0 1 10-10z',
      'M26 78h12M44 78h12M62 78h12M80 78h12M98 78h12M116 78h12M134 78h12M152 78h20',
      'M26 92h18M50 92h12M68 92h12M86 92h12M104 92h12M122 92h12M140 92h12M158 92h14',
      'M26 106h22M54 106h12M72 106h12M90 106h12M108 106h12M126 106h12M144 106h28',
      'M26 120h16M48 120h12M66 120h66M138 120h12M156 120h16',
    ],
    headset: [
      'M46 112V96a54 54 0 0 1 108 0v16',
      'F M34 108h20a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H34a10 10 0 0 1-10-10v-32a10 10 0 0 1 10-10z',
      'F M166 108h-20a6 6 0 0 0-6 6v40a6 6 0 0 0 6 6h20a10 10 0 0 0 10-10v-32a10 10 0 0 0-10-10z',
      'M60 150c10 14 24 20 40 20',
    ],
    unknown: [
      'F M60 60h80a12 12 0 0 1 12 12v56a12 12 0 0 1-12 12H60a12 12 0 0 1-12-12V72a12 12 0 0 1 12-12z',
      'M84 40v20M116 40v20M100 140v20',
    ],
  } as const;
  export type ArtKind = keyof typeof DRAWINGS;
</script>

<script lang="ts">
  import { imageFor } from '../lib/images.ts';

  let {
    entryId,
    kind = 'unknown',
    alt,
  }: {
    entryId?: string;
    kind?: ArtKind;
    /** Empty for decoration next to a visible name. */
    alt: string;
  } = $props();

  const image = $derived(imageFor(entryId));
  let failed = $state(false);
</script>

{#if image && !failed}
  <img
    class="art photo"
    src={image.src}
    {alt}
    width={image.width}
    height={image.height}
    decoding="async"
    draggable="false"
    onerror={() => (failed = true)}
  />
{:else}
  <svg class="art drawing" viewBox="0 0 200 200" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
    {#each DRAWINGS[kind] as d (d)}<path class:filled={d.startsWith('F ')} d={d.replace(/^F /, '')} />{/each}
  </svg>
{/if}

<style>
  .art {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
  }

  .drawing {
    fill: none;
    stroke: var(--art-line);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .drawing .filled {
    fill: var(--art-fill);
  }
</style>
