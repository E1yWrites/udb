<script lang="ts">
  // Keymap editor for a VIA keyboard. The key layout comes from a definition file the
  // user loads (src/adapters/via-definition.ts); the keycodes come from the keyboard.
  // Only basic keys can be assigned, and every change is read back (src/lib/write.ts).
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import SettingLine from './SettingLine.svelte';
  import type { ViaSession } from '../adapters/qmk-via-session.ts';
  import { MAX_FILE_BYTES, extent, parseViaDefinition, visibleKeys, type ViaDefinition, type ViaKey } from '../adapters/via-definition.ts';
  import { KEYCODE_GROUPS, keycodeName, keycodeShort } from '../adapters/via-keycodes.ts';
  import { hex4 } from '../lib/labels.ts';
  import { applySetting, type WriteResult } from '../lib/write.ts';

  let {
    session,
    layers,
    vendorId,
    productId,
    reconnects,
    writes,
  }: {
    session: ViaSession;
    /** The keyboard's layer count, from the layer query. */
    layers: number;
    vendorId: number;
    productId: number;
    reconnects: number;
    /** The panel's write record, included in its evidence report. */
    writes: unknown[];
  } = $props();

  type Reading = { value: number | null; at: string };

  let def = $state<ViaDefinition | null>(null);
  let problem = $state('');
  let chosen = $state<number[]>([]);
  let layer = $state(0);
  let codes = $state<Record<string, Reading>>({});
  /** What the keyboard held at each key when UDB first read it, for "Restore original". */
  let original = $state<Record<string, number>>({});
  let results = $state<Record<string, WriteResult<number> & { at: string }>>({});
  let picked = $state<{ row: number; col: number } | null>(null);
  let wanted = $state<number | undefined>(undefined);
  let allow = $state(false);
  let reading = $state(false);
  let busy = $state(false);

  const now = () => new Date().toISOString();
  const at = (l: number, k: { row: number; col: number }) => `${l},${k.row},${k.col}`;
  const keys = $derived(def ? visibleKeys(def, chosen) : []);
  const box = $derived(extent(keys));
  const id = $derived(picked ? at(layer, picked) : '');
  const current = $derived(codes[id]?.value ?? null);
  const kept = $derived(original[id]);

  async function load(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return void (problem = 'The file is too large to be a VIA definition.');
    const parsed = parseViaDefinition(await file.text());
    if (!parsed.ok) return void (problem = parsed.error);
    const d = parsed.definition;
    if (d.vendorId !== vendorId || d.productId !== productId) {
      problem = `This definition is for ${hex4(d.vendorId)}:${hex4(d.productId)}, but this keyboard is ${hex4(vendorId)}:${hex4(productId)}.`;
      return;
    }
    problem = '';
    session.setKeymap(layers, d.rows, d.cols);
    codes = {};
    original = {};
    results = {};
    picked = null;
    layer = 0;
    chosen = d.options.map(() => 0);
    def = d;
  }

  /** Reads the keys on screen that haven't been read yet, one at a time. */
  async function ensure() {
    if (!def || reading) return;
    reading = true;
    problem = '';
    const l = layer;
    try {
      for (const k of keys) {
        const key = at(l, k);
        if (key in codes) continue;
        const value = await session.readKeycode(l, k.row, k.col);
        codes[key] = { value, at: now() };
        if (value !== null) original[key] ??= value;
      }
    } catch (e) {
      problem = `Could not read the keymap (${e instanceof Error ? e.message : String(e)}).`;
    } finally {
      reading = false;
    }
  }

  $effect(() => {
    void [def, layer, chosen.join(',')];
    untrack(ensure);
  });

  function pick(k: ViaKey) {
    picked = { row: k.row, col: k.col };
    wanted = codes[at(layer, k)]?.value ?? undefined;
  }

  async function apply(value: number) {
    if (!picked || current === null) return;
    const key = id;
    const previous = current;
    const { row, col } = picked;
    busy = true;
    delete results[key];
    const result = await applySetting(session.keycode(layer, row, col), value, previous);
    const time = now();
    results[key] = { ...result, at: time };
    writes.push({ setting: 'keymap', layer, row, col, requested: value, previous, result, at: time, reconnects });
    if (result.kind === 'confirmed') codes[key] = { value: result.value, at: time };
    else if (result.kind === 'mismatch') codes[key] = { value: result.restored, at: time };
    else if (result.kind === 'failed') codes[key] = { value: result.actual, at: time };
    wanted = codes[key]?.value ?? undefined;
    busy = false;
  }

  const style = (k: ViaKey) =>
    `--x:${k.x - box.minX};--y:${k.y - box.minY};--kw:${k.w};--kh:${k.h};--ox:${k.rx - k.x};--oy:${k.ry - k.y};--r:${k.r}deg`;
  const named = (v: number | null | undefined) => (v == null ? 'Unreadable' : keycodeName(v));
</script>

<section class="keymap" aria-labelledby="keymap-h">
  <h3 id="keymap-h"><span class="tag">Experimental</span> Keymap</h3>
  <p class="muted">
    Load this keyboard’s VIA definition file to draw its keys. UDB reads each key from the keyboard and, if you allow
    it, changes one key at a time to a basic key. A change is saved in the keyboard’s own memory at once. Layer,
    macro and other special keys show as numbers and can only be put back as they were.
  </p>

  {#if !def}
    <label class="btn file">
      Load VIA definition
      <input type="file" accept=".json,application/json" onchange={load} />
    </label>
  {:else}
    <p class="muted">
      {def.name}, {def.rows} × {def.cols} matrix, {layers} layers.
      <label class="btn file quiet">
        Load another
        <input type="file" accept=".json,application/json" onchange={load} />
      </label>
    </p>

    {#if def.options.length}
      <div class="options">
        {#each def.options as option, i (i)}
          <label>
            {option.name}
            <select bind:value={chosen[i]} disabled={reading || busy}>
              {#each option.choices as choice, c (c)}<option value={c}>{choice}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
      <p class="muted">
        The keyboard doesn’t report which layout options it was built with, so pick the ones that match your keyboard.
      </p>
    {/if}

    <div class="layers" role="group" aria-label="Layer">
      {#each { length: layers } as _, l (l)}
        <button class="btn" aria-pressed={layer === l} disabled={reading || busy} onclick={() => (layer = l)}>Layer {l}</button>
      {/each}
    </div>

    <div class="stage">
      <div class="board" style:--w={box.w} style:--h={box.h}>
        {#each keys as k (`${k.row},${k.col},${k.x},${k.y}`)}
          {@const cell = codes[at(layer, k)]}
          <button
            class="key"
            class:picked={picked?.row === k.row && picked?.col === k.col}
            class:changed={cell?.value != null && original[at(layer, k)] !== undefined && cell.value !== original[at(layer, k)]}
            style={style(k)}
            aria-pressed={picked?.row === k.row && picked?.col === k.col}
            aria-label="Row {k.row}, column {k.col}: {cell ? named(cell.value) : 'not read yet'}"
            onclick={() => pick(k)}
          >
            {cell ? (cell.value === null ? '?' : keycodeShort(cell.value)) : '…'}
          </button>
        {/each}
      </div>
    </div>
    <p class="muted" aria-live="polite">{reading ? 'Reading keys from the keyboard…' : 'A dot in a key’s corner marks one you changed.'}</p>

    <label class="gate">
      <input type="checkbox" bind:checked={allow} />
      <span>
        Allow keymap writes. UDB changes one key, reads it back, and puts the previous key back if the keyboard
        disagrees.
      </span>
    </label>

    {#if picked}
      <div class="lines">
        <SettingLine
          id="via-keymap-key"
          label="Layer {layer}, row {picked.row}, column {picked.col}"
          value={codes[id]?.value}
          readAt={codes[id]?.at}
          busy={busy}
          result={results[id]}
          show={named}
        >
          <select id="via-keymap-key" bind:value={wanted} disabled={!allow || busy || current === null}>
            {#each KEYCODE_GROUPS as g (g.group)}
              <optgroup label={g.group}>
                {#each g.keys as k (k.code)}<option value={k.code}>{k.name}</option>{/each}
              </optgroup>
            {/each}
            {#if current !== null && !KEYCODE_GROUPS.some((g) => g.keys.some((k) => k.code === current))}
              <option value={current}>{named(current)} (as read)</option>
            {/if}
          </select>
          <button class="btn" onclick={() => apply(wanted!)} disabled={!allow || busy || wanted === undefined || wanted === current}>
            {busy ? 'Writing…' : 'Apply'}
          </button>
          <button class="btn quiet" onclick={() => apply(kept!)} disabled={!allow || busy || kept === undefined || kept === current}>
            Restore original
          </button>
        </SettingLine>
      </div>
      {#if kept !== undefined}
        <p class="muted">Original on this layer: {named(kept)}.</p>
      {/if}
    {:else}
      <p class="muted">Pick a key to change it.</p>
    {/if}
  {/if}

  {#if problem}<p class="problem" role="alert"><Icon name="alert" />{problem}</p>{/if}
</section>

<style>
  .keymap {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }

  h3 {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    font-size: var(--step-1);
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
    max-width: 68ch;
  }

  .btn.quiet {
    border-color: transparent;
    color: var(--muted);
  }

  .options,
  .layers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .options label {
    display: grid;
    gap: var(--space-1);
  }

  .layers .btn[aria-pressed='true'] {
    background: var(--raised);
    border-color: var(--text);
  }

  /* Keys are placed in key units; one unit is up to 3.25rem and shrinks so the drawing fits the width. */
  .stage {
    container-type: inline-size;
    overflow-x: auto;
  }

  .board {
    --u: max(1.75rem, min(3.25rem, calc(100cqw / var(--w))));
    position: relative;
    width: calc(var(--w) * var(--u));
    height: calc(var(--h) * var(--u));
  }

  .key {
    position: absolute;
    left: calc(var(--x) * var(--u));
    top: calc(var(--y) * var(--u));
    width: calc(var(--kw) * var(--u) - 4px);
    height: calc(var(--kh) * var(--u) - 4px);
    margin: 2px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--rail);
    font-size: max(0.6875rem, calc(var(--u) * 0.26));
    line-height: 1.1;
    transform-origin: calc(var(--ox) * var(--u)) calc(var(--oy) * var(--u));
    transform: rotate(var(--r));
    cursor: pointer;
  }

  .key:hover {
    border-color: var(--text);
  }

  .key.picked {
    outline: 2px solid var(--signal);
    outline-offset: 1px;
  }

  .key.changed::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--signal);
  }
</style>
