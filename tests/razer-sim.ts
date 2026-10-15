// A Razer mouse simulator for tests and the dev preview, following
// docs/protocols/razer.md: feature report 0 in, GET_FEATURE out, the control
// report undeclared in the descriptor. A simulator result is never hardware evidence.

import { checksum, LENGTH, STATUS } from '../src/adapters/razer.ts';

export interface RazerSimOptions {
  transactionId?: number;
  /** Extended polling (00/C0, 00/40) instead of legacy (00/85, 00/05). */
  extended?: boolean;
  /** GET_FEATURE answers busy this many times before each reply. */
  busy?: number;
  /** The first reply of the session has a bad checksum. */
  corruptFirst?: boolean;
  /** Acknowledge writes but keep the old values. */
  ignoreWrites?: boolean;
  /** Answer the charging read as unsupported (Basilisk X HyperSpeed). */
  noCharging?: boolean;
}

export class RazerSim {
  opened = true;
  /** Razer's control interface: one Generic Desktop Mouse collection declaring no feature report. */
  readonly collections = [{ usagePage: 0x0001, usage: 0x0002, inputReports: [{ reportId: 0 }] }];
  readonly sent: number[][] = [];
  dpi = 1600;
  divisor = 1; // legacy: 1000 / Hz; extended: 8000 / Hz
  sleep = 300;
  lowPower = 0x4d;
  private reply: Uint8Array = new Uint8Array(LENGTH);
  private pendingBusy = 0;
  private corrupt = false;
  private readonly opts: RazerSimOptions;

  constructor(opts: RazerSimOptions = {}) {
    this.opts = opts;
    this.corrupt = !!opts.corruptFirst;
    if (opts.extended) this.divisor = 8;
  }

  addEventListener() {}
  removeEventListener() {}
  async sendReport() {
    throw new Error('simulator: Razer uses feature reports');
  }

  async sendFeatureReport(reportId: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer);
    this.sent.push([...b]);
    if (reportId !== 0 || b.length !== LENGTH || b[88] !== checksum(b)) throw new Error('simulator: bad packet');
    // A wrong transaction ID gets no answer: the reply buffer stays as it was.
    if (b[1] !== (this.opts.transactionId ?? 0x1f)) return;
    this.reply = this.answer(b);
    this.pendingBusy = this.opts.busy ?? 0;
  }

  async receiveFeatureReport(): Promise<DataView> {
    if (this.pendingBusy > 0) {
      this.pendingBusy--;
      const busy = Uint8Array.from(this.reply);
      busy[0] = STATUS.busy;
      busy[88] = checksum(busy);
      return new DataView(busy.buffer);
    }
    const out = Uint8Array.from(this.reply);
    if (this.corrupt) {
      this.corrupt = false;
      out[88] = out[88]! ^ 0xff;
    }
    return new DataView(out.buffer);
  }

  private answer(req: Uint8Array): Uint8Array {
    const res = Uint8Array.from(req);
    res[0] = STATUS.ok;
    const a = (i: number) => req[8 + i]!;
    const set = (...bytes: number[]) => res.set(bytes, 8);
    const write = (apply: () => void) => {
      if (!this.opts.ignoreWrites) apply();
    };
    const key = `${req[6]!.toString(16)}/${req[7]!.toString(16)}`;
    switch (key) {
      case '0/81':
        set(2, 1);
        break;
      case '7/80':
        set(0, 0x43); // 26%, as in the DeathAdder V3 Pro capture
        break;
      case '7/84':
        if (this.opts.noCharging) res[0] = STATUS.unsupported;
        else set(0, 1);
        break;
      case '7/83':
        set(this.sleep >> 8, this.sleep & 0xff);
        break;
      case '7/3':
        write(() => (this.sleep = (a(0) << 8) | a(1)));
        break;
      case '7/81':
        set(this.lowPower, 0);
        break;
      case '7/1':
        write(() => (this.lowPower = a(0)));
        break;
      case '4/85':
        set(a(0), this.dpi >> 8, this.dpi & 0xff, this.dpi >> 8, this.dpi & 0xff, 0, 0);
        break;
      case '4/5':
        write(() => (this.dpi = (a(1) << 8) | a(2)));
        break;
      case '0/85':
        if (this.opts.extended) res[0] = STATUS.unsupported;
        else set(this.divisor);
        break;
      case '0/5':
        write(() => (this.divisor = a(0)));
        break;
      case '0/c0':
        if (!this.opts.extended) res[0] = STATUS.unsupported;
        else set(a(0), this.divisor);
        break;
      case '0/40':
        write(() => (this.divisor = a(1)));
        break;
      default:
        res[0] = STATUS.unsupported;
    }
    res[88] = checksum(res);
    return res;
  }
}
