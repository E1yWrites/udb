<script lang="ts">
  // Every registry entry, searchable, with what UDB knows about each feature.
  // Same facts as SUPPORT.md: only read-verified and write-verified mean a result
  // was seen on real hardware, so nothing here may read as "supported" otherwise.
  import Icon from './Icon.svelte';
  import DeviceArt from './DeviceArt.svelte';
  import { registry, type Category, type FeatureStatus } from '../lib/registry.ts';
  import { LOCATION, STATUS, featureLabel } from '../lib/labels.ts';

  const CATEGORIES: { value: Category | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mouse', label: 'Mice' },
    { value: 'keyboard', label: 'Keyboards' },
    { value: 'headset', label: 'Headsets' },
  ];
  const ORDER: FeatureStatus[] = ['write-verified', 'read-verified', 'experimental', 'detected', 'unsupported'];

  let { back = '#/app' }: { back?: string } = $props();

  let query = $state('');
  let category = $state<Category | 'all'>('all');

  const haystack = new Map(
    registry.map((e) => [
      e.id,
      [e.vendor, e.model, e.id, e.protocol.family, ...e.identities.flatMap((i) => (i.vid && i.pid ? [`${i.vid.slice(2)}:${i.pid.slice(2)}`] : []))]
        .join(' ')
        .toLowerCase(),
    ]),
  );
  const shown = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return registry.filter((e) => (category === 'all' || e.category === category) && words.every((w) => haystack.get(e.id)!.includes(w)));
  });

  const summary = (statuses: FeatureStatus[]) =>
    ORDER.flatMap((s) => {
      const n = statuses.filter((x) => x === s).length;
      return n ? [{ status: s, n }] : [];
    });
</script>

<main class="supported" aria-labelledby="supported-title">
  <header class="head">
    <a class="btn quiet back" href={back}><Icon name="back" />{back === '#/' ? 'Back to the cover' : 'Home'}</a>
    <h1 id="supported-title" tabindex="-1">Supported devices</h1>
    <p class="lede">
      Every model UDB recognises and what it knows about each setting. <strong>Unverified</strong> means the protocol was
      researched but no result has been seen on real hardware yet.
    </p>
  </header>

  <div class="filters">
    <label class="search">
      <Icon name="search" />
      <span class="visually-hidden">Search by name, brand, protocol or USB ID</span>
      <input type="search" placeholder="Search: “pulsar”, “g502”, “046d:c539”" bind:value={query} />
    </label>
    <fieldset class="cats">
      <legend class="visually-hidden">Category</legend>
      {#each CATEGORIES as c (c.value)}
        <label>
          <input type="radio" name="udb-category" value={c.value} bind:group={category} />
          {c.label}
        </label>
      {/each}
    </fieldset>
  </div>

  <p class="count" aria-live="polite"><span class="num">{shown.length}</span> of <span class="num">{registry.length}</span> models</p>

  {#if shown.length === 0}
    <p class="empty">
      Nothing matches. If your device is missing, add it under “My device isn't listed” on Home and copy its report into
      <a href="https://github.com/E1yWrites/udb/issues/new" target="_blank" rel="noreferrer">an issue</a>.
    </p>
  {:else}
    <ul class="list">
      {#each shown as e (e.id)}
        <li>
          <details>
            <summary>
              <span class="art"><DeviceArt entryId={e.id} kind={e.category} alt="" /></span>
              <span class="what">
                <strong>{e.vendor} {e.model}</strong>
                <span class="meta"><span class="tag">{e.category}</span><span class="data">{e.protocol.family}</span></span>
              </span>
              <span class="sum">
                {#each summary(e.features.map((f) => f.status)) as s (s.status)}
                  <span class="status {STATUS[s.status].tone}"><Icon name={STATUS[s.status].icon} size={14} /><span class="num">{s.n}</span> {STATUS[s.status].word.toLowerCase()}</span>
                {/each}
              </span>
            </summary>
            <ul class="features">
              {#each e.features as f (f.id)}
                {@const st = STATUS[f.status]}
                <li>
                  <span>{featureLabel(f.id)}</span>
                  <span class="tag">{LOCATION[f.location]}</span>
                  <span class="status {st.tone}"><Icon name={st.icon} size={14} />{st.word}</span>
                </li>
              {/each}
            </ul>
            {#if e.limitations.length}
              <ul class="limits">
                {#each e.limitations as l (l)}<li>{l}</li>{/each}
              </ul>
            {/if}
          </details>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .supported {
    flex: 1;
    width: 100%;
    max-width: 68rem;
    margin: 0 auto;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    padding: var(--space-6) clamp(var(--space-4), 4vw, var(--space-12)) var(--space-12);
  }

  .head {
    display: grid;
    gap: var(--space-3);
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

  .lede {
    color: var(--muted);
    max-width: 68ch;
  }

  .filters {
    position: sticky;
    top: 3.75rem;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    background: var(--bg);
  }

  .search {
    flex: 1 1 18rem;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--muted);
  }

  .search:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .search input::placeholder {
    color: var(--faint);
  }

  .cats {
    display: inline-flex;
    margin: 0;
    padding: 3px;
    gap: 2px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--rail);
  }

  .cats label {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border-radius: 999px;
    color: var(--muted);
    font-weight: 600;
    font-size: var(--step--1);
    cursor: pointer;
  }

  .cats label:has(input:checked) {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 4px -2px oklch(0 0 0 / 0.45);
  }

  .cats label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .cats input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .count,
  .empty {
    color: var(--faint);
    font-size: var(--step--1);
  }

  .list {
    interpolate-size: allow-keywords;
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }

  .list > li {
    border-bottom: 1px solid var(--line);
  }

  /* Rows open to their height instead of snapping (Chromium, which WebHID needs anyway). */
  details::details-content {
    block-size: 0;
    overflow: clip;
    transition:
      block-size 220ms var(--ease-out),
      content-visibility 220ms allow-discrete;
  }

  details[open]::details-content {
    block-size: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    details::details-content {
      transition: none;
    }
  }

  summary {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr) auto;
    gap: var(--space-3) var(--space-4);
    align-items: center;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--radius);
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover {
    background: var(--surface);
  }

  .art {
    display: block;
    width: 3.5rem;
    height: 3.5rem;
    padding: var(--space-1);
    border-radius: var(--radius);
    background: var(--rail);
  }

  .what {
    display: grid;
    min-width: 0;
  }

  .what strong {
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
    color: var(--faint);
  }

  .sum {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-1) var(--space-3);
    font-size: var(--step--1);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    white-space: nowrap;
  }

  .confirmed {
    color: var(--confirmed);
  }

  .signal {
    color: var(--signal);
  }

  .muted {
    color: var(--muted);
  }

  .features,
  .limits {
    margin: 0 0 var(--space-3) calc(3.5rem + var(--space-6));
    padding: 0;
    font-size: var(--step--1);
  }

  .features {
    list-style: none;
    display: grid;
    gap: var(--space-1);
  }

  .features li {
    display: grid;
    grid-template-columns: minmax(0, 14rem) 6rem auto;
    gap: var(--space-3);
    align-items: center;
  }

  .limits {
    padding-left: var(--space-4);
    color: var(--muted);
    max-width: 68ch;
  }

  @media (max-width: 40rem) {
    summary {
      grid-template-columns: 3rem minmax(0, 1fr);
    }

    .art {
      width: 3rem;
      height: 3rem;
    }

    .sum {
      grid-column: 2;
      justify-content: flex-start;
    }

    .features,
    .limits {
      margin-left: var(--space-2);
    }

    .features li {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .features li .tag {
      display: none;
    }
  }
</style>
