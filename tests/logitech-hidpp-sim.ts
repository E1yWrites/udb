// A Logitech HID++ 2.0 simulator for tests and the dev preview, following
// docs/protocols/logitech-hidpp.md. Receiver behaviour (empty slots answer a
// HID++ 1.0 "unknown device", the receiver's own index "invalid command")
// follows OpenMouse's notes from a G HUB-merged G502 X PLUS receiver.
// A simulator result is never hardware evidence.

import { FEATURE, LONG, REPORT_RATES, SHORT, SIZE } from '../src/adapters/logitech-hidpp.ts';

type Role = 'mouse' | 'keyboard' | 'headset';

export interface HidppSimOptions {
  productId: number;
  /** Which device answers on which index: receiver slots 1-6, or 0xFF for the device itself. */
  roles: Record<number, Role>;
  /** HERO-era features (0x2201, 0x8060, 0x1000) instead of 0x2202, 0x8061, 0x1004. */
  legacy?: boolean;
  /** Windows: one HIDDevice per collection. A short request is answered on the long one. */
  split?: boolean;
  /** Answer set functions with HID++ 2.0 "invalid argument", as some mice do in onboard mode. */
  rejectWrites?: boolean;
  /** Acknowledge set functions but keep the old value. */
  ignoreWrites?: boolean;
  /** Push an unsolicited notification before every reply. */
  noise?: boolean;
  wirelessPid?: number;
  usbPid?: number;
  name?: string;
}

const TABLES: Record<'mouse' | 'legacyMouse' | 'keyboard' | 'headset', number[]> = {
  headset: [FEATURE.root, 0x0001, FEATURE.deviceName, FEATURE.adcMeasurement, FEATURE.sidetone],
  mouse: [FEATURE.root, 0x0001, FEATURE.deviceInfo, FEATURE.deviceName, FEATURE.unifiedBattery, FEATURE.extendedDpi, FEATURE.extendedReportRate, FEATURE.onboardProfiles],
  legacyMouse: [FEATURE.root, 0x0001, FEATURE.deviceInfo, FEATURE.deviceName, FEATURE.batteryLevel, FEATURE.dpi, FEATURE.reportRate, FEATURE.onboardProfiles],
  keyboard: [FEATURE.root, 0x0001, FEATURE.deviceInfo, FEATURE.deviceName, FEATURE.unifiedBattery, FEATURE.extendedReportRate],
};

/** 100 to 25600 DPI in steps of 50, encoded as a range (0x2202). */
const EXTENDED_DPI = [0x00, 0x64, 0xe0, 0x32, 0x64, 0x00, 0x00, 0x00];
/** An explicit list for 0x2201: 400, 800, 1600, 3200. */
const LEGACY_DPI = [0x01, 0x90, 0x03, 0x20, 0x06, 0x40, 0x0c, 0x80, 0x00, 0x00];
export const EXTENDED_DPI_OPTIONS = Array.from({ length: 511 }, (_, i) => 100 + 50 * i);
export const LEGACY_DPI_OPTIONS = [400, 800, 1600, 3200];

class Interface {
  opened = true;
  readonly collections: HIDCollectionInfo[];
  private listeners = new Set<(e: Event) => void>();
  private readonly sim: HidppSim;
  constructor(collections: HIDCollectionInfo[], sim: HidppSim) {
    this.collections = collections;
    this.sim = sim;
  }
  addEventListener(_t: string, l: (e: Event) => void) {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: (e: Event) => void) {
    this.listeners.delete(l);
  }
  emit(reportId: number, data: Uint8Array) {
    const event = Object.assign(new Event('inputreport'), { reportId, data: new DataView(data.buffer.slice(0)) });
    for (const l of this.listeners) l(event);
  }
  async open() {}
  async close() {}
  async sendReport(reportId: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer);
    const declared = this.collections.some((c) => c.outputReports?.some((r) => r.reportId === reportId));
    if (!declared) throw new Error('simulator: report not declared on this interface');
    this.sim.receive(reportId, b);
  }
  async sendFeatureReport() {
    throw new Error('simulator: HID++ uses output reports');
  }
  async receiveFeatureReport(): Promise<DataView> {
    throw new Error('simulator: HID++ uses output reports');
  }
}

const collection = (usage: number, id: number): HIDCollectionInfo =>
  ({ usagePage: 0xff00, usage, inputReports: [{ reportId: id }], outputReports: [{ reportId: id }], children: [] }) as unknown as HIDCollectionInfo;

export class HidppSim {
  readonly interfaces: Interface[];
  readonly sent: { reportId: number; bytes: number[] }[] = [];
  readonly opts: HidppSimOptions;
  dpi = 1600;
  lod = 1;
  rateCode = 3; // 1000 Hz
  rateMs = 1;
  onboard = 1;
  sidetone = 50;

  constructor(opts: HidppSimOptions) {
    this.opts = opts;
    const short = collection(0x0001, SHORT);
    const long = collection(0x0002, LONG);
    this.interfaces = opts.split ? [new Interface([short], this), new Interface([long], this)] : [new Interface([short, long], this)];
  }

  private table(role: Role) {
    return role === 'keyboard' || role === 'headset' ? TABLES[role] : this.opts.legacy ? TABLES.legacyMouse : TABLES.mouse;
  }

  receive(reportId: number, req: Uint8Array) {
    this.sent.push({ reportId, bytes: [...req] });
    const reply = this.answer(req);
    if (!reply) return;
    const longIface = this.interfaces.find((i) => i.collections.some((c) => c.usage === 0x0002))!;
    setTimeout(() => {
      if (this.opts.noise) longIface.emit(LONG, Uint8Array.of(req[0]!, 0x04, 0x00, 55, 0, 0, ...new Array(13).fill(0)));
      longIface.emit(LONG, reply);
    }, 1);
  }

  private answer(req: Uint8Array): Uint8Array | null {
    const [dev, index, fnsw] = [req[0]!, req[1]!, req[2]!];
    const fn = fnsw >> 4;
    const p = req.subarray(3);
    const out = new Uint8Array(SIZE[LONG]);
    out.set([dev, index, fnsw]);
    const error = (version: 1 | 2, code: number) => {
      out.set([dev, version === 2 ? 0xff : 0x8f, index, fnsw, code]);
      out.fill(0, 5);
      return out;
    };
    const role = this.opts.roles[dev];
    if (!role) return error(1, dev === 0xff ? 0x01 : 0x08);
    const table = this.table(role);
    const feature = table[index];
    if (feature === undefined) return error(2, 0x06);
    const set = (...bytes: number[]) => (out.set(bytes, 3), out);
    const write = (apply: () => void) => {
      if (this.opts.rejectWrites) return error(2, 0x02);
      if (!this.opts.ignoreWrites) apply();
      return out;
    };
    switch (feature) {
      case FEATURE.root: {
        if (fn === 1) return set(4, 2, p[2]!);
        const wanted = (p[0]! << 8) | p[1]!;
        return set(Math.max(table.indexOf(wanted), 0), 0, 0);
      }
      case FEATURE.deviceInfo: {
        const w = this.opts.wirelessPid;
        const u = this.opts.usbPid;
        const pids = [...(w ? [w >> 8, w & 0xff] : []), ...(u ? [u >> 8, u & 0xff] : [])];
        return set(1, 0x12, 0x34, 0x56, 0x78, 0, (w ? 0x04 : 0) | (u ? 0x08 : 0), ...pids);
      }
      case FEATURE.deviceName: {
        const name = new TextEncoder().encode(this.opts.name ?? { keyboard: 'G915 TKL', headset: 'G933 Gaming Headset', mouse: 'G502 LIGHTSPEED' }[role]);
        return fn === 0 ? set(name.length) : set(...name.subarray(p[0]!, p[0]! + 16));
      }
      case FEATURE.unifiedBattery:
        return set(82, 0x04, 0, 0);
      case FEATURE.batteryLevel:
        return set(60, 50, 0);
      case FEATURE.extendedDpi:
        if (fn === 1) return set(0, 0, 0x02);
        if (fn === 2) return set(0, 0, p[2]!, ...EXTENDED_DPI.slice(p[2]! * 13, p[2]! * 13 + 13));
        if (fn === 5) return set(0, this.dpi >> 8, this.dpi & 0xff, 0x03, 0x20, this.dpi >> 8, this.dpi & 0xff, 0x03, 0x20, this.lod);
        if (fn === 6) {
          const x = (p[1]! << 8) | p[2]!;
          if (!EXTENDED_DPI_OPTIONS.includes(x)) return error(2, 0x02);
          return write(() => ((this.dpi = x), (this.lod = p[5]!)));
        }
        return error(2, 0x07);
      case FEATURE.dpi:
        if (fn === 1) return set(0, ...LEGACY_DPI);
        if (fn === 2) return set(0, this.dpi >> 8, this.dpi & 0xff, 0x03, 0x20);
        if (fn === 3) return write(() => (this.dpi = (p[1]! << 8) | p[2]!));
        return error(2, 0x07);
      case FEATURE.extendedReportRate: {
        // Superlight 2 (OpenMouse issue #224): the cable list stops at 1000 Hz, the wireless one reaches 8000 Hz.
        const mask = p[0] === 0 ? 0x000f : 0x007f;
        if (fn === 0 || fn === 1) return set(mask >> 8, mask & 0xff);
        if (fn === 2) return set(this.rateCode);
        if (fn === 3) return write(() => (this.rateCode = p[0]!));
        return error(2, 0x07);
      }
      case FEATURE.reportRate:
        if (fn === 0) return set(0x8b); // the G402's bitmap: 1, 2, 4 and 8 ms
        if (fn === 1) return set(this.rateMs);
        if (fn === 2) return write(() => (this.rateMs = p[0]!));
        return error(2, 0x07);
      case FEATURE.adcMeasurement:
        return set(0x0f, 0x46, 0x03); // 3910 mV, valid, charging
      case FEATURE.sidetone:
        if (fn === 0) return set(this.sidetone);
        if (fn === 1) return write(() => (this.sidetone = p[0]!));
        return error(2, 0x07);
      case FEATURE.onboardProfiles:
        return fn === 2 ? set(this.onboard) : error(2, 0x07);
      default:
        return error(2, 0x07);
    }
  }

  /** Hz for the current rate state, for assertions. */
  get rateHz() {
    return this.opts.legacy ? Math.round(1000 / this.rateMs) : REPORT_RATES[this.rateCode];
  }
}
