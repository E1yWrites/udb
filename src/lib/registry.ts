// Types mirror registry/schema/device.schema.json. The schema is the authority;
// tests/registry.test.ts validates every entry against it.

export type Hex16 = `0x${string}`;
export type Category = 'mouse' | 'keyboard' | 'headset';
export type Connection = 'wired' | 'dongle' | 'bluetooth' | 'unknown';
export type FeatureStatus = 'detected' | 'read-verified' | 'write-verified' | 'experimental' | 'unsupported';
export type Location = 'device' | 'browser' | 'companion';

export interface Evidence {
  source: string;
  hardware: string | null;
  date: string;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface Identity {
  /** Absent on a `byCollection` identity, unless it is limited to one vendor. */
  vid?: Hex16;
  /** Absent only on a `byCollection` identity. */
  pid?: Hex16;
  /** Matches any device exposing one of the entry's collections: any VID (QMK/VIA) or any PID of `vid` (Logitech HID++). */
  byCollection?: true;
  connection: Connection;
  productName?: string;
  requireProductName?: boolean;
  protocolIdentity?: Record<string, number | null>;
  evidence?: Evidence[];
  notes?: string;
}

export interface Collection {
  interface?: number;
  usagePage: Hex16;
  usage: Hex16;
  reportIds?: number[];
  purpose: string;
}

export interface Feature {
  id: string;
  kind: 'range' | 'enum' | 'bool' | 'color' | 'keymap' | 'macro' | 'profile' | 'readonly';
  location: Location;
  constraints?: Record<string, unknown>;
  readBack?: boolean;
  status: FeatureStatus;
  evidence: Evidence[];
  notes?: string;
}

export interface DeviceEntry {
  id: string;
  vendor: string;
  model: string;
  category: Category;
  identities: Identity[];
  protocol: {
    family: string;
    doc: string;
    references: { title: string; url: string; license: string; use: 'code' | 'facts-only' }[];
    params?: { identify?: 'encryption' | 'cidmid' };
  };
  collections: { use: Collection[]; deny: Collection[] };
  platform: Record<'windows' | 'linux' | 'macos', { status: string; notes?: string }>;
  conflictingSoftware?: string[];
  limitations: string[];
  features: Feature[];
}

export const hex = (h: Hex16): number => parseInt(h, 16);

const modules = import.meta.glob<DeviceEntry>('/registry/devices/**/*.json', { eager: true, import: 'default' });

export const registry: DeviceEntry[] = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id));
