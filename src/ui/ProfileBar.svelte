<script lang="ts">
  // Mouse and Keyboard profiles inside a live panel: save what the device
  // returned, edit, apply (each value through the panel's write procedure, read
  // back), export and import. Stored in this browser only (src/lib/profiles.ts);
  // src/lib/profile-map.ts turns a profile into this panel's row writes.
  import Icon from './Icon.svelte';
  import Guide from './Guide.svelte';
  import ProfileEditor from './ProfileEditor.svelte';
  import {
    MAX_FILE_BYTES,
    browserStore,
    deleteProfile,
    downloadProfile,
    loadProfiles,
    parseProfile,
    saveProfile,
    summary,
    type Body,
    type Profile,
  } from '../lib/profiles.ts';
  import { mappingFor, migrateV1, type MouseMap, type KeyboardMap } from '../lib/profile-map.ts';
  import type { WriteResult } from '../lib/write.ts';

  type Outcome = { key: string; text: string; tone: 'confirmed' | 'signal' | 'muted' };

  let {
    family,
    category,
    current,
    label,
    show,
    canWrite,
    busy,
    apply,
  }: {
    /** The protocol family and category pick the mapping (src/lib/profile-map.ts). */
    family: string;
    category: string;
    /** Row key to the value the device last returned; null where it couldn't be read. */
    current: Record<string, number | null | undefined>;
    label: (row: string) => string;
    show: (row: string, value: number | null | undefined) => string;
    /** The panel's "allow writes to unverified settings" gate. */
    canWrite: boolean;
    busy: boolean;
    /** Writes one row through the panel's write procedure and returns how it went. */
    apply: (row: string, value: number) => Promise<(WriteResult<number> & { at: string }) | undefined>;
  } = $props();

  const store = browserStore();
  const map = $derived(mappingFor(family, category));
  const kind = $derived(map?.category === 'mouse' ? 'Mouse' : 'Keyboard');

  let all = $state<Profile[]>(store ? loadProfiles(store, migrateV1) : []);
  const mine = $derived(all.filter((p) => p.category === map?.category));
  let name = $state('');
  let notice = $state('');
  let editing = $state<string | null>(null);
  let applying = $state<string | null>(null);
  let outcome = $state<{ name: string; lines: Outcome[] } | null>(null);

  const fromDevice = $derived(map ? map.toProfile(current) : {});
  const reload = () => (all = store ? loadProfiles(store, migrateV1) : []);

  function say(text: string) {
    notice = text;
    setTimeout(() => (notice = ''), 5000);
  }

  function put(p: Profile): boolean {
    try {
      saveProfile(store!, p, migrateV1);
    } catch {
      say('The browser would not store the profile (storage may be full or blocked).');
      return false;
    }
    reload();
    return true;
  }

  function saveCurrent() {
    if (!store || !map || !name.trim() || !Object.keys(fromDevice).length) return;
    const body = map.category === 'mouse' ? { mouse: fromDevice } : { keyboard: fromDevice };
    const parsed = parseProfile(JSON.stringify({ udbProfile: 2, name, category: map.category, ...body }), migrateV1);
    if (!parsed.ok) return say(parsed.error);
    if (put({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), ...parsed.profile })) {
      say(`Saved “${parsed.profile.name}” from what the ${category} returned.`);
      name = '';
    }
  }

  function saveEdit(p: Profile, body: Body) {
    if (put({ ...body, id: p.id, savedAt: new Date().toISOString() })) {
      editing = null;
      say(`Saved “${body.name}”.`);
    }
  }

  function remove(p: Profile) {
    if (!store) return;
    deleteProfile(store, p.id, migrateV1);
    reload();
    say(`Deleted “${p.name}” from this browser.`);
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !store) return;
    if (file.size > MAX_FILE_BYTES) return say('The file is too large to be a UDB profile.');
    const parsed = parseProfile(await file.text(), migrateV1);
    if (!parsed.ok) return say(parsed.error);
    if (!put({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), ...parsed.profile })) return;
    say(
      parsed.profile.category === map?.category
        ? `Imported “${parsed.profile.name}”.`
        : `Imported “${parsed.profile.name}”. It isn't a ${kind.toLowerCase()} profile, so it's listed under Profiles on Home.`,
    );
  }

  async function applyProfile(p: Profile) {
    if (!map) return;
    applying = p.id;
    outcome = null;
    const plan = (map as MouseMap | KeyboardMap).plan((p.mouse ?? p.keyboard)!, current);
    const lines: Outcome[] = [];
    for (const { row, value } of plan.writes) {
      if (current[row] === value) {
        lines.push({ key: row, tone: 'muted', text: `${label(row)}: already ${show(row, value)}` });
        continue;
      }
      const r = await apply(row, value);
      if (r?.kind === 'confirmed') lines.push({ key: row, tone: 'confirmed', text: `${label(row)}: confirmed by the device at ${show(row, r.value)}` });
      else if (r?.kind === 'mismatch') lines.push({ key: row, tone: 'signal', text: `${label(row)}: the device returned ${show(row, r.actual)} instead of ${show(row, r.requested)}; it reads ${show(row, r.restored)} now` });
      else if (r?.kind === 'failed') lines.push({ key: row, tone: 'signal', text: `${label(row)}: failed (${r.error})` });
      else if (r?.kind === 'invalid') lines.push({ key: row, tone: 'signal', text: `${label(row)}: not written. ${r.reason}` });
      else lines.push({ key: row, tone: 'signal', text: `${label(row)}: not written` });
    }
    for (const row of plan.unreadable) lines.push({ key: row, tone: 'signal', text: `${label(row)}: skipped, its current value could not be read` });
    plan.notes.forEach((text, i) => lines.push({ key: `note${i}`, tone: 'muted', text }));
    outcome = { name: p.name, lines };
    applying = null;
  }
</script>

<section class="profiles" aria-labelledby="profiles-h-{family}">
  <h3 id="profiles-h-{family}"><span class="tag">Browser</span> {map ? `${kind} profiles` : 'Profiles'}</h3>

  {#if !map}
    <p class="muted">Profiles cover mice and keyboards. This {category} keeps its settings on the device; nothing is saved here.</p>
  {:else if !store}
    <p class="muted">This browser blocks storage, so profiles can't be kept here.</p>
  {:else}
    <Guide size={44}>
      <p>
        A {kind.toLowerCase()} profile works on any {category} UDB can write: DPI stages, polling rate{map.category === 'keyboard' ? ', colour, brightness' : ''}.
        Applying one writes each value and reads it back, and I'll tell you anything this {category} can't take.
      </p>
    </Guide>

    <form
      class="save"
      onsubmit={(e) => {
        e.preventDefault();
        saveCurrent();
      }}
    >
      <label class="visually-hidden" for="profile-name-{family}">Profile name</label>
      <input id="profile-name-{family}" type="text" maxlength="60" placeholder="Name this profile" bind:value={name} />
      <button class="btn" type="submit" disabled={!name.trim() || !Object.keys(fromDevice).length}>Save current settings</button>
      <label class="btn file">
        Import file
        <input type="file" accept=".json,application/json" onchange={importFile} />
      </label>
    </form>

    {#if mine.length === 0}
      <p class="muted">No {kind.toLowerCase()} profiles yet. Save this {category}'s settings, or make one under Profiles on Home.</p>
    {:else}
      <ul class="list">
        {#each mine as p (p.id)}
          <li>
            <div class="row">
              <div class="what">
                <strong>{p.name}</strong>
                <span class="muted">{summary(p)}</span>
              </div>
              <div class="row-actions">
                <button class="btn" onclick={() => applyProfile(p)} disabled={!canWrite || busy || applying !== null}>
                  {applying === p.id ? 'Applying…' : 'Apply'}
                </button>
                <button class="btn quiet" onclick={() => (editing = editing === p.id ? null : p.id)} aria-expanded={editing === p.id}>Edit</button>
                <button class="btn quiet" onclick={() => downloadProfile(p)}>Export</button>
                <button class="btn quiet" onclick={() => remove(p)} aria-label="Delete {p.name}">Delete</button>
              </div>
            </div>
            {#if editing === p.id}
              <ProfileEditor initial={p} onsave={(body) => saveEdit(p, body)} oncancel={() => (editing = null)} />
            {/if}
          </li>
        {/each}
      </ul>
      {#if !canWrite}
        <p class="muted">Tick “Allow writes to unverified settings” above to apply a profile.</p>
      {/if}
    {/if}

    {#if outcome}
      <div class="outcome" role="status">
        <h4>Applied “{outcome.name}”</h4>
        <ul>
          {#each outcome.lines as line (line.key)}
            <li class={line.tone}><Icon name={line.tone === 'confirmed' ? 'check' : line.tone === 'signal' ? 'alert' : 'unverified'} size={14} />{line.text}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <p class="muted" aria-live="polite">{notice}</p>
    <a class="all" href="#/profiles">All profiles</a>
  {/if}
</section>

<style>
  .profiles {
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
    font: 600 var(--step-1) / 1.2 var(--font-brand);
  }

  h4 {
    font-size: var(--step-0);
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
    max-width: 68ch;
  }

  .save {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .save input[type='text'] {
    flex: 1 1 14rem;
    min-width: 0;
    min-height: 2.5rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .list > li {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-3);
    border-bottom: 1px solid var(--line);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .what {
    display: grid;
    min-width: 0;
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .btn.quiet {
    border-color: transparent;
    color: var(--muted);
  }

  /* The result of several seconds of writes arrives as one block, not line by line. */
  .outcome {
    transition:
      opacity 200ms var(--ease-out),
      transform 200ms var(--ease-out);
  }

  @starting-style {
    .outcome {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .outcome {
      transform: none;
      transition: opacity 150ms ease-out !important;
    }
  }

  .outcome ul {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .outcome li {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .confirmed {
    color: var(--confirmed);
  }

  .signal {
    color: var(--signal);
  }

  .all {
    justify-self: start;
    font-size: var(--step--1);
    color: var(--muted);
  }
</style>
