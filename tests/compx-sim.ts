// A compx device simulator for tests. It implements the documented protocol
// (docs/protocols/compx.md). A simulator result is never hardware evidence.

import { checksum, CMD, REPORT_ID } from '../src/adapters/compx.ts';

export interface SimOptions {
  type?: number;
  mid?: number;
  online?: boolean;
  /** Ack writes but keep the old flash contents (a device that ignores a setting). */
  ignoreWrites?: boolean;
  /** Never answer (a dead link). */
  silent?: boolean;
}

export class CompxSim {
  opened = true;
  readonly collections = [{ usagePage: 0xff02, usage: 0x0002, inputReports: [{ reportId: 8 }], outputReports: [{ reportId: 8 }] }];
  readonly flash = new Uint8Array(0x100);
  readonly sent: number[][] = [];
  private listeners = new Set<(e: Event) => void>();
  private opts: SimOptions;

  constructor(opts: SimOptions = {}) {
    this.opts = opts;
    this.flash.set([1, 0x54, 6, 0x4f, 1, 0x54]); // 1000 Hz, 6 stages, stage index 1
    this.flash.set([2, 0x53], 0xa9); // debounce 2 ms
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
    if (reportId !== REPORT_ID || b[15] !== checksum(b)) throw new Error('simulator: bad frame');
    if (this.opts.silent) return;
    const res = new Uint8Array(16);
    res.set(b.subarray(0, 5));
    const addr = (b[2]! << 8) | b[3]!;
    const len = b[4]!;
    switch (b[0]) {
      case CMD.EncryptionData:
        res.set([87, this.opts.mid ?? 42, this.opts.type ?? 5], 9);
        break;
      case CMD.DeviceOnLine:
        res[5] = (this.opts.online ?? true) ? 1 : 0;
        break;
      case CMD.BatteryLevel:
        res[5] = 82;
        break;
      case CMD.ReadFlashData:
        res.set(this.flash.subarray(addr, addr + len), 5);
        break;
      case CMD.WriteFlashData:
        if (!this.opts.ignoreWrites) this.flash.set(b.subarray(5, 5 + len), addr);
        break;
      default:
        res[1] = 1;
    }
    res[15] = checksum(res);
    setTimeout(() => {
      const event = Object.assign(new Event('inputreport'), { reportId, data: new DataView(res.buffer) });
      for (const l of this.listeners) l(event);
    }, 1);
  }

  async sendFeatureReport() {
    throw new Error('simulator: compx uses output reports');
  }

  async receiveFeatureReport(): Promise<DataView> {
    throw new Error('simulator: compx uses output reports');
  }
}
