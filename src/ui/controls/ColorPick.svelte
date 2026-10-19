<script lang="ts">
  // Preset swatches and the system colour picker. A swatch commits on click;
  // the picker commits when it closes (change), never while you drag in it.
  let {
    id,
    value,
    disabled = false,
    onpick,
  }: {
    id: string;
    /** The colour the device last returned, as #rrggbb; null if unreadable. */
    value: string | null;
    disabled?: boolean;
    onpick: (hex: string) => void;
  } = $props();

  import { hexToHueSat, hueSatToHex } from '../../lib/color.ts';

  // Brand first, then the wheel. White is saturation 0.
  const SWATCHES = [
    { hex: '#49aa57', name: 'Green' },
    { hex: '#fdd130', name: 'Yellow' },
    { hex: '#ff6a00', name: 'Orange' },
    { hex: '#ff0000', name: 'Red' },
    { hex: '#ff00aa', name: 'Pink' },
    { hex: '#8a2be2', name: 'Purple' },
    { hex: '#0055ff', name: 'Blue' },
    { hex: '#00e5ff', name: 'Cyan' },
    { hex: '#ffffff', name: 'White' },
  ];
  /** The device stores hue and saturation only, so compare in that space. */
  const asDevice = (hex: string) => {
    const hs = hexToHueSat(hex);
    return hs ? hueSatToHex(hs.hue, hs.sat) : null;
  };
  const current = $derived(value ? asDevice(value) : null);
</script>

<div class="pick" role="group" aria-label="Colour">
  {#each SWATCHES as s (s.hex)}
    <button type="button" class="swatch" style:--c={s.hex} aria-label={s.name} title={s.name} aria-pressed={current === asDevice(s.hex)} {disabled} onclick={() => onpick(s.hex)}></button>
  {/each}
  <label class="custom" title="Another colour">
    <span class="visually-hidden">Another colour</span>
    <input {id} type="color" value={value ?? '#49aa57'} {disabled} onchange={(e) => onpick(e.currentTarget.value)} />
  </label>
</div>

<style>
  .pick {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .swatch,
  .custom {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--text) 25%, transparent);
    cursor: pointer;
    transition: transform 120ms var(--ease-out);
  }

  .swatch {
    padding: 0;
    background: var(--c);
  }

  .swatch:hover:not(:disabled),
  .custom:hover {
    transform: scale(1.08);
  }

  .swatch:active:not(:disabled) {
    transform: scale(0.94);
  }

  .swatch[aria-pressed='true'] {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--text);
  }

  .swatch:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .custom {
    position: relative;
    overflow: hidden;
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  }

  .custom:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .custom input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
