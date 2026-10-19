<script lang="ts" module>
  export type Tone = 'neutral' | 'worried' | 'happy';
</script>

<script lang="ts">
  // Dee, UDB's mascot (ADR 11). One pose for now; tone is a CSS variation of it
  // (a tilt for worried, a small hop for happy) until more poses exist.
  // Decorative: whatever Dee says is in text next to it.
  let { tone = 'neutral', size = 48 }: { tone?: Tone; size?: number } = $props();
</script>

<span class="dee {tone}" style:--size="{size}px" aria-hidden="true">
  <img src="./brand/dee.webp" alt="" width={Math.round(size * (2 / 3))} height={size} decoding="async" />
</span>

<style>
  .dee {
    flex: none;
    display: inline-grid;
    place-items: end center;
    width: var(--size);
    height: var(--size);
  }

  img {
    width: auto;
    height: var(--size);
    transform-origin: 50% 100%;
    filter: drop-shadow(0 4px 6px oklch(0 0 0 / 0.28));
    transition: transform 320ms var(--spring);
  }

  .worried img {
    transform: rotate(-8deg);
    filter: saturate(0.7) drop-shadow(0 4px 6px oklch(0 0 0 / 0.28));
  }

  /* Worried Dee tilts as the notice arrives rather than arriving tilted. */
  @starting-style {
    .worried img {
      transform: none;
    }
  }

  .happy img {
    animation: hop 560ms var(--spring) 1 both;
  }

  @keyframes hop {
    40% {
      transform: translateY(-14%) rotate(4deg);
    }
  }
</style>
