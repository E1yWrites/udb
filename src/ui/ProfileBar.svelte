<script lang="ts">
  // Browser profiles for a live panel: save the values the device last returned,
  // apply them back through the panel's write procedure (every value read back),
  // export and import as a file. Stored in this browser only (src/lib/profiles.ts).
  import Icon from './Icon.svelte';
  import {
    MAX_FILE_BYTES,
    deleteProfile,
    loadProfiles,
    parseProfile,
    saveProfile,
    serializeProfile,
    type Profile,
    type Store,
  } from '../lib/profiles.ts';
  import type { WriteResult } from '../lib/write.ts';

  type Outcome = { row: string; text: string; tone: 'confirmed' | 'signal' | 'muted' };

  let {
    entryId,
    current,
    label,
    show,
    canWrite,
    busy,
    apply,
  }: {
    /** Profiles list only under the registry entry they were saved from. */
    entryId: string;
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

  const store: Store | null = (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })();

  let all = $state<Profile[]>(store ? loadProfiles(store) : []);
  const mine = $derived(all.filter((p) => p.registryId === entryId));
  let name = $state('');
  let notice = $state('');
  let applying = $state<string | null>(null);
  let outcome = $state<{ name: string; lines: Outcome[] } | null>(null);

  const readable = $derived(Object.entries(current).flatMap(([row, v]): [string, number][] => (typeof v === 'number' && Number.isSafeInteger(v) ? [[row, v]] : [])));
  const reload = () => (all = store ? loadProfiles(store) : []);

  function say(text: string) {
    notice = text;
    setTimeout(() => (notice = ''), 4000);
  }

  function save() {
    if (!store || !name.trim() || readable.length === 0) return;
    try {
      saveProfile(store, { id: crypto.randomUUID(), name: name.trim().slice(0, 60), registryId: entryId, savedAt: new Date().toISOString(), settings: Object.fromEntries(readable) });
    } catch {
      say('The browser would not store the profile (storage may be full or blocked).');
      return;
    }
    reload();
    say(`Saved “${name.trim()}”.`);
    name = '';
  }

  function remove(p: Profile) {
    if (!store) return;
    deleteProfile(store, p.id);
    reload();
    say(`Deleted “${p.name}” from this browser.`);
  }

  function download(p: Profile) {
    const url = URL.createObjectURL(new Blob([serializeProfile(p)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `udb-profile-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !store) return;
    if (file.size > MAX_FILE_BYTES) return say('The file is too large to be a UDB profile.');
    const parsed = parseProfile(await file.text());
    if (!parsed.ok) return say(parsed.error);
    try {
      saveProfile(store, { id: crypto.randomUUID(), savedAt: new Date().toISOString(), ...parsed.profile });
    } catch {
      return say('The browser would not store the profile (storage may be full or blocked).');
    }
    reload();
    say(
      parsed.profile.registryId === entryId
        ? `Imported “${parsed.profile.name}”.`
        : `Imported “${parsed.profile.name}”. It is for ${parsed.profile.registryId}, so it lists only under that device.`,
    );
  }

  async function applyProfile(p: Profile) {
    applying = p.id;
    outcome = null;
    const lines: Outcome[] = [];
    // The panel's own row order, so dependent settings go in the order its rows are shown.
    for (const row of Object.keys(current)) {
      const wanted = p.settings[row];
      if (wanted === undefined) continue;
      if (current[row] === wanted) {
        lines.push({ row, tone: 'muted', text: `${label(row)}: already ${show(row, wanted)}` });
        continue;
      }
      if (current[row] == null) {
        lines.push({ row, tone: 'signal', text: `${label(row)}: skipped, its current value could not be read` });
        continue;
      }
      const r = await apply(row, wanted);
      if (r?.kind === 'confirmed') lines.push({ row, tone: 'confirmed', text: `${label(row)}: confirmed by the device at ${show(row, r.value)}` });
      else if (r?.kind === 'mismatch') lines.push({ row, tone: 'signal', text: `${label(row)}: the device returned ${show(row, r.actual)} instead of ${show(row, r.requested)}; it reads ${show(row, r.restored)} now` });
      else if (r?.kind === 'failed') lines.push({ row, tone: 'signal', text: `${label(row)}: failed (${r.error})` });
      else if (r?.kind === 'invalid') lines.push({ row, tone: 'signal', text: `${label(row)}: not written. ${r.reason}` });
      else lines.push({ row, tone: 'signal', text: `${label(row)}: not written` });
    }
    const saved = Object.keys(p.settings).filter((k) => !(k in current));
    for (const row of saved) lines.push({ row, tone: 'muted', text: `${row}: this device has no such setting right now` });
    outcome = { name: p.name, lines };
    applying = null;
  }
</script>

<section class="profiles" aria-labelledby="profiles-h-{entryId}">
  <h3 id="profiles-h-{entryId}"><span class="tag">Browser</span> Profiles</h3>
  <p class="muted">
    A profile is a set of values the device returned, stored in this browser only. Applying one writes each value to
    the device and reads it back; nothing is sent anywhere.
  </p>

  {#if !store}
    <p class="muted">This browser blocks storage, so profiles can't be kept here.</p>
  {:else}
    <form
      class="save"
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label class="visually-hidden" for="profile-name-{entryId}">Profile name</label>
      <input id="profile-name-{entryId}" type="text" maxlength="60" placeholder="Name this profile" bind:value={name} />
      <button class="btn" type="submit" disabled={!name.trim() || readable.length === 0}>Save current settings</button>
      <label class="btn file">
        Import file
        <input type="file" accept=".json,application/json" onchange={importFile} />
      </label>
    </form>

    {#if mine.length === 0}
      <p class="muted">No profiles for this device yet.</p>
    {:else}
      <ul class="list">
        {#each mine as p (p.id)}
          <li>
            <div class="what">
              <strong>{p.name}</strong>
              <span class="muted">{Object.keys(p.settings).length} settings · saved {new Date(p.savedAt).toLocaleDateString()}</span>
            </div>
            <div class="row-actions">
              <button class="btn" onclick={() => applyProfile(p)} disabled={!canWrite || busy || applying !== null}>
                {applying === p.id ? 'Applying…' : 'Apply'}
              </button>
              <button class="btn quiet" onclick={() => download(p)}>Export</button>
              <button class="btn quiet" onclick={() => remove(p)} aria-label="Delete {p.name}">Delete</button>
            </div>
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
          {#each outcome.lines as line (line.row)}
            <li class={line.tone}><Icon name={line.tone === 'confirmed' ? 'check' : line.tone === 'signal' ? 'alert' : 'unverified'} size={14} />{line.text}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <p class="muted" aria-live="polite">{notice}</p>
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
    font-size: var(--step-1);
    font-weight: 600;
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
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .file {
    position: relative;
    cursor: pointer;
  }

  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .file:focus-within {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line);
  }

  .what {
    display: grid;
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
</style>
