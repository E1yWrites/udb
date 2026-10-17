// I/O for one QMK/VIA keyboard: every report goes through transport.request
// with the adapter allowlist for the version the keyboard reported.

import * as via from './qmk-via.ts';
import { request, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof request>[0];

export class ViaSession {
  readonly log: LogEntry[];
  /** Protocol version from the handshake; null until the keyboard answers as VIA. */
  version: number | null = null;
  private readonly device: Device;
  private readonly guard: Guard;
  private keymap: via.Keymap | null = null;
  /** Every keycode the keyboard returned per `layer,row,col`; the only non-basic values UDB may write back. */
  private readonly seen = new Map<string, Set<number>>();

  /** `log` may be shared across sessions so evidence spans reconnects. */
  constructor(device: Device, deny: UsagePair[], log: LogEntry[] = []) {
    this.device = device;
    this.guard = { allow: (r) => via.allowFor(this.version, this.keymap ?? undefined)(r), deny };
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

  /** The matrix of the loaded definition and the keyboard's layer count; keymap commands are refused until this is set. */
  setKeymap(layers: number, rows: number, cols: number) {
    this.keymap = { layers, rows, cols, returned: (l, r, c, k) => this.seen.get(`${l},${r},${c}`)?.has(k) ?? false };
  }

  /** `04`: the keycode at one position. */
  async readKeycode(layer: number, row: number, col: number): Promise<number | null> {
    const req = via.getKeycode(layer, row, col);
    const keycode = via.decodeKeycode(req.data, await this.ask(req));
    if (keycode !== null) {
      const at = `${layer},${row},${col}`;
      this.seen.set(at, (this.seen.get(at) ?? new Set()).add(keycode));
    }
    return keycode;
  }

  /**
   * One key, for the write procedure. A new value is a basic key; the previous
   * value of a mismatch is written back as the keyboard returned it. `05` takes
   * effect at once and the firmware stores it in EEPROM.
   */
  keycode(layer: number, row: number, col: number): Setting<number> {
    return {
      validate: (n) => (Number.isInteger(n) && n >= 0 && n <= via.BASIC_MAX ? null : `Must be a basic key (0 to ${via.BASIC_MAX})`),
      write: async (n) => {
        if (via.unhandled(await this.ask(via.setKeycode(layer, row, col, n)))) throw new Error('The keyboard refused the command (unhandled)');
      },
      read: () => this.readKeycode(layer, row, col),
    };
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

  /**
   * Hue (part 0) or saturation (part 1) of a channel's colour. The firmware
   * sets both at once, so the other half is written back exactly as read.
   */
  colorPart(ch: via.Channel, part: 0 | 1): Setting<number> {
    return {
      validate: (n) => (Number.isInteger(n) && n >= 0 && n <= 255 ? null : 'Must be a whole number from 0 to 255'),
      write: async (n) => {
        const color = await this.read(ch, 'color');
        if (!color) throw new Error('Could not read the current colour');
        color[part] = n;
        await this.write(ch, 'color', color);
      },
      read: async () => (await this.read(ch, 'color'))?.[part] ?? null,
    };
  }
}
