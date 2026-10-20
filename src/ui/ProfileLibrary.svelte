<script lang="ts">
  // Home → Profiles: every Mouse and Keyboard profile in this browser, made and
  // edited without a device. Applying happens inside a device (ProfileBar).
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
    type Category,
    type Profile,
  } from '../lib/profiles.ts';
  import { migrateV1 } from '../lib/profile-map.ts';

  let { back = '/#/app' }: { back?: string } = $props();

  const store = browserStore();
  let all = $state<Profile[]>(store ? loadProfiles(store, migrateV1) : []);
  /** A profile id, or "new-mouse" / "new-keyboard". */
  let editing = $state<string | null>(null);
  let notice = $state('');

  const SECTIONS: { category: Profile['category']; title: string }[] = [
    { category: 'mouse', title: 'Mouse' },
    { category: 'keyboard', title: 'Keyboard' },
    { category: 'v1', title: 'Kept from an older version' },
  ];
  const BLANK: Record<Category, Body> = {
    mouse: { name: 'New mouse profile', category: 'mouse', mouse: { dpiStages: [400, 800, 1600], activeStage: 1, pollingHz: 1000 } },
    keyboard: { name: 'New keyboard profile', category: 'keyboard', keyboard: { color: '#49aa57', brightness: 80 } },
  };

  const reload = () => (all = store ? loadProfiles(store, migrateV1) : []);
  function say(text: string) {
    notice = text;
    setTimeout(() => (notice = ''), 5000);
  }

  function put(body: Body, id: string = crypto.randomUUID()) {
    try {
      saveProfile(store!, { ...body, id, savedAt: new Date().toISOString() }, migrateV1);
    } catch {
      return say('The browser would not store the profile (storage may be full or blocked).');
    }
    reload();
    editing = null;
    say(`Saved “${body.name}”.`);
  }

  function remove(p: Profile) {
    deleteProfile(store!, p.id, migrateV1);
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
    put(parsed.profile);
  }
</script>

<main class="library" aria-labelledby="profiles-title">
  <header class="head">
    <a class="btn quiet back" href={back}><Icon name="back" />{back === '/#/' ? 'Back to the cover' : 'Home'}</a>
    <h1 id="profiles-title" tabindex="-1">Profiles</h1>
    <Guide size={52}>
      <p>
        Profiles live in this browser only. A mouse profile works on any mouse UDB can write, a keyboard profile on any
        keyboard. Open a device to apply one; I'll write each value, read it back, and tell you what the device couldn't take.
      </p>
    </Guide>
  </header>

  {#if !store}
    <p class="muted">This browser blocks storage, so profiles can't be kept here.</p>
  {:else}
    <div class="tools">
      <button class="btn primary" onclick={() => (editing = 'new-mouse')}><Icon name="plus" />New mouse profile</button>
      <button class="btn" onclick={() => (editing = 'new-keyboard')}><Icon name="plus" />New keyboard profile</button>
      <label class="btn file">
        Import file
        <input type="file" accept=".json,application/json" onchange={importFile} />
      </label>
    </div>
    <p class="muted" aria-live="polite">{notice}</p>

    {#if editing === 'new-mouse' || editing === 'new-keyboard'}
      {#key editing}
        <ProfileEditor initial={BLANK[editing === 'new-mouse' ? 'mouse' : 'keyboard']} onsave={(b) => put(b)} oncancel={() => (editing = null)} />
      {/key}
    {/if}

    {#each SECTIONS as sec (sec.category)}
      {@const list = all.filter((p) => p.category === sec.category)}
      {#if list.length || sec.category !== 'v1'}
        <section class="group" aria-labelledby="sec-{sec.category}">
          <h2 id="sec-{sec.category}">{sec.title}</h2>
          {#if sec.category === 'v1'}
            <p class="muted">These were saved for one device and hold settings no category profile covers (like a headset's sidetone). They can be exported, not applied.</p>
          {/if}
          {#if list.length === 0}
            <p class="muted">No {sec.title.toLowerCase()} profiles yet.</p>
          {:else}
            <ul class="list">
              {#each list as p (p.id)}
                <li>
                  <div class="row">
                    <div class="what">
                      <strong>{p.name}</strong>
                      <span class="muted">{summary(p)}{#if p.mouse?.color ?? p.keyboard?.color}<span class="chip" style:background-color={p.mouse?.color ?? p.keyboard?.color} aria-hidden="true"></span>{/if}</span>
                      <span class="when">saved {new Date(p.savedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="row-actions">
                      {#if p.category !== 'v1'}
                        <button class="btn quiet" onclick={() => (editing = editing === p.id ? null : p.id)} aria-expanded={editing === p.id}>Edit</button>
                      {/if}
                      <button class="btn quiet" onclick={() => downloadProfile(p)}>Export</button>
                      <button class="btn quiet" onclick={() => remove(p)} aria-label="Delete {p.name}">Delete</button>
                    </div>
                  </div>
                  {#if editing === p.id}
                    <ProfileEditor initial={p} onsave={(b) => put(b, p.id)} oncancel={() => (editing = null)} />
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    {/each}
  {/if}
</main>

<style>
  .library {
    flex: 1;
    width: 100%;
    max-width: 60rem;
    margin: 0 auto;
    display: grid;
    align-content: start;
    gap: var(--space-6);
    padding: var(--space-6) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
  }

  .head {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  .back {
    margin-left: calc(-1 * var(--space-3));
    text-decoration: none;
  }

  h1 {
    font: 600 var(--step-4) / 1.05 var(--font-brand);
    letter-spacing: -0.01em;
  }

  h2 {
    font: 600 var(--step-2) / 1.2 var(--font-brand);
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .muted {
    color: var(--muted);
    max-width: 68ch;
  }

  .muted:empty {
    display: none;
  }

  .group {
    display: grid;
    gap: var(--space-3);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }

  .list > li {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--line);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .what {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }

  .what strong {
    overflow-wrap: anywhere;
  }

  .when {
    font-size: var(--step--1);
    color: var(--faint);
  }

  .chip {
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    margin-left: var(--space-2);
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    vertical-align: -0.05em;
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
</style>
