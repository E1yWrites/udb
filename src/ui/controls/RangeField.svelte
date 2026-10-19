<script lang="ts">
  // A slider with an exact-value field beside it. Moving it writes nothing;
  // releasing it (or Enter in the field, or an arrow key) commits once.
  let {
    id,
    label,
    min,
    max,
    step = 1,
    value = $bindable(),
    disabled = false,
    unit = '',
    track,
    curve = false,
    oncommit,
  }: {
    /** On the slider, for the setting's <label>. */
    id: string;
    label: string;
    min: number;
    max: number;
    step?: number;
    value: number | undefined;
    disabled?: boolean;
    unit?: string;
    /** A CSS background for the track (hue, saturation). */
    track?: string;
    /** For long ranges (DPI 10-42,000): the track follows a power curve so low values get most of it. */
    curve?: boolean;
    oncommit: () => void;
  } = $props();

  // ponytail: fixed exponent; tune it if a sensor's useful range sits elsewhere.
  const EXP = 2.5;
  const RES = 1000;
  const snap = (v: number) => Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  const toPos = (v: number) => Math.round(((Math.min(max, Math.max(min, v)) - min) / (max - min)) ** (1 / EXP) * RES);
  const toValue = (pos: number) => snap(min + (max - min) * (pos / RES) ** EXP);

  // On a curved track an arrow press can round back to the same value, so keys move by the real step instead.
  const KEYS: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
  function curveKey(e: KeyboardEvent) {
    const by = KEYS[e.key] ?? (e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0);
    if (!by || value == null) return;
    e.preventDefault();
    value = by === Infinity ? max : by === -Infinity ? min : snap(value + by * step);
    oncommit();
  }
</script>

<div class="range" style:--track={track}>
  {#if curve}
    <input
      {id}
      type="range"
      min="0"
      max={RES}
      step="1"
      value={value == null ? 0 : toPos(value)}
      {disabled}
      aria-valuetext={value == null ? undefined : `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`}
      oninput={(e) => (value = toValue(Number(e.currentTarget.value)))}
      onkeydown={curveKey}
      onchange={oncommit}
    />
  {:else}
    <input
      {id}
      type="range"
      {min}
      {max}
      {step}
      bind:value
      {disabled}
      class:painted={!!track}
      aria-valuetext={value == null ? undefined : `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`}
      onchange={oncommit}
    />
  {/if}
  <input type="number" inputmode="numeric" aria-label="{label}, exact value" {min} {max} {step} bind:value {disabled} onchange={oncommit} />
</div>

<style>
  .range {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
    height: 1.75rem;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  /* A painted track (hue, saturation) replaces the browser's fill. */
  input.painted {
    appearance: none;
    background: transparent;
  }

  input.painted::-webkit-slider-runnable-track {
    height: 0.6rem;
    border-radius: 999px;
    background: var(--track);
    border: 1px solid var(--line-strong);
  }

  input.painted::-moz-range-track {
    height: 0.6rem;
    border-radius: 999px;
    background: var(--track);
    border: 1px solid var(--line-strong);
  }

  input.painted::-webkit-slider-thumb {
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: calc(-0.3rem - 1px);
    border-radius: 50%;
    background: var(--text);
    border: 3px solid var(--bg);
    box-shadow: 0 1px 4px oklch(0 0 0 / 0.4);
  }

  input.painted::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: var(--text);
    border: 3px solid var(--bg);
  }

  input[type='number'] {
    width: 6.5rem;
    flex: none;
  }

  input:disabled {
    cursor: not-allowed;
  }
</style>
