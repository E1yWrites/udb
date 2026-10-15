// The only module that talks to a HID device (ADR 5, THREAT_MODEL T2/T5).
// Every report passes three checks before it reaches WebHID:
//   1. the device declares this report ID for this report type,
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

function check(device: DeviceLike, report: OutgoingReport, guard: Guard): void {
  if (!device.opened) throw new TransportRejected('not-open', report);
  const owner = owningCollection(device, report);
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
