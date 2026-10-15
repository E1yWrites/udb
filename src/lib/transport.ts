// The only module that talks to a HID device (ADR 5, THREAT_MODEL T2/T5).
// Every report passes three checks before it reaches WebHID:
//   1. the device declares this report ID for this report type (or the
//      registry names it as an undeclared feature report on that collection),
//   2. the declaring top-level collection is not on the registry's deny list,
//   3. the protocol adapter's allowlist accepts the exact bytes.
// tests/guards.test.ts fails if any other module calls sendReport,
// sendFeatureReport or receiveFeatureReport.

export type ReportType = 'output' | 'feature' | 'feature-read';

export interface OutgoingReport {
  type: ReportType;
  reportId: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface UsagePair {
  usagePage: number;
  usage: number;
}

export interface Guard {
  /** From the protocol adapter: true only for commands its protocol doc allows. */
  allow: (report: OutgoingReport) => boolean;
  /** From the registry: collections UDB must never talk to. */
  deny: UsagePair[];
  /**
   * From the registry: feature reports a collection carries without declaring
   * them in its descriptor (Razer's control channel on its mouse collection).
   * WebHID does not check report IDs, so only this list lets UDB send them.
   */
  undeclared?: (UsagePair & { reportId: number })[];
}

export type RejectReason = 'not-open' | 'undeclared-report' | 'denied-collection' | 'not-allowlisted';

export class TransportRejected extends Error {
  readonly reason: RejectReason;
  constructor(reason: RejectReason, report: OutgoingReport) {
    super(`Refused ${report.type} report 0x${report.reportId.toString(16).padStart(2, '0')}: ${reason}`);
    this.name = 'TransportRejected';
    this.reason = reason;
  }
}

type DeviceLike = Pick<HIDDevice, 'opened' | 'collections' | 'sendReport' | 'sendFeatureReport' | 'receiveFeatureReport'>;

function reportsOf(c: HIDCollectionInfo, type: ReportType): HIDReportInfo[] {
  return type === 'output' ? (c.outputReports ?? []) : (c.featureReports ?? []);
}

function declares(c: HIDCollectionInfo, type: ReportType, reportId: number): boolean {
  return (
    reportsOf(c, type).some((r) => (r.reportId ?? 0) === reportId) ||
    (c.children ?? []).some((child) => declares(child, type, reportId))
  );
}

/** The top-level collection that declares this report, or undefined. */
export function owningCollection(device: Pick<HIDDevice, 'collections'>, report: OutgoingReport): HIDCollectionInfo | undefined {
  return device.collections.find((c) => declares(c, report.type, report.reportId));
}

/** A top-level collection the registry says carries this feature report undeclared. */
function undeclaredOwner(device: Pick<HIDDevice, 'collections'>, report: OutgoingReport, guard: Guard): HIDCollectionInfo | undefined {
  if (report.type === 'output') return undefined;
  return device.collections.find((c) =>
    guard.undeclared?.some((u) => u.usagePage === c.usagePage && u.usage === c.usage && u.reportId === report.reportId),
  );
}

function check(device: DeviceLike, report: OutgoingReport, guard: Guard): void {
  if (!device.opened) throw new TransportRejected('not-open', report);
  const owner = owningCollection(device, report) ?? undeclaredOwner(device, report, guard);
  if (!owner) throw new TransportRejected('undeclared-report', report);
  if (guard.deny.some((d) => d.usagePage === owner.usagePage && d.usage === owner.usage)) {
    throw new TransportRejected('denied-collection', report);
  }
  if (!guard.allow(report)) throw new TransportRejected('not-allowlisted', report);
}

export async function send(device: DeviceLike, report: OutgoingReport, guard: Guard): Promise<void> {
  check(device, report, guard);
  if (report.type === 'output') await device.sendReport(report.reportId, report.data);
  else if (report.type === 'feature') await device.sendFeatureReport(report.reportId, report.data);
  else throw new TransportRejected('undeclared-report', report);
}

export async function receiveFeature(device: DeviceLike, reportId: number, guard: Guard): Promise<DataView> {
  const report: OutgoingReport = { type: 'feature-read', reportId, data: new Uint8Array() };
  check(device, report, guard);
  return device.receiveFeatureReport(reportId);
}

export type OpenResult = { ok: true } | { ok: false; error: string };

/** Opening sends no report. A failure usually means another app holds the device. */
export async function open(device: Pick<HIDDevice, 'opened' | 'open'>): Promise<OpenResult> {
  if (device.opened) return { ok: true };
  try {
    await device.open();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export interface LogEntry {
  at: string;
  dir: 'tx' | 'rx';
  reportId: number;
  hex: string;
  /** How a received report arrived, when it matters (feature reply vs. pushed input report). */
  via?: 'feature' | 'input';
}

export const toHex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join(' ');

export class TransportTimeout extends Error {
  constructor(report: OutgoingReport, attempts: number) {
    super(`No reply to report 0x${report.reportId.toString(16).padStart(2, '0')} after ${attempts} attempts`);
    this.name = 'TransportTimeout';
  }
}

type Listening = DeviceLike & Pick<HIDDevice, 'addEventListener' | 'removeEventListener'>;

export interface RequestOptions {
  timeoutMs?: number;
  attempts?: number;
  log?: (entry: LogEntry) => void;
  /**
   * Interfaces the reply may arrive on (default: the sending device). On
   * Windows each top-level collection is its own HIDDevice, so a HID++ reply
   * can come back on a sibling collection.
   */
  replyOn?: Pick<HIDDevice, 'addEventListener' | 'removeEventListener'>[];
  /** Report IDs a reply may carry (default: the request's). */
  replyIds?: number[];
}

/**
 * Send a guarded report and wait for the input report `isReply` accepts.
 * Retries like the vendor driver (it tries 5 times, 200 ms each).
 */
export async function request(
  device: Listening,
  report: OutgoingReport,
  guard: Guard,
  isReply: (data: Uint8Array) => boolean,
  { timeoutMs = 200, attempts = 3, log, replyOn = [device], replyIds = [report.reportId] }: RequestOptions = {},
): Promise<Uint8Array> {
  check(device, report, guard);
  for (let attempt = 0; attempt < attempts; attempt++) {
    let onReport: ((e: Event) => void) | undefined;
    const reply = new Promise<{ reportId: number; data: Uint8Array } | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      onReport = (e: Event) => {
        const ev = e as HIDInputReportEvent;
        const data = new Uint8Array(ev.data.buffer.slice(ev.data.byteOffset, ev.data.byteOffset + ev.data.byteLength));
        if (!replyIds.includes(ev.reportId) || !isReply(data)) return;
        clearTimeout(timer);
        resolve({ reportId: ev.reportId, data });
      };
      for (const d of replyOn) d.addEventListener('inputreport', onReport);
    });
    try {
      log?.({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
      await send(device, report, guard);
      const got = await reply;
      if (got) {
        log?.({ at: new Date().toISOString(), dir: 'rx', reportId: got.reportId, hex: toHex(got.data) });
        return got.data;
      }
    } finally {
      for (const d of replyOn) d.removeEventListener('inputreport', onReport!);
    }
  }
  throw new TransportTimeout(report, attempts);
}

/**
 * Feature-report exchange used by devices that answer through GET_FEATURE
 * (e.g. the Vibe75): send the request, wait, read the reply. Both legs are guarded.
 */
export async function featureQuery(
  device: DeviceLike,
  report: OutgoingReport,
  guard: Guard,
  { delayMs = 20, log }: { delayMs?: number; log?: (entry: LogEntry) => void } = {},
): Promise<Uint8Array> {
  log?.({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
  await send(device, report, guard);
  await new Promise((r) => setTimeout(r, delayMs));
  const view = await receiveFeature(device, report.reportId, guard);
  const data = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  log?.({ at: new Date().toISOString(), dir: 'rx', reportId: report.reportId, hex: toHex(data) });
  return data;
}

/**
 * Read-only investigation helper: send one guarded feature request, then
 * fetch the feature reply at each delay and record any input report the
 * device pushes meanwhile. Returns everything received, in order.
 */
export async function featureProbe(
  device: DeviceLike & Pick<HIDDevice, 'addEventListener' | 'removeEventListener'>,
  report: OutgoingReport,
  guard: Guard,
  delaysMs: number[],
  log: (entry: LogEntry) => void,
): Promise<void> {
  const onInput = (e: Event) => {
    const ev = e as HIDInputReportEvent;
    const data = new Uint8Array(ev.data.buffer.slice(ev.data.byteOffset, ev.data.byteOffset + ev.data.byteLength));
    log({ at: new Date().toISOString(), dir: 'rx', reportId: ev.reportId, hex: toHex(data), via: 'input' });
  };
  device.addEventListener('inputreport', onInput);
  try {
    log({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
    await send(device, report, guard);
    let waited = 0;
    for (const at of delaysMs) {
      await new Promise((r) => setTimeout(r, at - waited));
      waited = at;
      const view = await receiveFeature(device, report.reportId, guard);
      const data = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
      log({ at: new Date().toISOString(), dir: 'rx', reportId: report.reportId, hex: toHex(data), via: 'feature' });
    }
  } finally {
    device.removeEventListener('inputreport', onInput);
  }
}
