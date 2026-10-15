// I/O for one Logitech HID++ 2.0 device (a receiver slot or a device on its
// own link). Every report goes through transport.request with the allowlist
// for the feature indices this device reported.

import * as hp from './logitech-hidpp.ts';
import { owningCollection, request, TransportTimeout, type Guard, type LogEntry, type UsagePair } from '../lib/transport.ts';
import type { Setting } from '../lib/write.ts';

type Device = Parameters<typeof request>[0];

const declares = (d: Device, reportId: number) => !!owningCollection(d, { type: 'output', reportId, data: new Uint8Array() });

export interface Identity {
  deviceIndex: number;
  protocol: { major: number; minor: number };
  name: string | null;
  info: hp.DeviceInfo;
  /** True when the link is the device's own cable (0x8061 needs to know). */
  wired: boolean;
}

export class HidppSession {
  readonly log: LogEntry[];
  deviceIndex: number | null = null;
  /** Feature ID → index on this device, as the device reported it. */
  readonly features = new Map<number, number>();
  private readonly interfaces: Device[];
  private readonly sender: { device: Device; reportId: typeof hp.SHORT | typeof hp.LONG } | null;
  private readonly productId: number;
  private readonly guard: Guard;

  /** `interfaces`: every granted HID++ interface of one physical device. */
  constructor(interfaces: Device[], productId: number, deny: UsagePair[], log: LogEntry[] = []) {
    this.interfaces = interfaces;
    this.productId = productId;
    this.log = log;
    const long = interfaces.find((d) => declares(d, hp.LONG));
    const short = interfaces.find((d) => declares(d, hp.SHORT));
    this.sender = long ? { device: long, reportId: hp.LONG } : short ? { device: short, reportId: hp.SHORT } : null;
    this.guard = { allow: (r) => hp.allowFor(this.features)(r), deny };
  }

  private async ask(featureId: number, fn: number, params: number[] = [], opts: { timeoutMs?: number; attempts?: number } = {}): Promise<Uint8Array> {
    if (!this.sender) throw new Error('No HID++ report is declared on the granted interfaces');
    if (this.deviceIndex === null) throw new Error('No HID++ device index yet');
    const index = featureId === hp.FEATURE.root ? 0 : this.features.get(featureId);
    if (index === undefined) throw new Error(`Feature 0x${featureId.toString(16).padStart(4, '0')} was not looked up`);
    const report = hp.frame(this.sender.reportId, this.deviceIndex, index, fn, params);
    const res = await request(this.sender.device, report, this.guard, (r) => hp.isReply(report.data, r), {
      timeoutMs: opts.timeoutMs ?? 1000,
      attempts: opts.attempts ?? 2,
      replyOn: this.interfaces,
      replyIds: [hp.SHORT, hp.LONG],
      log: (e) => this.log.push(e),
    });
    const error = hp.errorOf(res);
    if (error) throw error;
    return res;
  }

  /** Looks a feature up through the root feature; 0 when the device lacks it. */
  async feature(featureId: number): Promise<number> {
    const known = this.features.get(featureId);
    if (known !== undefined) return known;
    const index = hp.decodeFeatureIndex(await this.ask(hp.FEATURE.root, 0, [featureId >> 8, featureId & 0xff]));
    if (index) this.features.set(featureId, index);
    return index;
  }

  /** True when `deviceIndex` answers as HID++ 2.0 (a reply, or a 2.0 error). HID++ 1.0 errors and silence mean nobody. */
  private async answers(deviceIndex: number): Promise<boolean> {
    this.deviceIndex = deviceIndex;
    this.features.clear();
    try {
      await this.ask(hp.FEATURE.root, 0, [hp.FEATURE.deviceInfo >> 8, hp.FEATURE.deviceInfo & 0xff], { timeoutMs: 800, attempts: 1 });
      return true;
    } catch (e) {
      if (e instanceof hp.HidppError) return e.version === 2;
      if (e instanceof TransportTimeout) return false;
      throw e;
    }
  }

  /**
   * Finds the device index that answers. A slot with a DPI feature wins, so a
   * keyboard sharing a receiver (or a sensorless endpoint on 0xFF) is only
   * chosen when nothing else answers.
   */
  async connect(): Promise<number> {
    const answered: number[] = [];
    let chosen: number | undefined;
    for (const candidate of hp.indexCandidates(hp.RECEIVER_PIDS.includes(this.productId))) {
      if (!(await this.answers(candidate))) continue;
      answered.push(candidate);
      if ((await this.feature(hp.FEATURE.extendedDpi)) || (await this.feature(hp.FEATURE.dpi))) {
        chosen = candidate;
        break;
      }
    }
    chosen ??= answered[0];
    if (chosen === undefined) {
      this.deviceIndex = null;
      throw new Error('Nothing answered as a HID++ 2.0 device. Wake the device (move it or press a key), close Logitech G HUB or Options+, then try again.');
    }
    if (chosen !== this.deviceIndex) {
      this.deviceIndex = chosen;
      this.features.clear();
    }
    return chosen;
  }

  async identify(): Promise<Identity> {
    const protocol = hp.decodeProtocolVersion(await this.ask(hp.FEATURE.root, 1, [0, 0, 0x5a]));
    let info: hp.DeviceInfo = { bluetoothPid: null, blePid: null, wirelessPid: null, usbPid: null };
    if (await this.feature(hp.FEATURE.deviceInfo)) info = hp.decodeDeviceInfo(await this.ask(hp.FEATURE.deviceInfo, 0));
    let name: string | null = null;
    if (await this.feature(hp.FEATURE.deviceName)) {
      const length = Math.min((await this.ask(hp.FEATURE.deviceName, 0))[3] ?? 0, 64);
      const chars: number[] = [];
      while (chars.length < length) {
        const chunk = hp.decodeNameChunk(await this.ask(hp.FEATURE.deviceName, 1, [chars.length]), length - chars.length);
        if (!chunk.length) break;
        chars.push(...chunk);
      }
      name = new TextDecoder().decode(Uint8Array.from(chars)).replace(/\0+$/, '') || null;
    }
    // The link whose PID is the one the browser sees; without a match, the device's own index means a cable.
    const wireless = [info.wirelessPid, info.blePid, info.bluetoothPid].includes(this.productId);
    const wired = info.usbPid === this.productId || (!wireless && this.deviceIndex === hp.DIRECT && !hp.RECEIVER_PIDS.includes(this.productId));
    return { deviceIndex: this.deviceIndex!, protocol, name, info, wired };
  }

  /** The most direct battery report the device has: 0x1004, then 0x1000, then 0x1001, then 0x1F20 (headsets). Null without one. */
  async battery(): Promise<hp.Battery | null> {
    if (await this.feature(hp.FEATURE.unifiedBattery)) return hp.decodeUnifiedBattery(await this.ask(hp.FEATURE.unifiedBattery, 1));
    if (await this.feature(hp.FEATURE.batteryLevel)) return hp.decodeBatteryLevel(await this.ask(hp.FEATURE.batteryLevel, 0));
    if (await this.feature(hp.FEATURE.batteryVoltage)) return hp.decodeBatteryVoltage(await this.ask(hp.FEATURE.batteryVoltage, 0));
    if (await this.feature(hp.FEATURE.adcMeasurement)) return hp.decodeAdcMeasurement(await this.ask(hp.FEATURE.adcMeasurement, 0));
    return null;
  }

  /** Headset sidetone 0-100 (0x8300), or null when the device has no sidetone feature. */
  async sidetone(): Promise<Setting<number> | null> {
    if (!(await this.feature(hp.FEATURE.sidetone))) return null;
    return {
      validate: (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? null : 'Sidetone must be a whole number from 0 to 100'),
      write: async (v) => void (await this.ask(hp.FEATURE.sidetone, 1, [v])),
      read: async () => hp.decodeSidetone(await this.ask(hp.FEATURE.sidetone, 0)),
    };
  }

  async onboardMode(): Promise<'onboard' | 'host' | null> {
    if (!(await this.feature(hp.FEATURE.onboardProfiles))) return null;
    return hp.decodeOnboardMode(await this.ask(hp.FEATURE.onboardProfiles, 2));
  }

  /** DPI values the sensor advertises (0x2202 preferred), or null when the device has no DPI feature. */
  async dpiOptions(): Promise<number[] | null> {
    if (await this.feature(hp.FEATURE.extendedDpi)) {
      const bytes: number[] = [];
      for (let page = 0; page < 32; page++) {
        bytes.push(...(await this.ask(hp.FEATURE.extendedDpi, 2, [0, 0, page])).subarray(6));
        if (bytes.some((v, i) => i > 0 && i % 2 === 1 && v === 0 && bytes[i - 1] === 0)) break;
      }
      return hp.decodeDpiList(bytes);
    }
    if (await this.feature(hp.FEATURE.dpi)) return hp.decodeDpiList(Array.from((await this.ask(hp.FEATURE.dpi, 1, [0])).subarray(4)));
    return null;
  }

  /** Sensor 0's DPI, X = Y; a reading with different axes is shown as unreadable. */
  dpi(options: number[]): Setting<number> {
    const extended = this.features.has(hp.FEATURE.extendedDpi);
    const parameters = async () => hp.decodeDpiParameters(await this.ask(hp.FEATURE.extendedDpi, 5, [0]));
    return {
      validate: (v) => (options.includes(v) ? null : `${v} DPI is not a value this sensor advertises`),
      write: async (v) => {
        if (!extended) return void (await this.ask(hp.FEATURE.dpi, 3, [0, v >> 8, v & 0xff]));
        const current = await parameters();
        if (!current) throw new Error('Could not read the current DPI parameters');
        await this.ask(hp.FEATURE.extendedDpi, 6, [0, v >> 8, v & 0xff, v >> 8, v & 0xff, current.lod]);
      },
      read: async () => {
        if (!extended) return hp.decodeLegacyDpi(await this.ask(hp.FEATURE.dpi, 2, [0]));
        const p = await parameters();
        return p && p.x === p.y ? p.x : null;
      },
    };
  }

  /** Report rates for this link (0x8061 preferred), or null when the device has no report-rate feature. */
  async rateOptions(wired: boolean): Promise<number[] | null> {
    if (await this.feature(hp.FEATURE.extendedReportRate)) {
      const conn = wired ? 0 : 1;
      const listed = hp.decodeRateMask(await this.ask(hp.FEATURE.extendedReportRate, 1, [conn]));
      if (wired || listed.some((hz) => hz > 1000)) return listed;
      // Some firmware keeps the wireless list on function 0 and answers function 1 with the cable's (OpenMouse).
      const capabilities = await this.ask(hp.FEATURE.extendedReportRate, 0, [conn]).then(hp.decodeRateMask, () => []);
      return capabilities.some((hz) => hz > 1000) ? capabilities : listed;
    }
    if (await this.feature(hp.FEATURE.reportRate)) return hp.decodeReportRateBitmap((await this.ask(hp.FEATURE.reportRate, 0))[3] ?? 0);
    return null;
  }

  reportRate(options: number[], wired: boolean): Setting<number> {
    const extended = this.features.has(hp.FEATURE.extendedReportRate);
    return {
      validate: (hz) => (options.includes(hz) ? null : `${hz} Hz is not a rate this link advertises`),
      write: async (hz) => {
        if (extended) await this.ask(hp.FEATURE.extendedReportRate, 3, [hp.REPORT_RATES.indexOf(hz as (typeof hp.REPORT_RATES)[number])]);
        else await this.ask(hp.FEATURE.reportRate, 2, [Math.round(1000 / hz)]);
      },
      read: async () =>
        extended
          ? hp.decodeRateCode(await this.ask(hp.FEATURE.extendedReportRate, 2, [wired ? 0 : 1]))
          : hp.decodeLegacyRate(await this.ask(hp.FEATURE.reportRate, 1)),
    };
  }
}
