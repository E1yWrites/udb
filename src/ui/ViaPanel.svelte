<script lang="ts" module>
  import type { LogEntry } from '../lib/transport.ts';
  // Per device for this page session (kept across reconnects): byte log, writes,
  // and the last value each setting confirmed, for persistence checks.
  const history = new Map<string, { log: LogEntry[]; writes: unknown[] }>();
  const confirmedWrites = new Map<string, Record<string, { value: number; reconnects: number }>>();
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import ProfileBar from './ProfileBar.svelte';
  import ViaKeymap from './ViaKeymap.svelte';
  import { logFor } from '../lib/history.svelte.ts';
  import SettingLine from './SettingLine.svelte';
  import RangeField from './controls/RangeField.svelte';
  import Segments from './controls/Segments.svelte';
  import ColorPick from './controls/ColorPick.svelte';
  import { rowWriter } from '../lib/commit.ts';
  import { hexToHueSat, hueSatToHex } from '../lib/color.ts';
  import { ViaSession } from '../adapters/qmk-via-session.ts';
  import { VALUES, hasChannels, knownVersion, maxOf, type Channel } from '../adapters/qmk-via.ts';
  import type { UdbDevice } from '../lib/devices.svelte.ts';
  import { hex, type Collection } from '../lib/registry.ts';
  import { open } from '../lib/transport.ts';
  import { applySetting, type Setting, type WriteResult } from '../lib/write.ts';

  let { device }: { device: UdbDevice } = $props();
  const entry = $derived(device.match!.entry);

  type Part = 'brightness' | 'effect' | 'speed' | 'hue' | 'sat';
  type Row = `${Channel}.${Part}`;
  const CHANNEL_NAME: Record<Channel, string> = {
    backlight: 'Backlight',
    rgblight: 'Underglow (RGB light)',
    rgbMatrix: 'RGB matrix',
    ledMatrix: 'LED matrix',
  };
  const PART_NAME: Record<Part, string> = { brightness: 'Brightness', effect: 'Effect', speed: 'Effect speed', hue: 'Hue', sat: 'Saturation' };
  const partsOf = (ch: Channel): Part[] => VALUES[ch].flatMap((v): Part[] => (v === 'color' ? ['hue', 'sat'] : [v]));
  const split = (row: Row) => row.split('.') as [Channel, Part];

  let phase = $state<'idle' | 'reading' | 'ready' | 'error'>('idle');
  let error = $state('');
  let version = $state<number | null>(null);
  let layers = $state<number | null>(null);
  let channels = $state<Channel[]>([]);
  let readings = $state<Partial<Record<Row, { value: number | null; at: string }>>>({});
  let requested = $state<Partial<Record<Row, number>>>({});
  let results = $state<Partial<Record<Row, WriteResult<number> & { at: string }>>>({});
  let busy = $state<Row | null>(null);
  let allowUnverified = $state(false);
  let checks = $state<{ row: Row; expected: number; observed: number | null }[]>([]);
  let copied = $state(false);
  let session = $state.raw<ViaSession | null>(null);

  function historyFor(key: string) {
    if (!history.has(key)) history.set(key, { log: logFor(key), writes: [] });
    return history.get(key)!;
  }
  const past = $derived(historyFor(device.key));
  const now = () => new Date().toISOString();
  const pairs = (list: Collection[]) => list.map((c) => ({ usagePage: hex(c.usagePage), usage: hex(c.usage) }));

  function setting(row: Row): Setting<number> {
    const [ch, part] = split(row);
    if (part === 'hue' || part === 'sat') return session!.colorPart(ch, part === 'hue' ? 0 : 1);
    return session!.level(ch, part);
  }

  function show(row: Row, v: number | null | undefined): string {
    if (v == null) return 'Unreadable';
    const [ch, part] = split(row);
    if (part === 'effect' && ch === 'backlight') return v ? 'Breathing' : 'Steady';
    if (part === 'effect') return v === 0 ? 'Off' : `Effect ${v}`;
    return `${v} of 255`;
  }

  /** The colour the keyboard reported, as #rrggbb (QMK hue and saturation are 0-255). */
  function swatch(ch: Channel): string | null {
    const h = readings[`${ch}.hue`]?.value;
    const s = readings[`${ch}.sat`]?.value;
    return h == null || s == null ? null : hueSatToHex(h, s);
  }

  /** A swatch or the picker: two writes (hue, then saturation), each read back. */
  function pickColor(ch: Channel, hex: string) {
    const hs = hexToHueSat(hex);
    if (!hs) return;
    requested[`${ch}.hue`] = hs.hue;
    requested[`${ch}.sat`] = hs.sat;
    writer.commit(`${ch}.hue`);
    writer.commit(`${ch}.sat`);
  }

  const HUE_TRACK = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
  const satTrack = (ch: Channel) => `linear-gradient(to right, #fff, ${hueSatToHex(requested[`${ch}.hue`] ?? 0, 255)})`;

  async function read() {
    phase = 'reading';
    error = '';
    const use = pairs(entry.collections.use);
    const hid = device.interfaces.find((i) => i.collections.some((c) => use.some((u) => u.usagePage === c.usagePage && u.usage === c.usage)));
    if (!hid) {
      phase = 'error';
      error = 'The keyboard’s VIA interface (FF60) is not granted. Use “Add device” and pick the keyboard again.';
      return;
    }
    const opened = await open(hid);
    if (!opened.ok) {
      phase = 'error';
      error = `Could not open the keyboard (${opened.error}). Close ${entry.conflictingSoftware?.join(' or ') ?? 'other configuration apps'} and try again.`;
      return;
    }
    session = new ViaSession(hid, pairs(entry.collections.deny), past.log);
    try {
      version = await session.handshake();
      layers = knownVersion(version) ? await session.layerCount() : null;
      channels = hasChannels(version) ? await session.channels() : [];
      readings = {};
      results = {};
      for (const ch of channels) {
        for (const part of partsOf(ch)) {
          const row: Row = `${ch}.${part}`;
          const value = await setting(row).read();
          readings[row] = { value, at: now() };
          if (value !== null) requested[row] = value;
        }
      }
      // Only writes confirmed before the latest real disconnect/reconnect count as a persistence check.
      const remembered = Object.entries(confirmedWrites.get(device.key) ?? {}).filter(([, w]) => device.reconnects > w.reconnects);
      checks = remembered.map(([row, w]) => ({ row: row as Row, expected: w.value, observed: readings[row as Row]?.value ?? null }));
      phase = 'ready';
    } catch (e) {
      phase = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

  // All writes go through one queue: one at a time, and a control ends on its newest value (src/lib/commit.ts).
  const writer = rowWriter<Row>(applyNow);
  const apply = writer.apply;

  async function applyNow(row: Row) {
    const previous = readings[row]?.value;
    const value = requested[row];
    if (previous == null || value == null || value === previous) return;
    busy = row;
    const result = await applySetting(setting(row), value, previous);
    const at = now();
    results[row] = { ...result, at };
    past.writes.push({ setting: row, requested: value, previous, result, at, reconnects: device.reconnects });
    if (result.kind === 'confirmed') {
      readings[row] = { value: result.value, at };
      requested[row] = result.value; // a rescaled brightness confirms as the value the keyboard returned
      confirmedWrites.set(device.key, { ...(confirmedWrites.get(device.key) ?? {}), [row]: { value: result.value, reconnects: device.reconnects } });
    } else if (result.kind === 'mismatch') {
      readings[row] = { value: result.restored, at };
    } else if (result.kind === 'failed') {
      readings[row] = { value: result.actual, at };
    }
    // The control shows what the device returned, unless a newer value is already queued.
    if (!writer.queued(row)) requested[row] = readings[row]?.value ?? requested[row];
    busy = null;
  }

  /** Profile apply: the saved value goes through this panel's own write procedure, read back. */
  async function applyProfileRow(row: string, value: number) {
    results[row as Row] = undefined;
    requested[row as Row] = value;
    await apply(row as Row);
    return results[row as Row];
  }

  async function copyEvidence() {
    const report = {
      udbEvidence: 1,
      date: now().slice(0, 10),
      userAgent: navigator.userAgent,
      device: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, registryId: entry.id },
      viaProtocol: version,
      layers,
      channels: $state.snapshot(channels),
      readings: $state.snapshot(readings),
      reconnects: device.reconnects,
      persistenceChecks: $state.snapshot(checks),
      writes: past.writes,
      log: past.log,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }
</script>

<section class="live" aria-labelledby="via-live">
  <h2 id="via-live" class="section">Live from the device</h2>

  {#if phase !== 'ready'}
    <p class="lede">
      UDB first asks the keyboard whether it speaks VIA, then reads its lighting. Reading changes nothing. The only
      commands UDB can send are the version and layer queries, lighting reads, writes and saves, and, once you load a
      keyboard definition, reading keys and changing one key to a basic key. Never bootloader, reset or macro commands.
    </p>
    {#if phase === 'error'}<p class="problem" role="alert"><Icon name="alert" />{error}</p>{/if}
    <button class="btn primary" onclick={read} disabled={phase === 'reading'}>
      {phase === 'reading' ? 'Reading…' : 'Read from keyboard'}
    </button>
  {:else}
    <dl class="facts">
      <div>
        <dt>VIA protocol</dt>
        <dd>
          {#if version === null}
            <span class="status signal"><Icon name="alert" size={14} />Did not answer as VIA</span>
          {:else}
            <span class="num">{version}</span>
            {#if hasChannels(version)}
              <span class="status confirmed"><Icon name="check" size={14} />Known to UDB</span>
            {:else}
              <span class="status signal"><Icon name="unverified" size={14} />No lighting commands for this version</span>
            {/if}
          {/if}
        </dd>
      </div>
      {#if layers !== null}
        <div>
          <dt>Keymap layers</dt>
          <dd class="num">{layers}</dd>
        </div>
      {/if}
      {#if hasChannels(version)}
        <div>
          <dt>Lighting</dt>
          <dd>{channels.length ? channels.map((c) => CHANNEL_NAME[c]).join(', ') : 'None in this firmware'}</dd>
        </div>
      {/if}
    </dl>

    {#if version === null}
      <p class="note">
        This device has QMK’s raw HID interface but did not answer the VIA version query. It may be a QMK board built
        without VIA, or another device using the same interface. UDB sent only that query and will send nothing else.
      </p>
    {:else if !knownVersion(version)}
      <p class="note">UDB knows VIA protocols 9 to 13, so it sends nothing else to this keyboard.</p>
    {:else if !hasChannels(version)}
      <p class="note">
        Before protocol 12 (QMK 0.19), the lighting commands used a different layout, and Vial reports protocol 9.
        UDB sends no lighting commands to this firmware.
      </p>
    {/if}

    {#if checks.length}
      <div class="checks" role="status">
        <h3>After the device reconnected</h3>
        <ul>
          {#each checks as c (c.row)}
            {@const kept = c.observed === c.expected}
            <li class={kept ? 'confirmed' : 'signal'}>
              <Icon name={kept ? 'check' : 'alert'} size={14} />
              {CHANNEL_NAME[split(c.row)[0]]}, {PART_NAME[split(c.row)[1]].toLowerCase()}:
              {kept ? 'kept' : 'changed to'} {show(c.row, c.observed)}
              {#if !kept}(last confirmed {show(c.row, c.expected)}){/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if channels.length}
      <label class="gate">
        <input type="checkbox" bind:checked={allowUnverified} />
        <span>
          Allow writes to unverified settings. UDB saves each change to the keyboard, reads it back, and restores the
          previous value if the keyboard disagrees.
        </span>
      </label>

      {#each channels as ch (ch)}
        {@const color = swatch(ch)}
        <h3 class="group">
          {CHANNEL_NAME[ch]}
          {#if color}<span class="chip" style:background-color={color} aria-hidden="true"></span>{/if}
        </h3>
        {#if partsOf(ch).includes('hue')}
          <div class="colorline">
            <label class="name" for="via-{ch}-color">Colour</label>
            <ColorPick id="via-{ch}-color" value={color} disabled={!allowUnverified} onpick={(hex) => pickColor(ch, hex)} />
          </div>
        {/if}
        <div class="lines">
          {#each partsOf(ch) as part (part)}
            {@const row = `${ch}.${part}` as Row}
            <SettingLine
              id="via-{ch}-{part}"
              label={PART_NAME[part]}
              value={readings[row]?.value}
              readAt={readings[row]?.at}
              busy={busy === row}
              result={results[row]}
              show={(v) => show(row, v)}
            >
              {#if part === 'effect' && maxOf(ch, 'effect') === 1}
                <Segments
                  id="via-{ch}-{part}"
                  label={PART_NAME[part]}
                  options={[{ value: 0, label: 'Steady' }, { value: 1, label: 'Breathing' }]}
                  bind:value={requested[row]}
                  disabled={!allowUnverified}
                  oncommit={() => writer.commit(row)}
                />
              {:else if part !== 'effect'}
                <RangeField
                  id="via-{ch}-{part}"
                  label={PART_NAME[part]}
                  min={0}
                  max={255}
                  track={part === 'hue' ? HUE_TRACK : part === 'sat' ? satTrack(ch) : undefined}
                  bind:value={requested[row]}
                  disabled={!allowUnverified}
                  oncommit={() => writer.commit(row)}
                />
              {:else}
                <input
                  id="via-{ch}-{part}"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="255"
                  step="1"
                  bind:value={requested[row]}
                  disabled={!allowUnverified || busy !== null}
                />
                <button
                  class="btn"
                  onclick={() => apply(row)}
                  disabled={!allowUnverified || busy !== null || requested[row] == null || requested[row] === readings[row]?.value}
                >
                  {busy === row ? 'Writing…' : 'Apply'}
                </button>
              {/if}
            </SettingLine>
          {/each}
        </div>
      {/each}
      <p class="note">
        Effect numbers depend on the effects this firmware was built with; 0 turns the lighting off. The keyboard scales
        brightness to its own maximum, so it can report a slightly different value than the one you set.
      </p>
    {/if}

    {#if session && knownVersion(version) && layers !== null}
      {#key session}
        <ViaKeymap {session} {layers} vendorId={device.vendorId} productId={device.productId} reconnects={device.reconnects} writes={past.writes} />
      {/key}
    {/if}

    <ProfileBar
      entryId={entry.id}
      current={Object.fromEntries(Object.entries(readings).map(([r, x]) => [r, x?.value]))}
      label={(r) => `${CHANNEL_NAME[r.split('.')[0] as Channel]}: ${PART_NAME[r.split('.')[1] as Part]}`}
      show={(r, v) => show(r as Row, v)}
      canWrite={allowUnverified}
      busy={busy !== null}
      apply={applyProfileRow}
    />

    <footer class="actions">
      <button class="btn" onclick={read} disabled={busy !== null}>Read again</button>
      <button class="btn" onclick={copyEvidence}><Icon name="copy" />Copy evidence report</button>
      <span class="muted" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </footer>
  {/if}
</section>

<style>
  .group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
    font-size: var(--step-0);
    font-weight: 600;
  }

  .colorline {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .colorline .name {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--muted);
  }

  .chip {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border: 1px solid var(--line-strong);
  }
</style>
