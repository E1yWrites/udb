<script lang="ts">
  // System / Light / Dark, a radio group drawn as a segmented control.
  import Icon, { type IconName } from './Icon.svelte';
  import { prefs, setTheme, type Theme } from '../lib/prefs.svelte.ts';

  const OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
    { value: 'system', label: 'System', icon: 'screen' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];
  let { compact = false }: { compact?: boolean } = $props();

  // The whole page changes luminance, a flash at a desk at night: cross-fade it where the browser can (app.css).
  function choose(t: Theme) {
    if (!document.startViewTransition) return setTheme(t);
    document.startViewTransition(() => setTheme(t));
  }
</script>

<fieldset class="switch" class:compact>
  <legend class="visually-hidden">Theme</legend>
  {#each OPTIONS as o (o.value)}
    <label title={o.label}>
      <input type="radio" name="udb-theme" value={o.value} checked={prefs.theme === o.value} onchange={() => choose(o.value)} />
      <Icon name={o.icon} size={16} />
      <span class:visually-hidden={compact}>{o.label}</span>
    </label>
  {/each}
</fieldset>

<style>
  .switch {
    display: inline-flex;
    margin: 0;
    padding: 3px;
    gap: 2px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--rail);
  }

  label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
    padding: 0 var(--space-3);
    border-radius: 999px;
    color: var(--muted);
    font-size: var(--step--1);
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 160ms var(--ease-out),
      color 160ms var(--ease-out);
  }

  .compact label {
    min-width: 2rem;
    padding: 0 var(--space-2);
    justify-content: center;
  }

  label:hover {
    color: var(--text);
  }

  label:has(input:checked) {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 4px -2px oklch(0 0 0 / 0.45);
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
