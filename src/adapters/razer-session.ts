// I/O for one Razer control interface: feature report 0 out, GET_FEATURE back,
// through the transport with the adapter allowlist and the registry's
// undeclared-report exception. Exchange timing follows OpenMouse's driver.

import * as rz from './razer.ts';
import { receiveFeature, send, toHex, type Guard, type LogEntry } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof send>[0];

/** Per-connection protocol parameters (registry identity `params`). */
export interface Params {
  transactionId: number;
  polling: 'legacy' | 'extended';
  /** Extended polling needs a second write (selector 1) on this transaction ID. */
  pollingCommitTransactionId?: number;
  pollingRates: number[];
  dpiStorage: number;
  maxDpi: number;
  battery: boolean;
  wireless: boolean;
}

const ATTEMPTS = 6;
/** A polling change reconfigures the wireless link; read back after it settles. */
const LINK_SETTLE_MS = 150;
const LOW_POWER = { min: 5, max: 100, step: 5, maxPollingHz: 1000 } as const;

export class RazerSession {
  readonly log: LogEntry[];
  private readonly device: Device;
  private readonly guard: Guard;
  private readonly params: Params;
  private readonly delayMs: number;

  constructor(device: Device, guard: Omit<Guard, 'allow'>, params: Params, log: LogEntry[] = [], delayMs = 100) {
    this.device = device;
    this.guard = { ...guard, allow: rz.allow };
    this.params = params;
    this.log = log;
    this.delayMs = delayMs;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Busy replies are read again; a corrupt reply, or a stale one to a get,
   * means the exchange was lost and the request is sent again. A set is never
   * re-sent because of a stale reply.
   */
  private async exchange(c: rz.Command, transactionId = this.params.transactionId): Promise<Uint8Array> {
    const report = rz.encode(c, transactionId);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      this.log.push({ at: new Date().toISOString(), dir: 'tx', reportId: rz.REPORT_ID, hex: toHex(report.data) });
      await send(this.device, report, this.guard);
      for (let read = 0; read < ATTEMPTS; read++) {
        await this.sleep(this.delayMs);
        const view = await receiveFeature(this.device, rz.REPORT_ID, this.guard);
        const res = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        this.log.push({ at: new Date().toISOString(), dir: 'rx', reportId: rz.REPORT_ID, hex: toHex(res), via: 'feature' });
        try {
          return rz.decode(res, c);
        } catch (e) {
          if (!(e instanceof rz.RazerError)) throw e;
          if (e.status === rz.STATUS.busy) continue;
          if (e.status === null || (e.stale && rz.isGet(c))) break;
          throw e;
        }
      }
    }
    throw new Error('The mouse stayed busy or did not answer. It may be asleep or out of range.');
  }

  async firmware(): Promise<string> {
    return rz.decodeFirmware(await this.exchange(rz.READ.firmware));
  }

  /** Charging is null when the mouse does not report it (some answer it as unsupported). */
  async battery(): Promise<{ percent: number; charging: boolean | null } | null> {
    if (!this.params.battery) return null;
    const percent = rz.decodeBattery(await this.exchange(rz.READ.battery));
    const charging = await this.exchange(rz.READ.charging).then(rz.decodeCharging, () => null);
    return { percent, charging };
  }

  dpi(): Setting<number> {
    const { dpiStorage, maxDpi } = this.params;
    return {
      validate: (v) => (Number.isInteger(v) && v >= rz.DPI_MIN && v <= maxDpi ? null : `DPI must be a whole number from ${rz.DPI_MIN} to ${maxDpi.toLocaleString()}`),
      write: async (v) => void (await this.exchange(rz.setDpi(dpiStorage, v))),
      read: async () => {
        const { x, y } = rz.decodeDpi(await this.exchange(rz.readDpi(dpiStorage)));
        return x === y ? x : null;
      },
    };
  }

  async readPolling(): Promise<number | null> {
    return this.params.polling === 'extended'
      ? rz.decodePollingExtended(await this.exchange(rz.READ.pollingExtended))
      : rz.decodePolling(await this.exchange(rz.READ.polling));
  }

  polling(): Setting<number> {
    const { pollingRates, polling, pollingCommitTransactionId, wireless } = this.params;
    return {
      validate: (hz) => (pollingRates.includes(hz) ? null : `${hz} Hz is not a rate this connection supports`),
      write: async (hz) => {
        if (polling === 'extended') {
          await this.exchange(rz.setPollingExtended(hz));
          if (pollingCommitTransactionId !== undefined) await this.exchange(rz.setPollingExtended(hz, 1), pollingCommitTransactionId);
        } else {
          await this.exchange(rz.setPolling(hz));
        }
        if (wireless) await this.sleep(LINK_SETTLE_MS);
      },
      read: () => this.readPolling(),
    };
  }

  /** Idle sleep in seconds, 1-15 minutes like the vendor's slider. */
  sleepTimeout(): Setting<number> {
    return {
      validate: (s) => (Number.isInteger(s) && s >= rz.SLEEP.min && s <= rz.SLEEP.max && s % rz.SLEEP.step === 0 ? null : 'Auto sleep must be 1 to 15 whole minutes'),
      write: async (s) => void (await this.exchange(rz.setSleep(s))),
      read: async () => rz.decodeSleep(await this.exchange(rz.READ.sleep)),
    };
  }

  /** Low-battery threshold in percent; steps of 5 survive the device's 0-255 scale exactly. */
  lowPower(): Setting<number> {
    return {
      validate: (p) =>
        Number.isInteger(p) && p >= LOW_POWER.min && p <= LOW_POWER.max && p % LOW_POWER.step === 0 ? null : 'Low-power threshold must be 5% to 100% in steps of 5',
      write: async (p) => {
        // Synapse greys this out above 1000 Hz (OpenMouse); ask the mouse, not the panel.
        const hz = await this.readPolling();
        if (hz !== null && hz > LOW_POWER.maxPollingHz) throw new Error(`Low-power mode is unavailable at ${hz.toLocaleString()} Hz. Set the polling rate to 1,000 Hz or lower first`);
        await this.exchange(rz.setLowPower(p));
      },
      read: async () => rz.decodeLowPower(await this.exchange(rz.READ.lowPower)),
    };
  }
}

/** The registry's identity params, checked; null when they are missing or malformed. */
export function paramsFrom(p: Record<string, unknown> | undefined): Params | null {
  if (!p) return null;
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  const transactionId = num('transactionId');
  const dpiStorage = num('dpiStorage');
  const maxDpi = num('maxDpi');
  const rates = p.pollingRates;
  if (transactionId === null || dpiStorage === null || maxDpi === null || !Array.isArray(rates)) return null;
  if (p.polling !== 'legacy' && p.polling !== 'extended') return null;
  return {
    transactionId,
    polling: p.polling,
    ...(num('pollingCommitTransactionId') !== null ? { pollingCommitTransactionId: num('pollingCommitTransactionId')! } : {}),
    pollingRates: rates as number[],
    dpiStorage,
    maxDpi,
    battery: p.battery === true,
    wireless: p.wireless === true,
  };
}

