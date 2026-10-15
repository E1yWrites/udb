// I/O for one HID LampArray collection: attribute reads through GET_FEATURE,
// lamp selection, and one-colour updates through SET_FEATURE. Colours and the
// autonomous-mode switch cannot be read back (Microsoft's reference device
// answers GET only for the attribute reports), so they are sent, never confirmed.

import * as la from './lamparray.ts';
import { receiveFeature, send, toHex, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof send>[0];

/** Lamps read for the summary; a keyboard has about a hundred. */
const MAX_LAMPS = 512;

export class LampArraySession {
  readonly log: LogEntry[];
  readonly layout: la.Layout;
  private readonly device: Device;
  private readonly guard: Guard;

  constructor(device: Device, layout: la.Layout, deny: UsagePair[], log: LogEntry[] = []) {
    this.device = device;
    this.layout = layout;
    this.guard = { allow: la.allowFor(layout), deny };
    this.log = log;
  }

  private async tx(report: ReturnType<typeof la.control>): Promise<void> {
    this.log.push({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
    await send(this.device, report, this.guard);
  }

  private async rx(reportId: number): Promise<Uint8Array> {
    const view = await receiveFeature(this.device, reportId, this.guard);
    const data = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    this.log.push({ at: new Date().toISOString(), dir: 'rx', reportId, hex: toHex(data), via: 'feature' });
    return data;
  }

  async attributes(): Promise<la.Attributes> {
    return la.decodeAttributes(this.layout, await this.rx(this.layout.attributes.id));
  }

  /** One lamp's attributes. The device answers lamp 0 for an out-of-range request, so the ID is checked. */
  async lamp(lampId: number): Promise<la.Lamp> {
    await this.tx(la.lampRequest(this.layout, lampId));
    const lamp = la.decodeLamp(this.layout, await this.rx(this.layout.response.id));
    if (lamp.lampId !== lampId) throw new Error(`Asked for lamp ${lampId}, the device answered lamp ${lamp.lampId}`);
    return lamp;
  }

  async lamps(count: number): Promise<la.Lamp[]> {
    const out: la.Lamp[] = [];
    for (let id = 0; id < Math.min(count, MAX_LAMPS); id++) out.push(await this.lamp(id));
    return out;
  }

  get canSetColor(): boolean {
    return !!this.layout.range && !!this.layout.control;
  }

  /** Every lamp to one colour: autonomous mode off, then one range update. Sent only; nothing reads it back. */
  color(lampCount: number): Pick<Setting<la.Color>, 'validate' | 'write'> {
    const byte = (n: number) => Number.isInteger(n) && n >= 0 && n <= 255;
    return {
      validate: (c) =>
        !this.canSetColor
          ? 'This device has no range-update or control report'
          : lampCount < 1
            ? 'The device reports no lamps'
            : byte(c.r) && byte(c.g) && byte(c.b) && byte(c.i)
              ? null
              : 'Colour channels must be whole numbers from 0 to 255',
      write: async (c) => {
        await this.tx(la.control(this.layout, false));
        await this.tx(la.rangeUpdate(this.layout, 0, lampCount - 1, c));
      },
    };
  }

  /** Hands lighting back to the device's own effects. */
  async release(): Promise<void> {
    if (this.layout.control) await this.tx(la.control(this.layout, true));
  }
}
