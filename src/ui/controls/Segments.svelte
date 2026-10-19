<script lang="ts">
  // A short list of choices as one row of buttons (a radio group). Picking one
  // commits it; arrow keys move and commit, as radio groups do.
  let {
    id,
    label,
    options,
    value = $bindable(),
    disabled = false,
    oncommit,
  }: {
    /** On the first option, for the setting's <label>. */
    id: string;
    label: string;
    options: { value: number; label: string }[];
    value: number | undefined;
    disabled?: boolean;
    oncommit: () => void;
  } = $props();
</script>

<div class="segments" role="radiogroup" aria-label={label}>
  {#each options as o, i (o.value)}
    <label class:on={value === o.value} class:off={disabled}>
      <input
        id={i === 0 ? id : undefined}
        type="radio"
        name={id}
        value={o.value}
        checked={value === o.value}
        {disabled}
        onchange={() => {
          value = o.value;
          oncommit();
        }}
      />
      <span class="num">{o.label}</span>
    </label>
  {/each}
</div>

<style>
  .segments {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg);
  }

  label {
    position: relative;
    flex: 1 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border-radius: calc(var(--radius) - 3px);
    color: var(--muted);
    font-size: var(--step--1);
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 140ms var(--ease-out),
      color 140ms var(--ease-out);
  }

  label:hover:not(.off) {
    color: var(--text);
    background: var(--raised);
  }

  label.on {
    background: var(--accent);
    color: var(--accent-ink);
  }

  label.off {
    cursor: not-allowed;
    opacity: 0.55;
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }
</style>
