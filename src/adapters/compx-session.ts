// I/O for one compx device: every report goes through transport.request with
// the adapter allowlist and the registry's denied collections.

import * as cx from './compx.ts';
import { packDpiStage, unpackDpiStage, type DpiSensor } from './compx-dpi.ts';
import { request, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof request>[0];

export class CompxSession {
  readonly log: LogEntry[];
  private readonly device: Device;
  private readonly guard: Guard;

  /** `log` may be shared across sessions so evidence spans reconnects. */
  /** `sensor` enables DPI-row writes for this model (null: DPI is read-only). */
  constructor(device: Device, deny: UsagePair[], log: LogEntry[] = [], sensor: DpiSensor | null = null) {
    this.device = device;
    this.guard = { allow: cx.allowFor(sensor), deny };
    this.log = log;
  }

  private ask(report: ReturnType<typeof cx.readFlash>): Promise<Uint8Array> {
    return request(this.device, report, this.guard, (res) => cx.isResponse(report.data, res), {
      log: (e) => this.log.push(e),
    });
  }

  async identify(): Promise<cx.Info> {
    const r = crypto.getRandomValues(new Uint8Array(4));
    return cx.decodeInfo(await this.ask(cx.encryptionData([r[0]!, r[1]!, r[2]!, r[3]!])));
  }

  /** Waits out "busy" replies like the vendor driver, then reports whether the mouse is linked. */
  async online(): Promise<boolean> {
    for (let i = 0; i < 50; i++) {
      const s = cx.decodeOnline(await this.ask(cx.deviceOnLine()));
      if (!s.busy) return s.online;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new cx.CompxError('The receiver stayed busy');
  }

  private async requireOnline(): Promise<void> {
    if (!(await this.online())) throw new cx.CompxError('The mouse is asleep or out of range. Move it, then try again.');
  }

  async battery(): Promise<{ level: number; charging: boolean }> {
    await this.requireOnline();
    return cx.decodeBattery(await this.ask(cx.batteryLevel()));
  }

  async readFlash(addr: number, len: number): Promise<Uint8Array> {
    const req = cx.readFlash(addr, len);
    return cx.decodeFlash(req.data, await this.ask(req));
  }

  async readPair(addr: number): Promise<number | null> {
    await this.requireOnline();
    return cx.decodePair(await this.readFlash(addr, 2));
  }

  async writePair(addr: number, value: number): Promise<void> {
    await this.requireOnline();
    cx.decodeWrite(await this.ask(cx.writeFlash(addr, cx.encodePair(value))));
  }

  pollingRate(info: cx.Info): Setting<number> {
    return {
      validate: (hz) =>
        !(cx.POLLING_RATES as readonly number[]).includes(hz)
          ? `${hz} Hz is not a polling rate this mouse uses`
          : hz > info.maxRate
            ? `This connection supports up to ${info.maxRate} Hz`
            : null,
      write: (hz) => this.writePair(cx.ADDR.pollingRate, cx.rateToCode(hz)),
      read: async () => {
        const code = await this.readPair(cx.ADDR.pollingRate);
        return code === null ? null : cx.codeToRate(code);
      },
    };
  }

  debounce(maxMs: number): Setting<number> {
    return {
      validate: (ms) => (Number.isInteger(ms) && ms >= 0 && ms <= maxMs ? null : `Debounce must be 0 to ${maxMs} ms`),
      write: (ms) => this.writePair(cx.ADDR.debounce, ms),
      read: () => this.readPair(cx.ADDR.debounce),
    };
  }

  async identifyCidMid(): Promise<{ cid: number; mid: number }> {
    return cx.decodeCidMid(await this.ask(cx.readCidMid()));
  }

  /** DPI of one stage (X and Y), encoded for `sensor`. */
  dpiStage(index: number, sensor: DpiSensor): Setting<{ x: number; y: number }> {
    const addr = cx.dpiStageAddr(index);
    return {
      validate: (v) => (packDpiStage(sensor, v.x, v.y) ? null : `${v.x}×${v.y} DPI is not a value this sensor accepts`),
      write: async (v) => {
        await this.requireOnline();
        cx.decodeWrite(await this.ask(cx.writeFlash(addr, packDpiStage(sensor, v.x, v.y)!)));
      },
      read: async () => {
        await this.requireOnline();
        return unpackDpiStage(sensor, await this.readFlash(addr, 4));
      },
      equals: (a, b) => a.x === b.x && a.y === b.y,
    };
  }

  /** Active DPI stage, 0-based, below the stage count stored at 0x02. */
  activeStage(stageCount: number): Setting<number> {
    return {
      validate: (i) => (Number.isInteger(i) && i >= 0 && i < stageCount ? null : `Stage must be 1 to ${stageCount}`),
      write: (i) => this.writePair(cx.ADDR.currentStage, i),
      read: () => this.readPair(cx.ADDR.currentStage),
    };
  }
}
