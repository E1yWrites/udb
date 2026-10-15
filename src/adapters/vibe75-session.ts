import * as v from './vibe75.ts';
import { featureProbe, receiveFeature, send, toHex, type Guard, type LogEntry, type OutgoingReport, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof featureProbe>[0];

export interface ProfileReading {
  profile: number;
  block: v.LightingBlock | null;
  raw: string;
}

export class Vibe75Session {
  readonly log: LogEntry[];
  private readonly device: Device;
  private readonly guard: Guard;

  constructor(device: Device, deny: UsagePair[], log: LogEntry[] = []) {
    this.device = device;
    this.guard = { allow: v.allow, deny };
    this.log = log;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async tx(report: OutgoingReport): Promise<void> {
    this.log.push({ at: new Date().toISOString(), dir: 'tx', reportId: report.reportId, hex: toHex(report.data) });
    await send(this.device, report, this.guard);
  }

  private async rx(): Promise<Uint8Array> {
    const view = await receiveFeature(this.device, v.REPORT_ID, this.guard);
    const data = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    this.log.push({ at: new Date().toISOString(), dir: 'rx', reportId: v.REPORT_ID, hex: toHex(data), via: 'feature' });
    return data;
  }

  /**
   * `04 12 <profile>`, then poll GET_FEATURE: the first reply is an echo with
   * status 01 (pending) or FF (no block); the block follows ~200 ms later
   * (observed on the owner's Vibe75, 2026-10-15).
   */
  async readLighting(profile: number): Promise<ProfileReading> {
    await this.tx(v.readLighting(profile));
    for (let i = 0; i < 10; i++) {
      await this.sleep(100);
      const res = await this.rx();
      const state = v.replyState(res, profile);
      if (state === 'block') return { profile, block: v.decodeLighting(res), raw: toHex(res) };
      if (state === 'empty') return { profile, block: null, raw: toHex(res) };
    }
    throw new Error(`Profile ${profile}: the keyboard did not return its lighting block in time`);
  }

  /** The vendor's sequence; frames it acknowledges are followed by a GET_FEATURE. */
  async writeLighting(block: v.LightingBlock): Promise<void> {
    const frames: [OutgoingReport, boolean][] = [
      [v.begin(), true],
      [v.lightingHeader(), true],
      [v.lightingBlock(block), false],
      [v.end(), true],
      [v.finish(), false],
    ];
    for (const [frame, ack] of frames) {
      await this.sleep(v.FRAME_DELAY_MS);
      await this.tx(frame);
      if (ack) {
        await this.sleep(v.FRAME_DELAY_MS);
        await this.rx();
      }
    }
  }

  /** Brightness of one profile; every other block field is written back exactly as read. */
  brightness(base: v.LightingBlock): Setting<number> {
    return {
      validate: (b) => (Number.isInteger(b) && b >= 1 && b <= v.BRIGHTNESS_MAX ? null : `Brightness must be 1 to ${v.BRIGHTNESS_MAX}`),
      write: (b) => this.writeLighting({ ...base, brightness: b }),
      read: async () => (await this.readLighting(base.profile)).block?.brightness ?? null,
    };
  }

  /** Read-only: one `04 12 <profile>`, then repeated GET_FEATURE plus any pushed input reports. */
  async extendedProbe(profile: number): Promise<void> {
    await featureProbe(this.device, v.readLighting(profile), this.guard, [60, 200, 500, 1000], (e) => this.log.push(e));
  }

  /** Read-only probe of every lighting profile. */
  async probe(): Promise<ProfileReading[]> {
    const out: ProfileReading[] = [];
    for (const p of v.PROFILES) out.push(await this.readLighting(p));
    return out;
  }
}
