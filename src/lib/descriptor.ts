// A readable form of a device's report descriptor as WebHID parsed it, for the
// diagnostics view and for exports. Descriptor metadata only.

const hex = (n: number, width = 4) => n.toString(16).toUpperCase().padStart(width, '0');

/** An extended usage ((page << 16) | id) as `PAGE:ID`; a plain number as `0xID`. */
function usage(value: number): string {
  const n = value >>> 0;
  return n > 0xffff ? `${hex(n >>> 16)}:${hex(n & 0xffff)}` : `0x${hex(n)}`;
}

function itemLine(i: HIDReportItem): string {
  const parts = [`${i.reportSize ?? 0} bits × ${i.reportCount ?? 0}`];
  if (i.isRange) parts.push(`usages ${usage(i.usageMinimum ?? 0)} to ${usage(i.usageMaximum ?? 0)}`);
  else if (i.usages?.length) parts.push(`usage ${i.usages.map(usage).join(', ')}`);
  if (i.isConstant) parts.push('constant');
  else if (i.logicalMinimum !== undefined && i.logicalMaximum !== undefined) parts.push(`logical ${i.logicalMinimum} to ${i.logicalMaximum}`);
  return parts.join(' · ');
}

const bytes = (r: HIDReportInfo) => Math.ceil((r.items ?? []).reduce((sum, i) => sum + (i.reportSize ?? 0) * (i.reportCount ?? 0), 0) / 8);

function lines(c: HIDCollectionInfo, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const out = [`${pad}Collection ${hex(c.usagePage ?? 0)}:${hex(c.usage ?? 0)}`];
  const reports = (label: string, list: HIDReportInfo[] | undefined) => {
    for (const r of list ?? []) {
      out.push(`${pad}  ${label} report 0x${hex(r.reportId ?? 0, 2)}, ${bytes(r)} bytes`);
      for (const i of r.items ?? []) out.push(`${pad}    ${itemLine(i)}`);
    }
  };
  reports('Input', c.inputReports);
  reports('Output', c.outputReports);
  reports('Feature', c.featureReports);
  for (const child of c.children ?? []) out.push(...lines(child, depth + 1));
  return out;
}

/** One line per collection, report and item. Sizes are in bytes, excluding the report ID. */
export function descriptorLines(collections: HIDCollectionInfo[]): string[] {
  return collections.flatMap((c) => lines(c, 0));
}
