// The byte log of each device for this page session (kept across reconnects).
// Panels hand it to their session, which pushes every report it sends and every
// reply it matches; the diagnostics view reads the same array. It holds protocol
// traffic only, never pointer or key input.

import type { LogEntry } from './transport.ts';

const logs = new Map<string, LogEntry[]>();

export function logFor(key: string): LogEntry[] {
  const known = logs.get(key);
  if (known) return known;
  const fresh = $state<LogEntry[]>([]);
  logs.set(key, fresh);
  return fresh;
}
