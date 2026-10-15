import type { FeatureStatus, Location } from './registry.ts';
import type { IconName } from '../ui/Icon.svelte';

const FEATURE_LABELS: Record<string, string> = {
  'polling-rate': 'Polling rate',
  'dpi.stages': 'DPI stages',
  'dpi.current-stage': 'Active DPI stage',
  'lift-off-distance': 'Lift-off distance',
  'debounce-ms': 'Debounce',
  battery: 'Battery',
  'lighting.per-key': 'Per-key lighting',
  'lighting.lamparray': 'Lighting (Dynamic Lighting)',
  keymap: 'Key mapping',
  'screen-image': 'Screen image',
  sidetone: 'Sidetone',
  'inactive-time-min': 'Auto power-off',
  'eq.software': 'Software EQ',
};

export const featureLabel = (id: string) =>
  FEATURE_LABELS[id] ?? id.replace(/[.-]/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const STATUS: Record<FeatureStatus, { word: string; icon: IconName; tone: 'confirmed' | 'signal' | 'muted' }> = {
  'write-verified': { word: 'Verified', icon: 'check', tone: 'confirmed' },
  'read-verified': { word: 'Read verified', icon: 'check', tone: 'confirmed' },
  detected: { word: 'Detected', icon: 'check', tone: 'muted' },
  experimental: { word: 'Unverified', icon: 'unverified', tone: 'signal' },
  unsupported: { word: 'Not supported', icon: 'blocked', tone: 'muted' },
};

export const LOCATION: Record<Location, string> = {
  device: 'Device',
  browser: 'Browser',
  companion: 'Companion',
};

export const CONNECTION_ICON = { wired: 'wired', dongle: 'dongle', bluetooth: 'bluetooth' } as const satisfies Record<string, IconName>;

export const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
