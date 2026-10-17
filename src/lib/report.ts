// A device report the user can copy and attach to an issue (the contribution
// path and Phase 2's detection evidence). Descriptor metadata only: no input
// data, no keystrokes, no serial numbers.

import { descriptorLines } from './descriptor.ts';
import type { Match } from './match.ts';
import type { LogEntry } from './transport.ts';

const hex4 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

const bytes = (r: HIDReportInfo) =>
  Math.ceil((r.items ?? []).reduce((sum, i) => sum + (i.reportSize ?? 0) * (i.reportCount ?? 0), 0) / 8);

function describe(c: HIDCollectionInfo): object {
  const reports = (list: HIDReportInfo[] | undefined) => (list ?? []).map((r) => ({ id: r.reportId ?? 0, bytes: bytes(r) }));
  return {
    usagePage: hex4(c.usagePage ?? 0),
    usage: hex4(c.usage ?? 0),
    input: reports(c.inputReports),
    output: reports(c.outputReports),
    feature: reports(c.featureReports),
    ...(c.children?.length ? { children: c.children.map(describe) } : {}),
  };
}

export interface ReportSource {
  vendorId: number;
  productId: number;
  productName: string;
  interfaces: Pick<HIDDevice, 'collections'>[];
  match: Match | null;
}

export function deviceReport(d: ReportSource, now: Date, userAgent: string): object {
  return {
    udbReport: 1,
    date: now.toISOString().slice(0, 10),
    userAgent,
    vendorId: hex4(d.vendorId),
    productId: hex4(d.productId),
    productName: d.productName,
    registryMatch: d.match ? { id: d.match.entry.id, connection: d.match.identity.connection, modelConfirmed: d.match.modelConfirmed } : null,
    interfaces: d.interfaces.map((i) => ({ collections: i.collections.map(describe) })),
  };
}

/**
 * The device report plus the readable descriptor and the byte log, for the
 * diagnostics export. The log holds only what UDB sent and the replies it
 * matched. Replies can carry identifiers (serials, firmware strings), so the
 * user reviews the file before sharing it.
 */
export function diagnosticsReport(d: ReportSource, log: LogEntry[], now: Date, userAgent: string): object {
  return {
    ...deviceReport(d, now, userAgent),
    udbDiagnostics: 1,
    descriptor: d.interfaces.map((i) => descriptorLines(i.collections)),
    log,
  };
}
