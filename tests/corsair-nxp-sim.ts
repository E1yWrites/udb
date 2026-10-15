// A Corsair classic-protocol mouse for tests and the dev preview, following
// docs/protocols/corsair.md: GET answered through GET_FEATURE with the request
// echoed, SET with no reply, live settings lost on power cycle. A simulator
// result is never hardware evidence.

import { FIELD, GET, MOUSE, SET, SIZE } from '../src/adapters/corsair-nxp.ts';

export class CorsairNxpSim {
  opened = true;
  /** MI_01: the config collection, 64-byte feature report 0. */
  readonly collections = [{ usagePage: 0xffc2, usage: 0x0004, inputReports: [{ reportId: 0 }], outputReports: [{ reportId: 0 }], featureReports: [{ reportId: 0 }] }];
  readonly sent: number[][] = [];
  /** [x, rgb] per stage; the factory onboard profile from OpenMouse's capture. */
  stages: { dpi: number; rgb: number[] }[] = [
    { dpi: 800, rgb: [0xff, 0xff, 0] },
    { dpi: 1500, rgb: [0, 0xbf, 0xff] },
    { dpi: 3000, rgb: [0, 0xbf, 0xff] },
    { dpi: 6000, rgb: [0, 0xbf, 0xff] },
    { dpi: 0, rgb: [0, 0, 0] },
    { dpi: 0, rgb: [0, 0, 0] },
  ];
  mask = 0x0f;
  active = 1;
  lift = 5;
  snap = 0;
  private buffer = new Uint8Array(SIZE);
  private readonly factory = JSON.stringify(this.stages);

  addEventListener() {}
  removeEventListener() {}
  async sendReport() {}

  async sendFeatureReport(_reportId: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer);
    this.sent.push([...b]);
    if (b[0] === SET) return void this.set(b);
    const res = new Uint8Array(SIZE);
    res.set(b.subarray(0, 4));
    if (b[1] === FIELD.ident) res.set([0x01, 0x01, 0, 0x01, 0x41, 0x03, 0x08, 0x03, 0x1c, 0x1b, 0x5c, 0x1b, 0x01], 4);
    else if (b[2] === MOUSE.mask) res[4] = this.mask;
    else if (b[2] === MOUSE.lift) res[4] = this.lift;
    else if (b[2] === MOUSE.snap) res[4] = this.snap;
    else if (b[2] === MOUSE.dpi) {
      const d = this.stages[this.active]!.dpi;
      res.set([this.active, d >> 8, d & 0xff, d >> 8, d & 0xff], 4);
    } else if (b[2]! >= MOUSE.stage) {
      const s = this.stages[b[2]! - MOUSE.stage]!;
      if (s.dpi) res.set([0, s.dpi >> 8, s.dpi & 0xff, s.dpi >> 8, s.dpi & 0xff, ...s.rgb], 4);
    }
    this.buffer = res;
  }

  /** SET leaves the reply buffer as it was (stale), like the real mouse. */
  private set(b: Uint8Array) {
    if (b[2] === MOUSE.dpi) this.active = b[4]!;
    else if (b[2] === MOUSE.lift) this.lift = b[4]!;
    else if (b[2] === MOUSE.snap) this.snap = b[4]!;
    else if (b[2]! >= MOUSE.stage) {
      const n = b[2]! - MOUSE.stage;
      if (this.mask & (1 << n)) this.stages[n] = { dpi: b[5]! | (b[6]! << 8), rgb: [b[9]!, b[10]!, b[11]!] };
    }
  }

  async receiveFeatureReport(): Promise<DataView> {
    return new DataView(Uint8Array.from(this.buffer).buffer);
  }

  /** Unplug and replug: live settings are lost; the onboard profile comes back. */
  powerCycle() {
    this.stages = JSON.parse(this.factory);
    this.active = 1;
    this.lift = 5;
    this.snap = 0;
  }
}
