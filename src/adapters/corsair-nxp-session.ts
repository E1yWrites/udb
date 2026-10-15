// I/O for a Corsair classic-protocol mouse: GET is a feature report out, a
// short wait, then GET_FEATURE checked by its echo; SET is a feature report
// with no reply, confirmed by the matching GET. All writes are live settings,
// lost when the mouse powers off (OpenMouse, NIGHTSWORD fw 3.41).

import * as cx from './corsair-nxp.ts';
import { receiveFeature, send, toHex, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof send>[0];

/** About 20 ms was reliable on fw 3.41. */
const REPLY_DELAY_MS = 20;
const READS = 3;

export class CorsairNxpSession {
  readonly log: LogEntry[];
  private readonly device: Device;
  private readonly guard: Guard;
  private readonly delayMs: number;

  constructor(device: Device, deny: UsagePair[], log: LogEntry[] = [], delayMs = REPLY_DELAY_MS) {
    this.device = device;
    this.guard = { allow: cx.allow, deny };
    this.log = log;
    this.delayMs = delayMs;
  }

  private sleep() {
    return new Promise((r) => setTimeout(r, this.delayMs));
  }

  private async tx(report: ReturnType<typeof cx.ident>): Promise<void> {
    this.log.push({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
    await send(this.device, report, this.guard);
  }

  /** A stale buffer from the previous GET is skipped by the echo check (seen once by OpenMouse). */
  private async get(report: ReturnType<typeof cx.ident>): Promise<Uint8Array> {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.tx(report);
      for (let read = 0; read < READS; read++) {
        await this.sleep();
        const view = await receiveFeature(this.device, cx.REPORT_ID, this.guard);
        const res = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        this.log.push({ at: new Date().toISOString(), dir: 'rx', reportId: cx.REPORT_ID, hex: toHex(res), via: 'feature' });
        if (cx.isEcho(report.data, res)) return res;
      }
    }
    throw new Error('The mouse did not answer. Close iCUE if it is applying a profile, then try again.');
  }

  /** SET has no reply; give the mouse the same pause before the read-back. */
  private async set(report: ReturnType<typeof cx.ident>): Promise<void> {
    await this.tx(report);
    await this.sleep();
  }

  async ident(): Promise<cx.Ident | null> {
    return cx.decodeIdent(await this.get(cx.ident()));
  }

  async mask(): Promise<number | null> {
    return cx.decodeByte(await this.get(cx.getMouse(cx.MOUSE.mask)));
  }

  async stage(n: number): Promise<cx.Stage | null> {
    return cx.decodeStage(await this.get(cx.getStage(n)));
  }

  /** The active stage index (0 is the sniper slot). */
  activeStage(enabled: number[]): Setting<number> {
    return {
      validate: (n) => (enabled.includes(n) ? null : `Stage ${n} is not enabled on this mouse`),
      write: (n) => this.set(cx.setActiveStage(n)),
      read: async () => cx.decodeCurrent(await this.get(cx.getMouse(cx.MOUSE.dpi)))?.stage ?? null,
    };
  }

  /** One stage's DPI, X = Y; the stage's colour is read and written back unchanged. */
  stageDpi(n: number, enabled: number[], range: { min: number; max: number }): Setting<number> {
    const read = async () => {
      const s = await this.stage(n);
      return s && s.x === s.y ? s.x : null;
    };
    return {
      validate: (v) =>
        !enabled.includes(n)
          ? `Stage ${n} is not enabled; the mouse ignores writes to it`
          : Number.isInteger(v) && v >= range.min && v <= range.max
            ? null
            : `DPI must be a whole number from ${range.min} to ${range.max.toLocaleString()}`,
      write: async (v) => {
        const current = await this.stage(n);
        if (!current) throw new Error('Could not read the stage before writing it');
        await this.set(cx.setStageDpi(n, v, current.rgb));
      },
      read,
    };
  }

  lift(): Setting<number> {
    return {
      validate: (h) => (Number.isInteger(h) && h >= cx.LIFT.min && h <= cx.LIFT.max ? null : 'Lift-off height must be 1 to 5'),
      write: (h) => this.set(cx.setLift(h)),
      read: async () => cx.decodeByte(await this.get(cx.getMouse(cx.MOUSE.lift))),
    };
  }

  /** Angle snapping, 0 = off, 1 = on. */
  snap(): Setting<number> {
    return {
      validate: (v) => (v === 0 || v === 1 ? null : 'Angle snapping is off (0) or on (1)'),
      write: (v) => this.set(cx.setSnap(v === 1)),
      read: async () => cx.decodeByte(await this.get(cx.getMouse(cx.MOUSE.snap))),
    };
  }
}
