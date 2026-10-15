// Protocol adapter for HID LampArray (HID Usage Tables 1.4, Lighting And
// Illumination page 0x59), the standard behind Windows Dynamic Lighting.
// Report IDs and field layout come from the device's own descriptor, so one
// adapter serves every LampArray device. Facts and sources:
// docs/protocols/lamparray.md. Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

export const PAGE = 0x59;

/** Usage IDs on page 0x59 that UDB uses. */
export const U = {
  lampArray: 0x01,
  attributesReport: 0x02,
  lampCount: 0x03,
  width: 0x04,
  height: 0x05,
  depth: 0x06,
  kind: 0x07,
  minUpdateInterval: 0x08,
  requestReport: 0x20,
  lampId: 0x21,
  responseReport: 0x22,
  x: 0x23,
  y: 0x24,
  z: 0x25,
  purposes: 0x26,
  latency: 0x27,
  redLevels: 0x28,
  greenLevels: 0x29,
  blueLevels: 0x2a,
  intensityLevels: 0x2b,
  programmable: 0x2c,
  inputBinding: 0x2d,
  multiUpdateReport: 0x50,
  red: 0x51,
  green: 0x52,
  blue: 0x53,
  intensity: 0x54,
  updateFlags: 0x55,
  rangeUpdateReport: 0x60,
  idStart: 0x61,
  idEnd: 0x62,
  controlReport: 0x70,
  autonomous: 0x71,
} as const;

export interface Field {
  usage: number;
  /** Bit offset in the report data (after the report ID). */
  bit: number;
  size: number;
  max: number;
  constant: boolean;
}

export interface ReportLayout {
  id: number;
  bytes: number;
  fields: Field[];
}

export interface Layout {
  attributes: ReportLayout;
  request: ReportLayout;
  response: ReportLayout;
  range?: ReportLayout;
  control?: ReportLayout;
}

/** Fields of one report, in order: each item contributes reportCount fields of reportSize bits. */
function fieldsOf(report: HIDReportInfo): Field[] {
  const fields: Field[] = [];
  let bit = 0;
  for (const item of report.items ?? []) {
    const size = item.reportSize ?? 0;
    const usages = item.isRange && item.usageMinimum !== undefined && item.usageMaximum !== undefined
      ? Array.from({ length: item.usageMaximum - item.usageMinimum + 1 }, (_, i) => item.usageMinimum! + i)
      : (item.usages ?? []);
    for (let i = 0; i < (item.reportCount ?? 0); i++) {
      const extended = usages[Math.min(i, usages.length - 1)];
      const usage = extended !== undefined && extended >>> 16 === PAGE ? extended & 0xffff : -1;
      fields.push({ usage, bit, size, max: item.logicalMaximum ?? 2 ** size - 1, constant: !!item.isConstant });
      bit += size;
    }
  }
  return fields;
}

/** The report whose logical collection has this usage, anywhere under the LampArray collection. */
function reportFor(c: HIDCollectionInfo, usage: number): ReportLayout | undefined {
  for (const child of c.children ?? []) {
    const report = child.featureReports?.[0];
    if (child.usagePage === PAGE && child.usage === usage && report) {
      const fields = fieldsOf(report);
      const bits = fields.reduce((n, f) => Math.max(n, f.bit + f.size), 0);
      return { id: report.reportId ?? 0, bytes: Math.ceil(bits / 8), fields };
    }
    const nested = reportFor(child, usage);
    if (nested) return nested;
  }
  return undefined;
}

/** The layout of a LampArray collection, or null when the reads UDB needs are missing. */
export function layoutOf(c: HIDCollectionInfo): Layout | null {
  if (c.usagePage !== PAGE || c.usage !== U.lampArray) return null;
  const attributes = reportFor(c, U.attributesReport);
  const request = reportFor(c, U.requestReport);
  const response = reportFor(c, U.responseReport);
  if (!attributes || !request || !response) return null;
  return { attributes, request, response, range: reportFor(c, U.rangeUpdateReport), control: reportFor(c, U.controlReport) };
}

const getBits = (data: Uint8Array, bit: number, size: number) => {
  let value = 0;
  for (let b = 0; b < size; b++) if (data[(bit + b) >> 3]! & (1 << ((bit + b) & 7))) value += 2 ** b;
  return value;
};

const setBits = (data: Uint8Array, bit: number, size: number, value: number) => {
  for (let b = 0; b < size; b++) if (Math.floor(value / 2 ** b) % 2) data[(bit + b) >> 3]! |= 1 << ((bit + b) & 7);
};

/** Every field's value, grouped by usage in order. */
export function decode(layout: ReportLayout, data: Uint8Array): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const f of layout.fields) out.set(f.usage, [...(out.get(f.usage) ?? []), getBits(data, f.bit, f.size)]);
  return out;
}

/** Report data with the given values; fields not named stay zero. */
export function encode(layout: ReportLayout, values: Partial<Record<number, number[]>>): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(layout.bytes);
  const used = new Map<number, number>();
  for (const f of layout.fields) {
    const i = used.get(f.usage) ?? 0;
    used.set(f.usage, i + 1);
    const v = values[f.usage]?.[i];
    if (v !== undefined && !f.constant) setBits(data, f.bit, f.size, v);
  }
  return data;
}

/**
 * Feature-report payload as received. Chromium includes the report ID as the
 * first byte when the device uses report IDs; strip it when it is there.
 */
export function payload(layout: ReportLayout, data: Uint8Array): Uint8Array {
  return data.length === layout.bytes + 1 && data[0] === layout.id ? data.subarray(1) : data;
}

const feature = (l: ReportLayout, values: Partial<Record<number, number[]>>): OutgoingReport => ({ type: 'feature', reportId: l.id, data: encode(l, values) });

export const lampRequest = (l: Layout, lampId: number) => feature(l.request, { [U.lampId]: [lampId] });

export interface Color {
  r: number;
  g: number;
  b: number;
  /** 0-255; LampArray scales each channel by it. */
  i: number;
}

/** One colour on lamps `start`..`end`, marked as the complete update. */
export const rangeUpdate = (l: Layout, start: number, end: number, c: Color) =>
  feature(l.range!, { [U.updateFlags]: [1], [U.idStart]: [start], [U.idEnd]: [end], [U.red]: [c.r], [U.green]: [c.g], [U.blue]: [c.b], [U.intensity]: [c.i] });

/** Autonomous mode: the device runs its own lighting. Off: the host sets colours. */
export const control = (l: Layout, autonomous: boolean) => feature(l.control!, { [U.autonomous]: [autonomous ? 1 : 0] });

const first = (m: Map<number, number[]>, u: number) => m.get(u)?.[0] ?? 0;

export const KINDS: Record<number, string> = {
  1: 'Keyboard',
  2: 'Mouse',
  3: 'Game controller',
  4: 'Peripheral',
  5: 'Scene',
  6: 'Notification',
  7: 'Chassis',
  8: 'Wearable',
  9: 'Furniture',
  10: 'Art',
};

export interface Attributes {
  lampCount: number;
  /** Bounding box in micrometres. */
  size: { width: number; height: number; depth: number };
  kind: number;
  minUpdateIntervalUs: number;
}

export function decodeAttributes(l: Layout, data: Uint8Array): Attributes {
  const m = decode(l.attributes, payload(l.attributes, data));
  return {
    lampCount: first(m, U.lampCount),
    size: { width: first(m, U.width), height: first(m, U.height), depth: first(m, U.depth) },
    kind: first(m, U.kind),
    minUpdateIntervalUs: first(m, U.minUpdateInterval),
  };
}

export interface Lamp {
  lampId: number;
  /** Position in micrometres. */
  position: { x: number; y: number; z: number };
  purposes: number;
  levels: { red: number; green: number; blue: number; intensity: number };
  programmable: boolean;
  /** Keyboard usage of the key this lamp sits under (0 = none). A layout fact, not input. */
  inputBinding: number;
}

export function decodeLamp(l: Layout, data: Uint8Array): Lamp {
  const m = decode(l.response, payload(l.response, data));
  return {
    lampId: first(m, U.lampId),
    position: { x: first(m, U.x), y: first(m, U.y), z: first(m, U.z) },
    purposes: first(m, U.purposes),
    levels: { red: first(m, U.redLevels), green: first(m, U.greenLevels), blue: first(m, U.blueLevels), intensity: first(m, U.intensityLevels) },
    programmable: first(m, U.programmable) !== 0,
    inputBinding: first(m, U.inputBinding),
  };
}

/**
 * Allowlist from the layout: reading the two attribute reports, selecting a
 * lamp, one-colour range updates and the autonomous-mode switch. Every field
 * within its logical maximum and the data canonical (re-encoding it gives the
 * same bytes). Multi-lamp updates and any other report are refused.
 */
export function allowFor(l: Layout): (r: OutgoingReport) => boolean {
  return (r) => {
    if (r.type === 'feature-read') return r.reportId === l.attributes.id || r.reportId === l.response.id;
    if (r.type !== 'feature') return false;
    const layout = [l.request, l.range, l.control].find((x) => x && x.id === r.reportId);
    if (!layout || r.data.length !== layout.bytes) return false;
    const m = decode(layout, r.data);
    if (layout.fields.some((f) => f.usage === -1 && getBits(r.data, f.bit, f.size) !== 0)) return false;
    if (layout.fields.some((f) => getBits(r.data, f.bit, f.size) > f.max)) return false;
    const values = Object.fromEntries(m);
    if (!encode(layout, values).every((b, i) => b === r.data[i])) return false;
    if (layout === l.range) return first(m, U.idStart) <= first(m, U.idEnd) && first(m, U.updateFlags) <= 1;
    return true;
  };
}
