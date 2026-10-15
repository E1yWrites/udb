import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as v from '../src/adapters/vibe75.ts';
import { Vibe75Session } from '../src/adapters/vibe75-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected } from '../src/lib/transport.ts';

const payload = (...bytes: number[]) => {
  const b = new Uint8Array(v.PAYLOAD);
  b.set(bytes);
  return b;
};
const bytes = (hex: string) => Uint8Array.from(hex.split(' '), (h) => parseInt(h, 16));
const fx = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/vibe75-2026-10-15.json'), 'utf8')) as {
  exchanges: { op: string; tx: string; rx: string }[];
  delayedBlock: { tx: string; rx: string[] };
  write: { frames: { tx: string; rx?: string }[]; readBack: string };
};
const realBlock = bytes(fx.delayedBlock.rx[1]!);

/**
 * Simulates the observed behaviour: `04 12 p` → first GET echoes with status
 * 01 (block pending) or FF (empty), later GETs return the block. The vendor's
 * write sequence stores the block. Simulator results are not hardware evidence.
 */
class Vibe75Sim {
  opened = true;
  readonly collections = [{ usagePage: 0xff13, usage: 0x0001, featureReports: [{ reportId: 0 }] }];
  readonly sent: Uint8Array[] = [];
  blocks: (Uint8Array | null)[] = [realBlock.slice(), null, null, null, null];
  ignoreWrites = false;
  /** Added to the acknowledged sum, to simulate a block corrupted in transit. */
  corruptSum = 0;
  private queue: Uint8Array[] = [];
  private pendingBlock: Uint8Array | null = null;
  private listeners = new Set<(e: Event) => void>();

  addEventListener(_t: string, l: (e: Event) => void) {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: (e: Event) => void) {
    this.listeners.delete(l);
  }
  async sendReport() {
    throw new Error('vibe75 uses feature reports');
  }
  async sendFeatureReport(_id: number, data: BufferSource) {
    const b = new Uint8Array(data as ArrayBuffer).slice();
    this.sent.push(b);
    if (b[0] === 0x04 && b[1] === 0x12) {
      const block = this.blocks[b[2]!] ?? null;
      this.queue = [payload(0x04, 0x12, b[2]!, block ? 0x01 : 0xff)];
      if (block) this.queue.push(block.slice());
    } else if (b[14] === 0xaa && b[15] === 0x55) {
      this.pendingBlock = b;
      this.queue = [];
    } else {
      const sum = b[1] === 0x02 && this.pendingBlock ? v.blockSum(this.pendingBlock) + this.corruptSum : 0;
      this.queue = [payload(b[0]!, b[1]!, 0, 0x01, sum & 0xff, sum >> 8)];
      if (b[1] === 0x02 && this.pendingBlock && !this.ignoreWrites) this.blocks[this.pendingBlock[8]!] = this.pendingBlock;
    }
  }
  async receiveFeatureReport(): Promise<DataView> {
    const next = this.queue.length > 1 ? this.queue.shift()! : (this.queue[0] ?? payload());
    return new DataView(next.slice().buffer);
  }
}

describe('vibe75 framing and the real block', () => {
  it('decodes the owner keyboard block and re-encodes it to the same bytes', () => {
    const block = v.decodeLighting(realBlock)!;
    expect(block).toEqual({ mode: 5, color: [0xff, 0xc6, 0xaa], profile: 0, brightness: 5, speed: 1, byte11: 0 });
    expect(v.lightingBlock(block).data).toEqual(realBlock);
    expect(v.allow(v.lightingBlock(block))).toBe(true);
  });

  it('classifies read replies', () => {
    expect(v.replyState(bytes(fx.delayedBlock.rx[0]!), 0)).toBe('pending');
    expect(v.replyState(realBlock, 0)).toBe('block');
    expect(v.replyState(bytes(fx.exchanges[2]!.rx), 2)).toBe('empty');
  });

  it('builds the vendor write frames', () => {
    expect(v.begin().data).toEqual(payload(0x04, 0x18));
    expect(v.lightingHeader().data).toEqual(payload(0x04, 0x13, 0, 0, 0, 0, 0, 0, 1));
    expect(v.end().data).toEqual(payload(0x04, 0x02));
    expect(v.finish().data).toEqual(payload(0x04, 0xf0));
  });
});

describe('vibe75 allowlist', () => {
  it('allows the read, the five write frames and GET_FEATURE', () => {
    for (const r of [v.readLighting(0), v.readLighting(4), v.begin(), v.lightingHeader(), v.end(), v.finish()]) expect(v.allow(r)).toBe(true);
    expect(v.allow({ type: 'feature-read', reportId: 0, data: new Uint8Array() })).toBe(true);
  });

  const block = (patch: Record<number, number>) => {
    const b = realBlock.slice();
    for (const [i, x] of Object.entries(patch)) b[Number(i)] = x;
    return b;
  };

  it.each([
    ['INIT/reset (01)', payload(0x01)],
    ['system settings (04 17)', payload(0x04, 0x17, 1, 0, 0, 0, 0, 0, 1)],
    ['key table (04 20)', payload(0x04, 0x20, 0, 0, 0, 0, 0, 0, 3)],
    ['macro (04 15)', payload(0x04, 0x15)],
    ['LCD upload (04 72)', payload(0x04, 0x72)],
    ['header announcing 2 packets', payload(0x04, 0x13, 0, 0, 0, 0, 0, 0, 2)],
    ['profile 5 read', payload(0x04, 0x12, 5)],
    ['begin with trailing bytes', payload(0x04, 0x18, 1)],
    ['block with brightness 6', block({ 9: 6 })],
    ['block with speed 6', block({ 10: 6 })],
    ['block without the AA 55 signature', block({ 15: 0x56 })],
    ['block with data in the reserved gap', block({ 5: 1 })],
    ['block with trailing data', block({ 20: 1 })],
  ])('refuses %s', (_name, data) => {
    expect(v.allow({ type: 'feature', reportId: 0, data })).toBe(false);
  });

  it('refuses output reports and other report IDs', () => {
    expect(v.allow({ type: 'output', reportId: 0, data: payload(0x04, 0x12, 1) })).toBe(false);
    expect(v.allow({ type: 'feature', reportId: 1, data: payload(0x04, 0x12, 1) })).toBe(false);
  });
});

describe('vibe75 session (simulator, not hardware evidence)', () => {
  it('polls past the pending echo to the block, and reports empty profiles', async () => {
    const s = new Vibe75Session(new Vibe75Sim(), []);
    expect((await s.readLighting(0)).block).toMatchObject({ mode: 5, brightness: 5 });
    expect((await s.readLighting(3)).block).toBeNull();
  });

  it('writes brightness with the vendor sequence and confirms by read-back, other fields untouched', async () => {
    const sim = new Vibe75Sim();
    const s = new Vibe75Session(sim, []);
    const base = (await s.readLighting(0)).block!;
    expect(await applySetting(s.brightness(base), 4, 5)).toEqual({ kind: 'confirmed', value: 4 });
    expect(v.decodeLighting(sim.blocks[0]!)).toEqual({ ...base, brightness: 4 });
    const writes = sim.sent.filter((b) => !(b[0] === 0x04 && b[1] === 0x12)).map((b) => [b[0], b[1]]);
    expect(writes).toEqual([[0x04, 0x18], [0x04, 0x13], [0x05, 0xff], [0x04, 0x02], [0x04, 0xf0]]);
  });

  it('reports a mismatch when the keyboard keeps the old block', async () => {
    const sim = new Vibe75Sim();
    sim.ignoreWrites = true;
    const s = new Vibe75Session(sim, []);
    const base = (await s.readLighting(0)).block!;
    expect(await applySetting(s.brightness(base), 4, 5)).toMatchObject({ kind: 'mismatch', actual: 5, restored: 5, restoreConfirmed: true });
  });

  it('fails the write when the keyboard acknowledges a different block sum', async () => {
    const sim = new Vibe75Sim();
    sim.corruptSum = 1;
    const s = new Vibe75Session(sim, []);
    const base = (await s.readLighting(0)).block!;
    expect(await applySetting(s.brightness(base), 4, 5)).toMatchObject({ kind: 'failed', error: expect.stringMatching(/summing/) });
  });

  it('refuses out-of-range brightness before sending', async () => {
    const sim = new Vibe75Sim();
    const s = new Vibe75Session(sim, []);
    const base = (await s.readLighting(0)).block!;
    const before = sim.sent.length;
    expect(await applySetting(s.brightness(base), 0, 5)).toMatchObject({ kind: 'invalid' });
    expect(await applySetting(s.brightness(base), 6, 5)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(before);
  });

  it('extended probe sends one read, then only GET_FEATUREs', async () => {
    const sim = new Vibe75Sim();
    const s = new Vibe75Session(sim, []);
    await s.extendedProbe(0);
    expect(sim.sent).toHaveLength(1);
    expect(s.log.filter((e) => e.dir === 'rx')).toHaveLength(4);
  });

  it('cannot reach a denied collection', async () => {
    const sim = new Vibe75Sim();
    await expect(new Vibe75Session(sim, [{ usagePage: 0xff13, usage: 0x0001 }]).readLighting(0)).rejects.toBeInstanceOf(TransportRejected);
    expect(sim.sent).toHaveLength(0);
  });
});

describe('vibe75 replay: owner hardware, 2026-10-15', () => {
  it('session 3: the vendor write sequence, its acknowledgements and the read-back', () => {
    const w = fx.write;
    const sent = w.frames.map((f) => bytes(f.tx));
    expect(sent[0]).toEqual(v.begin().data);
    expect(sent[1]).toEqual(v.lightingHeader().data);
    const block = { ...v.decodeLighting(realBlock)!, brightness: 3 };
    expect(sent[2]).toEqual(v.lightingBlock(block).data);
    expect(sent[3]).toEqual(v.end().data);
    expect(sent[4]).toEqual(v.finish().data);
    for (const f of sent) expect(v.allow({ type: 'feature', reportId: 0, data: f })).toBe(true);
    expect(v.ackSum(bytes(w.frames[3]!.rx!))).toBe(v.blockSum(sent[2]!));
    expect(v.decodeLighting(bytes(w.readBack))?.brightness).toBe(3);
  });

  it('reproduces the captured read requests; first replies are echoes without a block', () => {
    fx.exchanges.forEach((e, p) => {
      expect(v.readLighting(p).data).toEqual(bytes(e.tx));
      expect(v.decodeLighting(bytes(e.rx))).toBeNull();
    });
  });
});
