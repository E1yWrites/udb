// Fetches product images for registry entries into public/devices/ and writes
// registry/images.json with the provenance of each file (ADR 10). Run with
// `npm run import:images` while a Chromium runs with --remote-debugging-port
// (UDB_CDP, default http://127.0.0.1:9222); it is used only to resize, cut out
// and encode the images as WebP. The images are the vendors' own; see ADR 10.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const OUT = join(root, 'public/devices');
const CDP = process.env.UDB_CDP ?? 'http://127.0.0.1:9222';
const DATE = new Date().toISOString().slice(0, 10);
const MAX = 640;

type Entry = { id: string; vendor: string; model: string; identities: { vid: string; pid: string }[] };
type Source = { url: string; page: string; publisher: string };
type Match = 'model' | 'line';

const entries: Entry[] = readdirSync(join(root, 'registry/devices'), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(root, 'registry/devices', f), 'utf8')));

// Vendor CDNs reset connections now and then; retry the whole read.
async function get<T>(url: string, read: (r: Response) => Promise<T>): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await read(r);
    } catch (e) {
      if (n === 4 || String(e).match(/\b4\d\d\b/)) throw e;
      await new Promise((ok) => setTimeout(ok, 1000 * n));
    }
  }
}
const text = (url: string) => get(url, (r) => r.text());

// ATK HUB: the web app bundles product cutouts keyed "../assets/device/<cat>/<line>/<colour>.webp".
async function atkHub(): Promise<(key: string) => Source> {
  const html = await text('https://hub.atk.pro/');
  const js = await text(new URL(html.match(/src="([^"]*index-[^"]+\.js)"/)![1]!, 'https://hub.atk.pro/').href);
  const urls = new Map([...js.matchAll(/([\w$]+)="(https:\/\/bpcdn\.atkgear\.com\/hub-v3\/production\/[^"]+)"/g)].map((m) => [m[1], m[2]]));
  const map = new Map([...js.matchAll(/"\.\.\/assets\/device\/([^"]+)":([\w$]+)/g)].map((m) => [m[1], urls.get(m[2])]));
  const version = [...urls.values()][0]?.match(/production\/([\d.]+)\//)?.[1] ?? 'unknown';
  return (key) => {
    const url = map.get(key);
    if (!url) throw new Error(`ATK HUB has no image ${key}`);
    return { url, page: 'https://hub.atk.pro/', publisher: `ATK HUB ${version} web app` };
  };
}

// OpenRazer lists Razer's own product image per USB PID (DEVICE_IMAGE).
async function openRazer(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const f of ['mouse', 'keyboards', 'mouse_mat', 'headsets', 'accessory']) {
    const py = await text(`https://raw.githubusercontent.com/openrazer/openrazer/master/daemon/openrazer_daemon/hardware/${f}.py`).catch(() => '');
    for (const cls of py.split(/\nclass /)) {
      const pid = cls.match(/USB_PID\s*=\s*(0x[0-9a-fA-F]+)/)?.[1];
      const img = cls.match(/DEVICE_IMAGE\s*=\s*"([^"]+)"/)?.[1];
      if (pid && img) out.set(parseInt(pid, 16), img);
    }
  }
  return out;
}

// Shopify stores publish /products/<handle>.json; take the image named by `view`, else a top view, else the first.
async function shop(host: string, handle: string, view?: string): Promise<Source> {
  const p = JSON.parse(await text(`https://${host}/products/${handle}.json`)).product;
  const has = (re: RegExp) => p.images.find((i: { src: string }) => re.test(i.src.split('?')[0]!.split('/').pop()!));
  const img = (view && has(new RegExp(view, 'i'))) || has(/top/i) || p.images[0];
  return { url: img.src.split('?')[0], page: `https://${host}/products/${handle}`, publisher: `${host} store` };
}

type Rule = [vendorDir: string, model: RegExp, src: string, match: Match];
// First matching rule wins. "line" means the image shows the same shell or product line, not this exact variant.
const RULES: Rule[] = [
  ['pulsar', /X2 CrazyLight Mini.*Bruce Lee/, 'shop:pulsar.gg/x2-crazylight-brucelee85th-mini', 'model'],
  ['mechlands', /^Vibe75$/, 'shop:mechlands.com/mechlands-vibe75-v2', 'line'],
  ['atk', /JOJO/, 'hub:mouse/f1-pro-max/jotaro-kujo.webp', 'model'],
  ['atk', /Elden/, 'hub:mouse/f1-pro-max/tarnished.webp', 'model'],
  ['atk', /F1 MOBA/i, 'hub:mouse/f1-moba/black.webp', 'model'],
  ['atk', /F1.*PRO MAX/i, 'hub:mouse/f1-pro-max/black.webp', 'line'],
  ['atk', /LEVIATAN/i, 'hub:mouse/f1/lev.webp', 'line'],
  ['atk', /F1.*Ultimate/i, 'hub:mouse/f1/black-ultimate.webp', 'line'],
  ['atk', /F1/i, 'hub:mouse/f1/black.webp', 'line'],
  ['atk', /^A9 X$/, 'hub:mouse/a9/a9-x-black.webp', 'model'],
  ['atk', /^A9/, 'hub:mouse/a9/black.webp', 'line'],
  ['atk', /Duckbill/i, 'hub:mouse/duck-bill/purple.webp', 'line'],
  ['atk', /FIERCE X/i, 'hub:mouse/fierce-x/black.webp', 'model'],
  ['atk', /MAD R MAJOR/i, 'hub:mouse/mad-r/black-major.webp', 'line'],
  ['atk', /MAD R/i, 'hub:mouse/mad-r/black.webp', 'line'],
  ['atk', /^U2/i, 'hub:mouse/u2/black.webp', 'line'],
  ['atk', /^X1/i, 'hub:mouse/x1/black.webp', 'line'],
  ['atk', /^Z1/i, 'hub:mouse/z1/black.webp', 'line'],
  ['atk', /^Y9/i, 'shop:atk.store/atk-dragonfly-y9-series-lightweight-ergonomic-wireless-mouse', 'line'],
  ['atk', /^Ghost/i, 'shop:atk.store/atk-blazing-sky-ghost-hollow-carbon-fiber-wireless-gaming-mouse', 'line'],
  ['atk', /^ZERO/i, 'shop:atk.store/atk-blazing-sky-zero-ultralight-wireless-gaming-mouse', 'line'],
  ['atk', /PHANTOM/i, 'shop:atk.store/atk-blazing-sky-phantom-hollow-carbon-fiber-composite-wireless-gaming-mouse', 'line'],
  ['vxe', /^R1/i, 'hub:mouse/r1/black.webp', 'line'],
  ['vxe', /^V3/i, 'shop:vxe.com/vxe-dragonfly-v3-series-lightweight-wireless-mouse', 'line'],
  ['vxe', /^X3/i, 'shop:vxe.com/vxe-dragonfly-x3-series-lightweight-wireless-mouse', 'line'],
  ['glorious', /^Model D 2 PRO 4K\/8K/, 'shop:www.gloriousgaming.com/model-d-2-pro-wireless-mouse-4k8k', 'model'],
  ['glorious', /^Model D 2 PRO/, 'shop:www.gloriousgaming.com/model-d-2-pro-wireless-mouse', 'model'],
  ['glorious', /^Model D-? 2 Wired/, 'shop:www.gloriousgaming.com/model-d-2-wired-mouse', 'line'],
  ['glorious', /^Model D 2 Wireless/, 'shop:www.gloriousgaming.com/model-d-2-wireless-mouse', 'model'],
  ['glorious', /^Model I 2 Wired/, 'shop:www.gloriousgaming.com/model-i-2-wired-mouse', 'model'],
  ['glorious', /^Model I 2/, 'shop:www.gloriousgaming.com/model-i-2-wireless-mouse', 'model'],
  ['glorious', /^Model O 2 Mini Wired/, 'shop:www.gloriousgaming.com/model-o-2-mini-wired-mouse#_Front', 'model'],
  ['glorious', /^Model O 2 Mini Wireless/, 'shop:www.gloriousgaming.com/model-o-2-mini-wireless-mouse', 'model'],
  ['glorious', /^Model O 2 PRO 4K\/8K/, 'shop:www.gloriousgaming.com/model-o-2-pro-wireless-mouse-4k-8khz', 'model'],
  ['glorious', /^Model O 2 PRO/, 'shop:www.gloriousgaming.com/model-o-2-pro-wireless-mouse-1k', 'model'],
  ['glorious', /^Model O 2 Wireless/, 'shop:www.gloriousgaming.com/model-o-2-wireless-mouse', 'model'],
  ['glorious', /^Model O3 Wireless/, 'shop:www.gloriousgaming.com/model-o-3-wireless-mouse', 'model'],
  ['glorious', /^Series 2 PRO/, 'shop:www.gloriousgaming.com/series-2-pro-wireless-mouse', 'model'],
  ['glorious', /^Model O(-| Wireless| Pro| V2)/, 'shop:www.gloriousgaming.com/model-o-classic-wireless-mouse', 'line'],
];

// Resize to fit MAX, cut out a flat light background seen at all four corners, trim, and encode WebP.
const PROCESS = `async (dataUrl, max) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), p = d.data;
  const at = (i) => [p[i * 4], p[i * 4 + 1], p[i * 4 + 2], p[i * 4 + 3]];
  // Sample just inside the corners: some sources wrap an opaque backdrop in a thin transparent border.
  const m = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const corners = [m * w + m, m * w + w - 1 - m, (h - 1 - m) * w + m, (h - m) * w - 1 - m].map(at);
  const flat = corners.every((k) => k[3] === 255 && Math.min(k[0], k[1], k[2]) > 225 && Math.max(...k.slice(0, 3)) - Math.min(...k.slice(0, 3)) < 12);
  let cutout = false;
  if (flat) {
    const bg = [0, 1, 2].map((j) => corners.reduce((a, k) => a + k[j], 0) / 4);
    // Follow soft gradients: a pixel joins the background if it is light and close to the neighbour it was reached from.
    const diff = (i, j) => Math.abs(p[i * 4] - p[j * 4]) + Math.abs(p[i * 4 + 1] - p[j * 4 + 1]) + Math.abs(p[i * 4 + 2] - p[j * 4 + 2]);
    const light = (i) => Math.min(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]) > bg.reduce((a, v) => Math.min(a, v)) - 40;
    const seen = new Uint8Array(w * h), stack = [];
    for (let i = 0; i < w; i++) stack.push(i, i, (h - 1) * w + i, (h - 1) * w + i);
    for (let j = 0; j < h; j++) stack.push(j * w, j * w, j * w + w - 1, j * w + w - 1);
    while (stack.length) {
      const from = stack.pop(), i = stack.pop();
      const clear = p[i * 4 + 3] < 10;
      if (seen[i] || !(clear || (light(i) && (p[from * 4 + 3] < 10 || diff(i, from) <= 9)))) continue;
      seen[i] = 1;
      const cx = i % w;
      if (cx > 0) stack.push(i - 1, i); if (cx < w - 1) stack.push(i + 1, i);
      if (i >= w) stack.push(i - w, i); if (i < w * (h - 1)) stack.push(i + w, i);
    }
    for (let i = 0; i < w * h; i++) if (seen[i]) p[i * 4 + 3] = 0;
    cutout = true;
  }
  // Drop detached specks (size labels, captions): opaque blobs under 2% of the largest one.
  const label = new Int32Array(w * h).fill(-1), areas = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (label[s0] >= 0 || p[s0 * 4 + 3] <= 8) continue;
    const n = areas.length, st = [s0]; let a = 0; label[s0] = n;
    while (st.length) {
      const i = st.pop(); a++;
      const cx = i % w;
      for (const j of [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && label[j] < 0 && p[j * 4 + 3] > 8) { label[j] = n; st.push(j); }
    }
    areas.push(a);
  }
  const big = Math.max(0, ...areas);
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && areas[label[i]] < big * 0.02) p[i * 4 + 3] = 0;
  x.putImageData(d, 0, 0);
  // A cutout leaves a good share of the frame empty; a boxed photo leaves almost none.
  let clearPx = 0;
  for (let i = 3; i < p.length; i += 4) if (p[i] < 10) clearPx++;
  const transparent = clearPx / (w * h) > 0.12;
  let t = h, l = w, b = 0, r = 0;
  for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) if (p[(y * w + k) * 4 + 3] > 8) { t = Math.min(t, y); b = Math.max(b, y); l = Math.min(l, k); r = Math.max(r, k); }
  const o = new OffscreenCanvas(r - l + 1, b - t + 1);
  o.getContext('2d').drawImage(c, l, t, r - l + 1, b - t + 1, 0, 0, r - l + 1, b - t + 1);
  const blob = await o.convertToBlob({ type: 'image/webp', quality: 0.86 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (const v of bytes) bin += String.fromCharCode(v);
  return { webp: btoa(bin), width: o.width, height: o.height, cutout, transparent };
}`;

async function browser() {
  const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = fail)));
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    pending.get(m.id)?.(m);
  };
  const call = (method: string, params: object) =>
    new Promise<any>((ok) => {
      pending.set(++id, ok);
      ws.send(JSON.stringify({ id, method, params }));
    });
  return {
    async process(bytes: Buffer, type: string) {
      const expr = `(${PROCESS})(${JSON.stringify(`data:${type};base64,${bytes.toString('base64')}`)}, ${MAX})`;
      const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result.result.value as { webp: string; width: number; height: number; cutout: boolean; transparent: boolean };
    },
    close: async () => {
      ws.close();
      await fetch(`${CDP}/json/close/${target.id}`);
    },
  };
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const fileName = (url: string) =>
  `${sha(Buffer.from(url)).slice(0, 10)}-${url.split('/').pop()!.replace(/\.\w+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.webp`;

const hub = await atkHub();
const razer = await openRazer();
const shopCache = new Map<string, Source>();
async function resolve(src: string): Promise<Source> {
  if (src.startsWith('hub:')) return hub(src.slice(4));
  if (!shopCache.has(src)) {
    const [host, rest] = src.slice(5).split('/') as [string, string];
    const [handle, view] = rest.split('#') as [string, string?];
    shopCache.set(src, await shop(host, handle, view));
  }
  return shopCache.get(src)!;
}

const devices: Record<string, { file: string; match: Match }> = {};
const sources = new Map<string, Source>();
for (const e of entries) {
  const dir = e.id.split('/')[0];
  let src: Source | undefined, match: Match = 'model';
  if (dir === 'razer') {
    const url = e.identities.map((i) => razer.get(parseInt(i.pid, 16))).find(Boolean);
    if (url) src = { url, page: 'https://github.com/openrazer/openrazer (DEVICE_IMAGE)', publisher: 'Razer, linked by OpenRazer' };
  } else {
    const rule = RULES.find(([v, re]) => v === dir && re.test(e.model));
    if (rule) [src, match] = [await resolve(rule[2]), rule[3]];
  }
  if (!src) continue;
  devices[e.id] = { file: fileName(src.url), match };
  sources.set(fileName(src.url), src);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const chrome = await browser();
const images: Record<string, object> = {};
for (const [file, src] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
  const got = await get(src.url, async (r) => ({ bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? 'image/png' })).catch(
    (e) => (console.warn(`skip ${src.url}: ${e}`), null),
  );
  const out = got && (await chrome.process(got.bytes, got.type));
  // Only cutouts ship; a photo on a scene or a dark backdrop would sit in a box on the stage.
  if (!got || !out?.transparent) {
    if (out) console.warn(`skip ${src.url}: no transparent background`);
    for (const [id, d] of Object.entries(devices)) if (d.file === file) delete devices[id];
    continue;
  }
  const { bytes } = got;
  const webp = Buffer.from(out.webp, 'base64');
  writeFileSync(join(OUT, file), webp);
  images[file] = { ...src, retrieved: DATE, sourceSha256: sha(bytes), sha256: sha(webp), width: out.width, height: out.height, cutout: out.cutout ? 'auto' : 'source' };
}
await chrome.close();

const sorted = Object.fromEntries(Object.entries(devices).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(root, 'registry/images.json'), JSON.stringify({ note: 'Generated by scripts/import-images.ts. Vendor images, used by owner decision (ADR 10). match "line": same shell or product line, not this exact variant.', images, devices: sorted }, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} of ${entries.length} entries have an image; ${Object.keys(images).length} files`);
