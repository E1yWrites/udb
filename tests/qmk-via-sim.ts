// A QMK/VIA keyboard simulator for tests and the dev preview. It follows
// quantum/via.c (docs/protocols/qmk-via.md). A simulator result is never
// hardware evidence.

import { CHANNEL_ID, CMD, PAYLOAD, VALUE_ID, type Channel } from '../src/adapters/qmk-via.ts';

interface Lighting {
  /** The board's brightness maximum (RGB_MATRIX_MAXIMUM_BRIGHTNESS, RGBLIGHT_LIMIT_VAL or BACKLIGHT_LEVELS). */
  max: number;
  /** RGB_MATRIX_EFFECT_MAX and friends: modes 1..effects-1 exist. */
  effects: number;
  val: number;
  mode: number;
  enabled: boolean;
  speed: number;
  hue: number;
  sat: number;
}

export interface ViaSimOptions {
  version?: number;
  layers?: number;
  channels?: Partial<Record<Channel, { max: number; effects?: number }>>;
  /** A QMK raw HID device without VIA: answers every command as unhandled. */
  notVia?: boolean;
  /** Echo writes but keep the old values (a firmware that ignores a setting). */
  ignoreWrites?: boolean;
}

const scale8 = (i: number, scale: number) => (i * (1 + scale)) >> 8;

export class ViaSim {
  opened = true;
  readonly collections = [{ usagePage: 0xff60, usage: 0x0061, inputReports: [{ reportId: 0 }], outputReports: [{ reportId: 0 }] }];
  readonly sent: number[][] = [];
  readonly lights = new Map<Channel, Lighting>();
  /** What `09` saved, restored by powerCycle(). */
  private eeprom = new Map<Channel, Lighting>();
  private listeners = new Set<(e: Event) => void>();
  private opts: ViaSimOptions;

  constructor(opts: ViaSimOptions = {}) {
    this.opts = opts;
    for (const [ch, c] of Object.entries(opts.channels ?? { rgbMatrix: { max: 255 } }) as [Channel, { max: number; effects?: number }][]) {
      const l = { max: c.max, effects: c.effects ?? 40, val: c.max, mode: 1, enabled: true, speed: 127, hue: 0, sat: 255 };
      this.lights.set(ch, l);
      this.eeprom.set(ch, { ...l });
    }
  }

  /** Unplug and replug: RAM settings are lost, EEPROM is reloaded. */
  powerCycle() {
    for (const [ch, l] of this.eeprom) this.lights.set(ch, { ...l });
  }

  addEventListener(_type: string, l: (e: Event) => void) {
    this.listeners.add(l);
  }

  removeEventListener(_type: string, l: (e: Event) => void) {
    this.listeners.delete(l);
  }

  async sendReport(reportId: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer);
    this.sent.push([...b]);
    if (reportId !== 0 || b.length !== PAYLOAD) throw new Error('simulator: bad frame');
    const res = Uint8Array.from(b);
    this.handle(res);
    setTimeout(() => {
      const event = Object.assign(new Event('inputreport'), { reportId, data: new DataView(res.buffer) });
      for (const l of this.listeners) l(event);
    }, 1);
  }

  private handle(d: Uint8Array) {
    if (this.opts.notVia) return void (d[0] = CMD.unhandled);
    const version = this.opts.version ?? 0x0d;
    switch (d[0]) {
      case CMD.protocolVersion:
        d[1] = version >> 8;
        d[2] = version & 0xff;
        return;
      case CMD.layerCount:
        d[1] = this.opts.layers ?? 4;
        return;
      case CMD.getValue:
      case CMD.setValue:
      case CMD.save: {
        const ch = (Object.keys(CHANNEL_ID) as Channel[]).find((c) => CHANNEL_ID[c] === d[1]);
        const l = ch && this.lights.get(ch);
        if (version < 0x0c || !ch || !l) return void (d[0] = CMD.unhandled);
        if (d[0] === CMD.save) return void this.eeprom.set(ch, { ...l });
        if (d[0] === CMD.getValue) return this.get(ch, l, d);
        if (!this.opts.ignoreWrites) this.set(ch, l, d);
        return;
      }
      default:
        d[0] = CMD.unhandled;
    }
  }

  // via_qmk_*_get_value: an unknown value ID leaves the buffer as sent.
  private get(ch: Channel, l: Lighting, d: Uint8Array) {
    if (d[2] === VALUE_ID.brightness) d[3] = Math.floor((l.val * 255) / l.max);
    if (d[2] === VALUE_ID.effect) d[3] = ch === 'backlight' ? Number(l.mode === 1) : l.enabled ? l.mode : 0;
    if (d[2] === VALUE_ID.speed) d[3] = l.speed;
    if (d[2] === VALUE_ID.color) d.set([l.hue, l.sat], 3);
  }

  private set(ch: Channel, l: Lighting, d: Uint8Array) {
    const v = d[3]!;
    if (d[2] === VALUE_ID.brightness) l.val = ch === 'rgbMatrix' || ch === 'ledMatrix' ? scale8(v, l.max) : Math.floor((v * l.max) / 255);
    if (d[2] === VALUE_ID.effect && ch === 'backlight') l.mode = v ? 1 : 0;
    else if (d[2] === VALUE_ID.effect) {
      l.enabled = v !== 0;
      // rgb_matrix_mode_eeprom_helper clamps to the effects the firmware was built with.
      if (v !== 0) l.mode = Math.min(Math.max(v, 1), l.effects - 1);
    }
    if (d[2] === VALUE_ID.speed) l.speed = v;
    if (d[2] === VALUE_ID.color) [l.hue, l.sat] = [v, d[4]!];
  }

  async sendFeatureReport() {
    throw new Error('simulator: VIA uses output reports');
  }

  async receiveFeatureReport(): Promise<DataView> {
    throw new Error('simulator: VIA uses output reports');
  }
}
