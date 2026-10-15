import * as v from './vibe75.ts';
import { featureQuery, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';

type Device = Parameters<typeof featureQuery>[0];

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

  async readLighting(profile: number): Promise<ProfileReading> {
    const res = await featureQuery(this.device, v.readLighting(profile), this.guard, {
      delayMs: 60,
      log: (e) => this.log.push(e),
    });
    return { profile, block: v.decodeLighting(res), raw: this.log[this.log.length - 1]!.hex };
  }

  /** Read-only probe of every lighting profile. */
  async probe(): Promise<ProfileReading[]> {
    const out: ProfileReading[] = [];
    for (const p of v.PROFILES) out.push(await this.readLighting(p));
    return out;
  }
}
