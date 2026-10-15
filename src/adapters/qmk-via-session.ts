// I/O for one QMK/VIA keyboard: every report goes through transport.request
// with the adapter allowlist for the version the keyboard reported.

import * as via from './qmk-via.ts';
import { request, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof request>[0];

export interface Color {
  hue: number;
  sat: number;
}

export class ViaSession {
  readonly log: LogEntry[];
  /** Protocol version from the handshake; null until the keyboard answers as VIA. */
  version: number | null = null;
  private readonly device: Device;
  private readonly guard: Guard;

  /** `log` may be shared across sessions so evidence spans reconnects. */
  constructor(device: Device, deny: UsagePair[], log: LogEntry[] = []) {
    this.device = device;
    this.guard = { allow: (r) => via.allowFor(this.version)(r), deny };
    this.log = log;
  }

  private ask(report: ReturnType<typeof via.protocolVersion>): Promise<Uint8Array> {
    return request(this.device, report, this.guard, (res) => via.isReply(report.data, res), {
      log: (e) => this.log.push(e),
    });
  }

  /** `01`: the only command allowed before the keyboard has identified as VIA. */
  async handshake(): Promise<number | null> {
    this.version = via.decodeVersion(await this.ask(via.protocolVersion()));
    return this.version;
  }

  async layerCount(): Promise<number | null> {
    return via.decodeLayerCount(await this.ask(via.layerCount()));
  }

  /** Lighting channels the firmware was built with: those whose brightness get is not unhandled. */
  async channels(): Promise<via.Channel[]> {
    const found: via.Channel[] = [];
    for (const ch of via.CHANNELS) {
      if (!via.unhandled(await this.ask(via.getValue(ch, 'brightness')))) found.push(ch);
    }
    return found;
  }

  async read(ch: via.Channel, v: via.Value): Promise<number[] | null> {
    const req = via.getValue(ch, v);
    return via.decodeValue(req.data, await this.ask(req));
  }

  /** Set in RAM, then save the channel to EEPROM; the caller reads back afterwards. */
  private async write(ch: via.Channel, v: via.Value, bytes: number[]): Promise<void> {
    for (const report of [via.setValue(ch, v, bytes), via.save(ch)]) {
      if (via.unhandled(await this.ask(report))) throw new Error('The keyboard refused the command (unhandled)');
    }
  }

  /** Brightness, effect or effect speed of one channel. */
  level(ch: via.Channel, v: Exclude<via.Value, 'color'>): Setting<number> {
    const max = via.maxOf(ch, v);
    return {
      validate: (n) => (Number.isInteger(n) && n >= 0 && n <= max ? null : `Must be a whole number from 0 to ${max}`),
      write: (n) => this.write(ch, v, [n]),
      read: async () => (await this.read(ch, v))?.[0] ?? null,
      // ponytail: brightness is rescaled to the board's maximum (docs/protocols/qmk-via.md), so a
      // read-back within 2 counts; a board with coarser steps shows up as a mismatch and is restored.
      ...(v === 'brightness' ? { equals: (a: number, b: number) => Math.abs(a - b) <= 2 } : {}),
    };
  }

  color(ch: via.Channel): Setting<Color> {
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 255;
    return {
      validate: (c) => (ok(c.hue) && ok(c.sat) ? null : 'Hue and saturation must be whole numbers from 0 to 255'),
      write: (c) => this.write(ch, 'color', [c.hue, c.sat]),
      read: async () => {
        const b = await this.read(ch, 'color');
        return b ? { hue: b[0]!, sat: b[1]! } : null;
      },
      equals: (a, b) => a.hue === b.hue && a.sat === b.sat,
    };
  }
}
