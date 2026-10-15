import { describe, expect, it } from 'vitest';
import * as via from '../src/adapters/qmk-via.ts';
import { ViaSession } from '../src/adapters/qmk-via-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected, type OutgoingReport } from '../src/lib/transport.ts';
import { ViaSim } from './qmk-via-sim.ts';
import logs from './fixtures/via-issue-logs.json';

const out = (bytes: number[]): OutgoingReport => {
  const data = new Uint8Array(via.PAYLOAD);
  data.set(bytes);
  return { type: 'output', reportId: 0, data };
};
const exchanges = logs.captures.flatMap((c) => c.exchanges.map((x) => ({ device: c.device, ...x })));

describe('qmk-via framing', () => {
  it('sends 32-byte output reports with no report ID, like the VIA app', () => {
    expect(via.protocolVersion()).toEqual(out([0x01]));
    expect(via.getValue('rgbMatrix', 'brightness').data.subarray(0, 4)).toEqual(Uint8Array.of(8, 3, 1, 0));
    expect(via.setValue('rgblight', 'color', [170, 255]).data.subarray(0, 6)).toEqual(Uint8Array.of(7, 2, 4, 170, 255, 0));
    expect(via.save('ledMatrix').data.subarray(0, 3)).toEqual(Uint8Array.of(9, 5, 0));
  });
});

describe('qmk-via replies (captures from VIA error logs on real keyboards)', () => {
  it.each(exchanges.filter((x) => x.response[0] === 255))('matches the unhandled echo from $device to $command', ({ command, response }) => {
    const req = out(command).data;
    const res = Uint8Array.from(response);
    expect(via.isReply(req, res)).toBe(true);
    expect(via.unhandled(res)).toBe(true);
    if (command[0] === via.CMD.getValue) expect(via.decodeValue(req, res)).toBeNull();
  });

  it('rejects replies that arrive one command late (Quefrency Rev. 3)', () => {
    const late = exchanges.filter((x) => x.device === 'Quefrency Rev. 3');
    expect(late).toHaveLength(3);
    for (const { command, response } of late) expect(via.isReply(out(command).data, Uint8Array.from(response))).toBe(false);
    // The first late reply is the keyboard's answer to `01`: protocol version 9.
    const versionReply = Uint8Array.from(late[0]!.response);
    expect(via.isReply(via.protocolVersion().data, versionReply)).toBe(true);
    expect(via.decodeVersion(versionReply)).toBe(9);
  });

  it('decodes values and rejects short or mismatched replies', () => {
    const req = via.getValue('rgbMatrix', 'color').data;
    const res = Uint8Array.from(req);
    res.set([85, 200], 3);
    expect(via.decodeValue(req, res)).toEqual([85, 200]);
    expect(via.decodeValue(req, res.subarray(0, 16))).toBeNull();
    expect(via.decodeValue(via.getValue('rgblight', 'color').data, res)).toBeNull();
    const breathing = via.getValue('backlight', 'effect').data;
    expect(via.decodeValue(breathing, Uint8Array.from(breathing, (v, i) => (i === 3 ? 2 : v)))).toBeNull();
    expect(via.decodeLayerCount(Uint8Array.of(0x11, 0, ...new Array(30).fill(0)))).toBeNull();
  });
});

describe('qmk-via allowlist', () => {
  const v13 = via.allowFor(0x0d);

  it('allows only the version query before the handshake', () => {
    const before = via.allowFor(null);
    expect(before(via.protocolVersion())).toBe(true);
    expect(before(via.layerCount())).toBe(false);
    expect(before(via.getValue('rgbMatrix', 'brightness'))).toBe(false);
  });

  it('allows the layer count but no lighting on protocol 9-11 (Vial reports 9)', () => {
    for (const v of [9, 10, 11]) {
      expect(via.allowFor(v)(via.layerCount())).toBe(true);
      expect(via.allowFor(v)(via.getValue('rgblight', 'brightness'))).toBe(false);
      expect(via.allowFor(v)(out([0x08, 0x80]))).toBe(false);
    }
  });

  it('allows nothing but the version query on unknown versions', () => {
    for (const v of [8, 14, 0x0100]) {
      expect(via.allowFor(v)(via.protocolVersion())).toBe(true);
      expect(via.allowFor(v)(via.layerCount())).toBe(false);
    }
  });

  it('allows get, set and save on the four lighting channels', () => {
    for (const ch of via.CHANNELS) {
      expect(v13(via.save(ch))).toBe(true);
      for (const v of via.VALUES[ch]) {
        expect(v13(via.getValue(ch, v))).toBe(true);
        expect(v13(via.setValue(ch, v, v === 'color' ? [255, 255] : [via.maxOf(ch, v)]))).toBe(true);
      }
    }
  });

  it.each([
    ['bootloader jump', [0x0b]],
    ['EEPROM reset', [0x0a]],
    ['dynamic keymap reset', [0x06]],
    ['macro reset', [0x10]],
    ['keycode write', [0x05, 0, 0, 0, 0x7c, 0x00]],
    ['macro buffer write', [0x0f, 0, 0, 4, 1, 2, 3, 4]],
    ['keymap buffer write', [0x13, 0, 0, 2, 0, 4]],
    ['encoder write', [0x15, 0, 0, 1, 0, 4]],
    ['switch matrix state (keystrokes)', [0x02, 0x03]],
    ['set keyboard value (layout options)', [0x03, 0x02, 0, 0, 0, 1]],
    ['device indication', [0x03, 0x05, 1]],
    ['channel 0 (keyboard-specific values)', [0x08, 0x00, 0x01]],
    ['channel 4 (audio)', [0x07, 0x04, 0x01, 1]],
    ['the protocol-9 rgblight layout', [0x08, 0x80]],
    ['an unknown value ID on a known channel', [0x08, 0x03, 0x05]],
    ['colour on the LED matrix (no colour)', [0x07, 0x05, 0x04, 1, 1]],
    ['backlight breathing value 2', [0x07, 0x01, 0x02, 2]],
    ['trailing bytes after a value', [0x07, 0x03, 0x01, 100, 1]],
    ['trailing bytes after a get', [0x08, 0x03, 0x01, 0, 0, 9]],
    ['Vial commands', [0xfe, 0x00]],
    ['the version query with garbage', [0x01, 0x01]],
  ])('refuses %s', (_name, bytes) => {
    expect(v13(out(bytes))).toBe(false);
  });

  it('refuses the wrong report type, ID or length', () => {
    const r = via.protocolVersion();
    expect(v13({ ...r, reportId: 1 })).toBe(false);
    expect(v13({ ...r, type: 'feature' })).toBe(false);
    expect(v13({ ...r, data: new Uint8Array(64) })).toBe(false);
  });
});

describe('qmk-via session (simulator, not hardware evidence)', () => {
  it('identifies as VIA and finds the lighting channels the firmware has', async () => {
    const s = new ViaSession(new ViaSim({ channels: { rgbMatrix: { max: 255 }, rgblight: { max: 255 } } }), []);
    expect(await s.handshake()).toBe(0x0d);
    expect(await s.layerCount()).toBe(4);
    expect(await s.channels()).toEqual(['rgblight', 'rgbMatrix']);
  });

  it('sends nothing after `01` to a raw HID device that is not VIA', async () => {
    const sim = new ViaSim({ notVia: true });
    const s = new ViaSession(sim, []);
    expect(await s.handshake()).toBeNull();
    await expect(s.layerCount()).rejects.toBeInstanceOf(TransportRejected);
    expect(sim.sent).toHaveLength(1);
  });

  it('sends no lighting commands to protocol-9 firmware', async () => {
    const s = new ViaSession(new ViaSim({ version: 9 }), []);
    expect(await s.handshake()).toBe(9);
    expect(await s.layerCount()).toBe(4);
    await expect(s.channels()).rejects.toBeInstanceOf(TransportRejected);
  });

  it('writes, saves and confirms only what the keyboard reads back', async () => {
    const sim = new ViaSim({ channels: { rgbMatrix: { max: 255 } } });
    const s = new ViaSession(sim, []);
    await s.handshake();
    expect(await applySetting(s.level('rgbMatrix', 'speed'), 200, 127)).toEqual({ kind: 'confirmed', value: 200 });
    expect(await applySetting(s.color('rgbMatrix'), { hue: 85, sat: 128 }, { hue: 0, sat: 255 })).toEqual({
      kind: 'confirmed',
      value: { hue: 85, sat: 128 },
    });
    // Each write is set, then save, then the read-back.
    expect(sim.sent.slice(-3).map((b) => b.slice(0, 5))).toEqual([
      [7, 3, 4, 85, 128],
      [9, 3, 0, 0, 0],
      [8, 3, 4, 0, 0],
    ]);
    sim.powerCycle();
    expect(await s.color('rgbMatrix').read()).toEqual({ hue: 85, sat: 128 });
  });

  it('confirms a brightness the board rescaled, and shows what it returned', async () => {
    const s = new ViaSession(new ViaSim({ channels: { rgbMatrix: { max: 200 } } }), []);
    await s.handshake();
    expect(await applySetting(s.level('rgbMatrix', 'brightness'), 100, 255)).toEqual({ kind: 'confirmed', value: 99 });
  });

  it('restores when the board uses coarser brightness steps (3 backlight levels)', async () => {
    const s = new ViaSession(new ViaSim({ channels: { backlight: { max: 3 } } }), []);
    await s.handshake();
    expect(await applySetting(s.level('backlight', 'brightness'), 128, 255)).toEqual({
      kind: 'mismatch',
      requested: 128,
      actual: 85,
      restored: 255,
      restoreConfirmed: true,
    });
  });

  it('restores an effect the firmware clamped', async () => {
    const s = new ViaSession(new ViaSim({ channels: { rgbMatrix: { max: 255, effects: 40 } } }), []);
    await s.handshake();
    expect(await applySetting(s.level('rgbMatrix', 'effect'), 60, 1)).toEqual({
      kind: 'mismatch',
      requested: 60,
      actual: 39,
      restored: 1,
      restoreConfirmed: true,
    });
    expect(await applySetting(s.level('rgbMatrix', 'effect'), 0, 1)).toEqual({ kind: 'confirmed', value: 0 });
  });

  it('reports a firmware that ignores writes', async () => {
    const s = new ViaSession(new ViaSim({ ignoreWrites: true }), []);
    await s.handshake();
    expect(await applySetting(s.level('rgbMatrix', 'speed'), 10, 127)).toMatchObject({ kind: 'mismatch', actual: 127 });
  });

  it('refuses invalid values before sending anything', async () => {
    const sim = new ViaSim({ channels: { backlight: { max: 3 } } });
    const s = new ViaSession(sim, []);
    await s.handshake();
    const before = sim.sent.length;
    expect(await applySetting(s.level('backlight', 'effect'), 2, 0)).toMatchObject({ kind: 'invalid' });
    expect(await applySetting(s.level('backlight', 'brightness'), 256, 0)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(before);
  });

  it('cannot be talked into a denied collection', async () => {
    const s = new ViaSession(new ViaSim(), [{ usagePage: 0xff60, usage: 0x0061 }]);
    await expect(s.handshake()).rejects.toBeInstanceOf(TransportRejected);
  });
});
