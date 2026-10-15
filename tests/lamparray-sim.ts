// A HID LampArray simulator for tests and the dev preview. Its collection is
// Microsoft's reference descriptor (ArduinoHidForWindows LampArrayReportDescriptor.h,
// MIT) in the shape WebHID reports it, and it behaves like that sample: GET is
// answered only for the two attribute reports, a lamp request out of range
// selects lamp 0. A simulator result is never hardware evidence.

import { PAGE, U } from '../src/adapters/lamparray.ts';

const ext = (id: number) => (PAGE << 16) | id;
const item = (usages: number[], reportSize: number, reportCount: number, logicalMaximum: number, isConstant = false): HIDReportItem => ({
  usages: usages.map(ext),
  reportSize,
  reportCount,
  logicalMinimum: 0,
  logicalMaximum,
  isConstant,
});
const logical = (usage: number, reportId: number, items: HIDReportItem[]): HIDCollectionInfo => ({
  usagePage: PAGE,
  usage,
  type: 2,
  children: [],
  featureReports: [{ reportId, items }],
});

const CHANNELS = [U.red, U.green, U.blue, U.intensity];

/** Report IDs 1-6 exactly as in Microsoft's descriptor (sizes 22, 2, 28, 50, 9, 1 bytes). */
export function lampArrayCollection(): HIDCollectionInfo {
  return {
    usagePage: PAGE,
    usage: U.lampArray,
    type: 1,
    featureReports: [],
    children: [
      logical(U.attributesReport, 1, [
        item([U.lampCount], 16, 1, 0xffff, true),
        item([U.width, U.height, U.depth, U.kind, U.minUpdateInterval], 32, 5, 0x7fffffff, true),
      ]),
      logical(U.requestReport, 2, [item([U.lampId], 16, 1, 0xffff)]),
      logical(U.responseReport, 3, [
        item([U.lampId], 16, 1, 0xffff),
        item([U.x, U.y, U.z, U.latency, U.purposes], 32, 5, 0x7fffffff),
        item([U.redLevels, U.greenLevels, U.blueLevels, U.intensityLevels, U.programmable, U.inputBinding], 8, 6, 255),
      ]),
      logical(U.multiUpdateReport, 4, [
        item([U.lampCount], 8, 1, 8),
        item([U.updateFlags], 8, 1, 1),
        item([U.lampId], 16, 8, 0xffff),
        item(Array.from({ length: 32 }, (_, i) => CHANNELS[i % 4]!), 8, 32, 255),
      ]),
      logical(U.rangeUpdateReport, 5, [item([U.updateFlags], 8, 1, 1), item([U.idStart, U.idEnd], 16, 2, 0xffff), item(CHANNELS, 8, 4, 255)]),
      logical(U.controlReport, 6, [item([U.autonomous], 8, 1, 1)]),
    ],
  };
}

const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => Math.floor(n / 256 ** i) % 256);

export class LampArraySim {
  opened = true;
  readonly collections = [lampArrayCollection()];
  readonly sent: { reportId: number; bytes: number[] }[] = [];
  autonomous = true;
  /** Colour per lamp, as last set: [r, g, b, i]. */
  readonly colors: number[][];
  private selected = 0;
  readonly lampCount: number;

  constructor(lampCount = 4) {
    this.lampCount = lampCount;
    this.colors = Array.from({ length: lampCount }, () => [0, 0, 0, 0]);
  }

  addEventListener() {}
  removeEventListener() {}
  async sendReport() {
    throw new Error('simulator: LampArray uses feature reports');
  }

  async sendFeatureReport(reportId: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer);
    this.sent.push({ reportId, bytes: [...b] });
    if (reportId === 2) {
      const id = b[0]! | (b[1]! << 8);
      this.selected = id < this.lampCount ? id : 0;
    }
    if (reportId === 5 && !this.autonomous) {
      const [start, end] = [b[1]! | (b[2]! << 8), b[3]! | (b[4]! << 8)];
      for (let id = start; id <= Math.min(end, this.lampCount - 1); id++) this.colors[id] = [b[5]!, b[6]!, b[7]!, b[8]!];
    }
    if (reportId === 6) this.autonomous = b[0] === 1;
  }

  async receiveFeatureReport(reportId: number): Promise<DataView> {
    let body: number[];
    if (reportId === 1) body = [...le(this.lampCount, 2), ...le(370_000, 4), ...le(120_000, 4), ...le(5_000, 4), ...le(1, 4), ...le(10_000, 4)];
    else if (reportId === 3) {
      const id = this.selected;
      body = [...le(id, 2), ...le(10_000 + 19_000 * id, 4), ...le(20_000, 4), ...le(0, 4), ...le(4_000, 4), ...le(1, 4), 255, 255, 255, 1, 1, 0x04 + id];
      this.selected = (this.selected + 1) % this.lampCount;
    } else throw new Error('simulator: the reference device does not answer GET on this report');
    return new DataView(Uint8Array.of(reportId, ...body).buffer);
  }
}
