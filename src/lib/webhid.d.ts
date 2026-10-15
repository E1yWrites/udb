// Minimal WebHID declarations (https://wicg.github.io/webhid/), limited to what
// UDB uses. TypeScript's DOM lib does not ship them.

interface HIDReportItem {
  reportSize?: number;
  reportCount?: number;
}

interface HIDReportInfo {
  reportId?: number;
  items?: HIDReportItem[];
}

interface HIDCollectionInfo {
  usagePage?: number;
  usage?: number;
  type?: number;
  children?: HIDCollectionInfo[];
  inputReports?: HIDReportInfo[];
  outputReports?: HIDReportInfo[];
  featureReports?: HIDReportInfo[];
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  oninputreport: ((this: HIDDevice, ev: HIDInputReportEvent) => unknown) | null;
  open(): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (ev: HIDConnectionEvent) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (ev: HIDConnectionEvent) => void): void;
}

interface Navigator {
  /** Absent outside Chromium or outside a secure context. */
  readonly hid?: HID;
}
