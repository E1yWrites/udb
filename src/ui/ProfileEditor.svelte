<script lang="ts">
  // Edit a Mouse or Keyboard profile without a device: a draft, nothing is sent.
  // Saving runs the same checks as an imported file (parseProfile).
  import Icon from './Icon.svelte';
  import RangeField from './controls/RangeField.svelte';
  import Segments from './controls/Segments.svelte';
  import ColorPick from './controls/ColorPick.svelte';
  import { MAX_STAGES, POLLING_RATES, parseProfile, type Body } from '../lib/profiles.ts';
  import { migrateV1 } from '../lib/profile-map.ts';

  let { initial, onsave, oncancel }: { initial: Body; onsave: (body: Body) => void; oncancel: () => void } = $props();

  const uid = Math.random().toString(36).slice(2, 8);
  // svelte-ignore state_referenced_locally
  const start = $state.snapshot(initial);
  let name = $state(start.name);
  let stages = $state<number[]>(start.mouse?.dpiStages ?? [800]);
  let active = $state(start.mouse?.activeStage ?? 0);
  /** 0 means "don't change". */
  let polling = $state(start.mouse?.pollingHz ?? 0);
  let color = $state(start.mouse?.color ?? start.keyboard?.color ?? '#49aa57');
  let withColor = $state(!!(start.mouse?.color ?? start.keyboard?.color));
  let brightness = $state(start.keyboard?.brightness ?? 80);
  let withBrightness = $state(start.keyboard?.brightness !== undefined);
  let effect = $state(start.keyboard?.effect);
  let error = $state('');

  const isMouse = start.category === 'mouse';

  function save(e: SubmitEvent) {
    e.preventDefault();
    const settings = isMouse
      ? { dpiStages: stages, activeStage: Math.min(active, stages.length - 1), pollingHz: polling || undefined, color: withColor ? color : undefined }
      : { color: withColor ? color : undefined, brightness: withBrightness ? brightness : undefined, effect };
    const parsed = parseProfile(JSON.stringify({ udbProfile: 2, name, category: start.category, [start.category]: settings }), migrateV1);
    if (!parsed.ok) {
      error = isMouse ? parsed.error : 'Choose at least a colour or a brightness, and a name.';
      return;
    }
    onsave(parsed.profile);
  }
</script>

<form class="editor" onsubmit={save}>
  <label class="field">
    <span class="name">Name</span>
    <input type="text" maxlength="60" required bind:value={name} />
  </label>

  {#if isMouse}
    <fieldset class="field">
      <legend class="name">DPI stages</legend>
      {#each stages as _, i (i)}
        <div class="stage">
          <span class="num stage-n">{i + 1}</span>
          <RangeField id="ed-{uid}-dpi{i}" label="Stage {i + 1} DPI" min={50} max={42000} step={50} unit="DPI" curve bind:value={stages[i]} oncommit={() => {}} />
          <button type="button" class="btn quiet" aria-label="Remove stage {i + 1}" disabled={stages.length === 1} onclick={() => stages.splice(i, 1)}><Icon name="close" /></button>
        </div>
      {/each}
      <button type="button" class="btn quiet add" disabled={stages.length >= MAX_STAGES} onclick={() => stages.push(stages.at(-1)! * 2 > 42000 ? 42000 : stages.at(-1)! * 2)}>
        <Icon name="plus" />Add a stage
      </button>
    </fieldset>

    {#if stages.length > 1}
      <div class="field">
        <span class="name">Active stage</span>
        <Segments id="ed-{uid}-active" label="Active stage" options={stages.map((d, i) => ({ value: i, label: `${i + 1} · ${(d ?? 0).toLocaleString()}` }))} bind:value={active} oncommit={() => {}} />
      </div>
    {/if}

    <div class="field">
      <span class="name">Polling rate</span>
      <Segments
        id="ed-{uid}-rate"
        label="Polling rate"
        options={[{ value: 0, label: "Don't change" }, ...POLLING_RATES.map((hz) => ({ value: hz, label: `${hz.toLocaleString()} Hz` }))]}
        bind:value={polling}
        oncommit={() => {}}
      />
      <p class="note">A mouse that can't do the rate keeps its own; applying says so.</p>
    </div>
  {/if}

  <div class="field">
    <label class="check"><input type="checkbox" bind:checked={withColor} /> <span class="name">Colour</span></label>
    {#if withColor}
      <ColorPick id="ed-{uid}-color" value={color} onpick={(hex) => (color = hex)} />
      <p class="note">
        {#if isMouse}No mouse UDB supports can take a colour yet. It's kept in the profile for when one can.{:else}Sent to every colour channel the keyboard has.{/if}
      </p>
    {/if}
  </div>

  {#if !isMouse}
    <div class="field">
      <label class="check"><input type="checkbox" bind:checked={withBrightness} /> <span class="name">Brightness</span></label>
      {#if withBrightness}
        <RangeField id="ed-{uid}-brightness" label="Brightness" min={0} max={100} unit="%" bind:value={brightness} oncommit={() => {}} />
      {/if}
    </div>
    {#if effect}
      <div class="field">
        <span class="name">Effect</span>
        <p class="effect">
          Effect {effect.value}, applied only to {effect.family === 'qmk-via' ? 'QMK/VIA' : effect.family} keyboards
          <button type="button" class="btn quiet" onclick={() => (effect = undefined)}>Remove</button>
        </p>
      </div>
    {/if}
  {/if}

  {#if error}<p class="error" role="alert"><Icon name="alert" size={14} />{error}</p>{/if}
  <div class="actions">
    <button class="btn primary" type="submit">Save profile</button>
    <button class="btn quiet" type="button" onclick={oncancel}>Cancel</button>
  </div>
</form>

<style>
  .editor {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid color-mix(in srgb, var(--yellow) 55%, var(--line));
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--yellow) 5%, var(--surface));
  }

  .field {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .name {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--muted);
  }

  .field input[type='text'] {
    min-height: 2.5rem;
    max-width: 24rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  .stage {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
  }

  .stage-n {
    font-weight: 650;
    color: var(--faint);
    text-align: center;
  }

  .add {
    justify-self: start;
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .note {
    font-size: var(--step--1);
    color: var(--faint);
  }

  .effect {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .error {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--danger);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
