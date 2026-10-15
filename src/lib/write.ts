// The one write procedure (SPEC.md): validate → send → read back → compare,
// restoring the previous value on mismatch. Every adapter setting goes through it.

export interface Setting<T> {
  validate(value: T): string | null;
  write(value: T): Promise<void>;
  /** Reads the value from the device. Null if the device returned something undecodable. */
  read(): Promise<T | null>;
  /** Value equality for non-primitive settings (e.g. a DPI stage's X and Y). Defaults to ===. */
  equals?(a: T, b: T): boolean;
}

export type WriteResult<T> =
  | { kind: 'confirmed'; value: T }
  | { kind: 'invalid'; reason: string }
  | { kind: 'mismatch'; requested: T; actual: T | null; restored: T | null; restoreConfirmed: boolean }
  | { kind: 'failed'; error: string; actual: T | null };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function tryRead<T>(s: Setting<T>): Promise<T | null> {
  try {
    return await s.read();
  } catch {
    return null;
  }
}

export async function applySetting<T>(s: Setting<T>, requested: T, previous: T): Promise<WriteResult<T>> {
  const same = (a: T | null, b: T) => a !== null && (s.equals ? s.equals(a, b) : a === b);
  const reason = s.validate(requested);
  if (reason) return { kind: 'invalid', reason };
  try {
    await s.write(requested);
  } catch (e) {
    return { kind: 'failed', error: message(e), actual: await tryRead(s) };
  }
  let actual: T | null;
  try {
    actual = await s.read();
  } catch (e) {
    return { kind: 'failed', error: `Read-back failed: ${message(e)}`, actual: null };
  }
  if (same(actual, requested)) return { kind: 'confirmed', value: actual! };

  // Mismatch: put the previous value back and report what the device says now.
  let restored: T | null = null;
  try {
    await s.write(previous);
    restored = await s.read();
  } catch {
    restored = await tryRead(s);
  }
  return { kind: 'mismatch', requested, actual, restored, restoreConfirmed: same(restored, previous) };
}
