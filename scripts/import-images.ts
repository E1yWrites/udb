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

// Vendor product pages (no product JSON): headless Chromium loads the page, and a
// per-site picker takes the gallery image and asks the CDN for the full-size original.
// `related`: the page also shows other products (navigation, cross-sells), so the image name must
// carry the product's own model tokens from the page URL.
// `product`: take the page's own JSON-LD Product images instead of everything it shows.
const PAGES: { host: RegExp; pick: RegExp; full: (u: string) => string; publisher: string; related?: boolean; product?: boolean }[] = [
  {
    host: /(^|\.)logitech\.com$/,
    pick: /resource\.logitech\.com\/.*\.png/,
    full: (u) => u.replace(/^(https:\/\/resource\.logitech\.com)\/.*?\/(content\/dam\/)/, '$1/$2'),
    publisher: 'Logitech product page',
    product: true,
  },
  {
    host: /(^|\.)steelseries\.com$/,
    pick: /images\.ctfassets\.net\/.*(img_buy_0?1|buyimg_?0?1)/i,
    full: (u) => `${u.split('?')[0]}?fm=png&w=1400`,
    publisher: 'SteelSeries product page',
    related: true,
  },
  {
    host: /^rog\.asus\.com$/,
    pick: /dlcdnwebimgs\.asus\.com\/gain\//,
    full: (u) => u.replace(/\/w\d+\/h\d+$/, '/w1000/h1000'),
    publisher: 'ROG product gallery',
  },
  {
    host: /(^|\.)wooting\.io$/,
    pick: /Prebuilt_Angle_View|front-view(-main)?\.webp|ANSI_Main\.webp/i,
    full: (u) => new URL(u).searchParams.get('url') ?? u,
    publisher: 'Wooting product page',
  },
  {
    host: /(^|\.)corsair\.com$/,
    pick: /res\.cloudinary\.com\/corsair-pwa\/.*\/Gallery\/.*_0?1\.(png|jpe?g)/i,
    full: (u) => u.replace(/\/c_scale[^/]*\//, '/c_scale,w_1400/'),
    publisher: 'Corsair product page',
  },
];

const GENERIC = new Set(['gaming', 'mouse', 'mice', 'wireless', 'wired', 'keyboard', 'headset', 'refurbished', 'business', 'mechanical', 'rgb', 'lightspeed', 'for', 'and', 'the', 'with', 'shop', 'en', 'us', 'p', 'gaming-mice', 'gaming-headsets']);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !GENERIC.has(t));

/** The image name carries the page's model tokens: every one with a digit (g502, 3s, 750), else at least half. */
function related(image: string, pageUrl: string): boolean {
  const slug = new URL(pageUrl).pathname.split('/').pop()!;
  const name = decodeURIComponent(new URL(image).pathname.split('/').pop()!);
  // A page for a headset never takes an image named for a mouse, and so on.
  const kinds = (s: string) => ['headset', 'keyboard', 'mouse'].filter((k) => s.toLowerCase().includes(k));
  if (kinds(slug).length && kinds(name).length && !kinds(name).some((k) => kinds(slug).includes(k))) return false;
  const want = tokens(slug);
  const have = new Set(tokens(name));
  const strong = want.filter((t) => /\d/.test(t) && /[a-z]/.test(t) || /^\d{3,}$/.test(t));
  if (strong.length) return strong.every((t) => have.has(t));
  return want.filter((t) => have.has(t)).length * 2 >= want.length && want.length > 0;
}

// Every image URL the page loaded or references: <img>, srcset, og:image and network entries.
const PAGE_IMAGES = `(async () => {
  for (const y of [600, 1400, 0]) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 1200)); }
  const out = [];
  const add = (u) => { try { if (u) out.push(new URL(u, location.href).href); } catch {} };
  document.querySelectorAll('img').forEach((i) => { add(i.currentSrc || i.src); (i.srcset || '').split(',').forEach((x) => add(x.trim().split(' ')[0])); });
  document.querySelectorAll('source').forEach((x) => (x.srcset || '').split(',').forEach((y) => add(y.trim().split(' ')[0])));
  add(document.querySelector('meta[property="og:image"]')?.content);
  performance.getEntriesByType('resource').forEach((e) => add(e.name));
  const product = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((x) => {
    try { [JSON.parse(x.textContent)].flat().filter((j) => /Product/.test(j['@type'])).forEach((j) => [j.image].flat().forEach((i) => i && product.push(typeof i === 'string' ? i : i.url))); } catch {}
  });
  return { all: [...new Set(out)], product };
})()`;

async function page(url: string): Promise<Source> {
  const site = PAGES.find((p) => p.host.test(new URL(url).hostname));
  if (!site) throw new Error(`no picker for ${url}`);
  const tab = await cdpTab();
  try {
    await tab.call('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
    await tab.call('Page.enable', {});
    await tab.call('Page.navigate', { url });
    await new Promise((ok) => setTimeout(ok, 8000));
    const r = await tab.call('Runtime.evaluate', { expression: PAGE_IMAGES, awaitPromise: true, returnByValue: true });
    const seen = r.result.result.value as { all: string[]; product: string[] };
    const found = (site.product ? seen.product : seen.all).find((u) => site.pick.test(u) && (!site.related || related(u, url)));
    if (!found) throw new Error(`no product image on ${url}`);
    return { url: site.full(found), page: url, publisher: site.publisher };
  } finally {
    await tab.close();
  }
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
  ['logitech', /^G PRO 2 LIGHTSPEED$/, 'page:https://www.logitech.com/en-us/shop/p/pro-2-lightspeed', 'model'],
  ['logitech', /^G PRO Keyboard$/, 'page:https://www.logitech.com/en-us/shop/p/pro-mechanical-gaming-keyboard', 'model'],
  ['logitech', /^G PRO X 2 headset$/, 'page:https://www.logitech.com/en-us/shop/p/pro-x-2-wireless-headset', 'model'],
  ['logitech', /^G PRO X headset$/, 'page:https://www.logitech.com/en-us/shop/p/pro-x-gaming-headset-blue-voice-mic-tech', 'model'],
  ['logitech', /^G Pro X Wireless Superlight$/, 'page:https://www.logitech.com/en-us/shop/p/pro-x-superlight-wireless-mouse', 'model'],
  ['logitech', /^G102 LIGHTSYNC$|^Gaming Mouse G102\/G103\/G203$/, 'page:https://www.logitech.com/en-us/shop/p/g203-lightsync-rgb-gaming-mouse', 'line'],
  ['logitech', /^G403 Hero$/, 'page:https://www.logitech.com/en-us/shop/p/g403-hero-gaming-mouse', 'model'],
  ['logitech', /^G403/, 'page:https://www.logitech.com/en-us/shop/p/g403-hero-gaming-mouse', 'line'],
  ['logitech', /^G413$/, 'page:https://www.logitech.com/en-us/shop/p/g413-se-gaming-keyboard', 'line'],
  ['logitech', /^G432 headset$/, 'page:https://www.logitech.com/en-us/shop/p/g432-7-1-surround-sound-gaming-headset', 'model'],
  ['logitech', /^G431 headset$/, 'page:https://www.logitech.com/en-us/shop/p/g432-7-1-surround-sound-gaming-headset', 'line'],
  ['logitech', /^G502 Hero$/, 'page:https://www.logitech.com/en-us/shop/p/g502-hero-gaming-mouse', 'model'],
  ['logitech', /^G502 Hero Wireless$/, 'page:https://www.logitech.com/en-us/shop/p/g502-lightspeed-wireless-gaming-mouse', 'model'],
  ['logitech', /^G502 Proteus/, 'page:https://www.logitech.com/en-us/shop/p/g502-hero-gaming-mouse', 'line'],
  ['logitech', /^G502 X$/, 'page:https://www.logitech.com/en-us/shop/p/g502-x-wired-lightforce', 'model'],
  ['logitech', /^G502 X PLUS$/, 'page:https://www.logitech.com/en-us/shop/p/g502-x-plus-wireless-lightforce', 'model'],
  ['logitech', /^G502 X Wireless$/, 'page:https://www.logitech.com/en-us/shop/p/g502-x-wireless-lightforce', 'model'],
  ['logitech', /^G513$/, 'page:https://www.logitech.com/en-us/shop/p/g512-mechanical-gaming-keyboard', 'line'],
  ['logitech', /^G703 Hero$/, 'page:https://www.logitech.com/en-us/shop/p/g703-hero-wireless-gaming-mouse', 'model'],
  ['logitech', /^G703$/, 'page:https://www.logitech.com/en-us/shop/p/g703-hero-wireless-gaming-mouse', 'line'],
  ['logitech', /^G733 headset$/, 'page:https://www.logitech.com/en-us/shop/p/g733-rgb-wireless-headset', 'model'],
  ['logitech', /^G903 Hero$/, 'page:https://www.logitech.com/en-us/shop/p/g903-hero-wireless-gaming-mouse', 'model'],
  ['logitech', /^G90[03]$/, 'page:https://www.logitech.com/en-us/shop/p/g903-hero-wireless-gaming-mouse', 'line'],
  ['logitech', /^G915$/, 'page:https://www.logitech.com/en-us/shop/p/g915-x-mechanical-gaming-keyboard', 'line'],
  ['logitech', /^G915 TKL$/, 'page:https://www.logitech.com/en-us/shop/p/g915-x-tkl-wireless', 'line'],
  ['logitech', /^Gaming Mouse G305$/, 'page:https://www.logitech.com/en-us/shop/p/g305-lightspeed-wireless-gaming-mouse', 'model'],
  ['logitech', /^M325$/, 'page:https://www.logitech.com/en-us/shop/p/m325s-wireless-mouse', 'line'],
  ['logitech', /^M500s$/, 'page:https://www.logitech.com/en-us/shop/p/m500s-corded-mouse', 'model'],
  ['logitech', /^M585\/M590$/, 'page:https://www.logitech.com/en-us/shop/p/m585-wireless-mouse', 'model'],
  ['logitech', /^M720$/, 'page:https://www.logitech.com/en-us/shop/p/m720-triathlon', 'model'],
  ['logitech', /^MX Anywhere 3S$/, 'page:https://www.logitech.com/en-us/shop/p/mx-anywhere-3s', 'model'],
  ['logitech', /^MX Anywhere 3B?$/, 'page:https://www.logitech.com/en-us/shop/p/mx-anywhere-3s', 'line'],
  ['logitech', /^MX Ergo$/, 'page:https://www.logitech.com/en-us/shop/p/mx-ergo-wireless-trackball-mouse', 'model'],
  ['logitech', /^MX Master 3S for Business$/, 'page:https://www.logitech.com/en-us/shop/p/mx-master-3s-business-wireless-mouse', 'model'],
  ['logitech', /^MX Master 3S$/, 'page:https://www.logitech.com/en-us/shop/p/mx-master-3s', 'model'],
  ['logitech', /^MX Master 3$/, 'page:https://www.logitech.com/en-us/shop/p/mx-master-3s', 'line'],
  ['logitech', /^MX Master 4$/, 'page:https://www.logitech.com/en-us/shop/p/mx-master-4', 'model'],
  ['logitech', /^MX Vertical$/, 'page:https://www.logitech.com/en-us/shop/p/mx-vertical-ergonomic-mouse', 'model'],
  ['logitech', /^Marathon M705$/, 'page:https://www.logitech.com/en-us/shop/p/m705-wireless-mouse', 'model'],
  ['logitech', /^PRO X SUPERLIGHT 2$/, 'page:https://www.logitech.com/en-us/shop/p/pro-x2-superlight-wireless-mouse', 'model'],
  ['logitech', /^PRO X SUPERLIGHT 2 DEX$/, 'page:https://www.logitech.com/en-us/shop/p/pro-x-superlight-2-dex', 'model'],
  ['logitech', /^Zone 750 headset$/, 'page:https://www.logitech.com/en-us/shop/p/zone-750-wired-usb-refurbished', 'model'],
  ['logitech', /^Zone Wired headset$/, 'page:https://www.logitech.com/en-us/shop/p/zone-wired-noise-canceling', 'model'],
  ['steelseries', /^Aerox 3 Wireless CS2 Dragon Lore/, 'page:https://steelseries.com/gaming-mice/wireless-gaming-mouse-cs2-dragon-lore', 'model'],
  ['steelseries', /^Aerox 3 Wireless Gen 2$/, 'page:https://steelseries.com/gaming-mice/aerox-3-wireless-gen-2', 'model'],
  ['steelseries', /^Aerox 3/, 'page:https://steelseries.com/gaming-mice/aerox-3-2022', 'line'],
  ['steelseries', /^Aerox 5/, 'page:https://steelseries.com/gaming-mice/aerox-5', 'line'],
  ['steelseries', /^Aerox 9/, 'page:https://steelseries.com/gaming-mice/aerox-9', 'line'],
  ['steelseries', /^Arctis Nova 7$/, 'page:https://steelseries.com/gaming-headsets/arctis-nova-7', 'model'],
  ['steelseries', /^Prime/, 'page:https://steelseries.com/gaming-mice/prime', 'line'],
  ['steelseries', /^Rival 3 Wireless Gen 2$|^Rival 3 Gen 2$/, 'page:https://steelseries.com/gaming-mice/rival-3-gen-2', 'line'],
  ['steelseries', /^Rival 3( Wireless)?$/, 'page:https://steelseries.com/gaming-mice/rival-3', 'line'],
  ['steelseries', /^Rival 5$/, 'page:https://steelseries.com/gaming-mice/rival-5', 'model'],
  ['steelseries', /^Rival 600/, 'page:https://steelseries.com/gaming-mice/rival-600', 'line'],
  ['steelseries', /^Rival 650 Wireless$/, 'page:https://steelseries.com/gaming-mice/rival-650', 'model'],
  ['steelseries', /^Sensei TEN/, 'page:https://steelseries.com/gaming-mice/sensei-ten', 'line'],
  ['steelseries', /^Sensei Pro \/ Rival Pro$/, 'page:https://steelseries.com/gaming-mice/sensei-rival-pro', 'model'],
  ['wooting', /^60HE( \(ARM\)|\+)?$/, 'page:https://wooting.io/wooting-60he', 'line'],
  ['wooting', /^60HE V2$/, 'page:https://wooting.io/wooting-60he-v2', 'model'],
  ['wooting', /^80HE$/, 'page:https://wooting.io/wooting-80he', 'model'],
  ['wooting', /^Two HE/, 'page:https://wooting.io/wooting-two-he', 'line'],
  ['corsair', /^NIGHTSWORD RGB$/, 'page:https://www.corsair.com/us/en/p/gaming-mouse/ch-9306011-na/nightsword-rgb-tunable-fps-moba-wired-gaming-mouse-ch-9306011-na', 'model'],
  ['asus', /^ROG Azoth$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-azoth-model/gallery/', 'model'],
  ['asus', /^ROG Chakram$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-chakram-model/gallery/', 'model'],
  ['asus', /^ROG Chakram Core$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-chakram-core-model/gallery/', 'model'],
  ['asus', /^ROG Chakram X$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/wireless/rog-chakram-x-model/gallery/', 'model'],
  ['asus', /^ROG Falchion$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-falchion-model/gallery/', 'model'],
  ['asus', /^ROG Gladius II$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-ii-model/gallery/', 'model'],
  ['asus', /^ROG Gladius II Core$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-ii-core-model/gallery/', 'model'],
  ['asus', /^ROG Gladius II Origin PNK LTD$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-ii-origin-pnk-ltd-model/gallery/', 'model'],
  ['asus', /^ROG Gladius II Origin$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-ii-origin-model/gallery/', 'model'],
  ['asus', /^ROG Gladius II Wireless$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/wireless/rog-gladius-ii-wireless-model/gallery/', 'model'],
  ['asus', /^ROG Gladius III$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-iii-model/gallery/', 'model'],
  ['asus', /^ROG Gladius III Core$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-iii-core/gallery/', 'model'],
  ['asus', /^ROG Gladius III Wireless$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-gladius-iii-wireless-model/gallery/', 'model'],
  ['asus', /^ROG Gladius III Wireless AimPoint$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/wireless/rog-gladius-iii-wireless-aimpoint-model/gallery/', 'model'],
  ['asus', /^ROG Keris$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-keris-model/gallery/', 'model'],
  ['asus', /^ROG Keris Wireless$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/wireless/rog-keris-wireless-model/gallery/', 'model'],
  ['asus', /^ROG Keris Wireless AimPoint$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-keris-wireless-aimpoint-model/gallery/', 'model'],
  ['asus', /^ROG Pugio$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-pugio-model/gallery/', 'model'],
  ['asus', /^ROG Pugio II$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-pugio-ii-model/gallery/', 'model'],
  ['asus', /^ROG Spatha X$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ergonomic-right-handed/rog-spatha-x-model/gallery/', 'model'],
  ['asus', /^ROG Strix Flare II$/, 'page:https://rog.asus.com/keyboards/keyboards/pbt-keycaps/rog-strix-flare-ii-model/gallery/', 'model'],
  ['asus', /^ROG Strix Flare II Animate$/, 'page:https://rog.asus.com/keyboards/keyboards/pbt-keycaps/rog-strix-flare-ii-animate-model/gallery/', 'model'],
  ['asus', /^ROG Strix Impact II$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-strix-impact-ii-model/gallery/', 'model'],
  ['asus', /^ROG Strix Impact II Electro Punk$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-strix-impact-ii-electro-punk-model/gallery/', 'model'],
  ['asus', /^ROG Strix Impact II Moonlight White$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-strix-impact-ii-moonlight-white-model/gallery/', 'model'],
  ['asus', /^ROG Strix Impact II Wireless$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/wireless/rog-strix-impact-ii-wireless-model/gallery/', 'model'],
  ['asus', /^ROG Strix Impact III$/, 'page:https://rog.asus.com/mice-mouse-pads/mice/ambidextrous/rog-strix-impact-iii-model/gallery/', 'model'],
  ['asus', /^ROG Strix Scope$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-strix-scope-model/gallery/', 'model'],
  ['asus', /^ROG Strix Scope II$/, 'page:https://rog.asus.com/keyboards/keyboards/pbt-keycaps/rog-strix-scope-ii/gallery/', 'model'],
  ['asus', /^ROG Strix Scope II 96 RX Wireless$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-strix-scope-ii-96-rx-wireless/gallery/', 'model'],
  ['asus', /^ROG Strix Scope II 96 Wireless$/, 'page:https://rog.asus.com/keyboards/keyboards/compact/rog-strix-scope-ii-96-wireless/gallery/', 'model'],
  ['asus', /^ROG Strix Scope II RX$/, 'page:https://rog.asus.com/keyboards/keyboards/pbt-keycaps/rog-strix-scope-ii-rx/gallery/', 'model'],
  ['asus', /^ROG Strix Scope NX Wireless Deluxe$/, 'page:https://rog.asus.com/keyboards/keyboards/pbt-keycaps/rog-strix-scope-nx-wireless-deluxe-model/gallery/', 'model'],
  ['asus', /^ROG Strix Scope RX$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-strix-scope-rx-model/gallery/', 'model'],
  ['asus', /^ROG Strix Scope RX EVA-02 Edition$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-strix-scope-rx-eva-02-edition/gallery/', 'model'],
  ['asus', /^ROG Strix Scope RX TKL Wireless Deluxe$/, 'page:https://rog.asus.com/keyboards/keyboards/compact/rog-strix-scope-rx-tkl-wireless-deluxe-model/gallery/', 'model'],
  ['asus', /^ROG Strix Scope TKL$/, 'page:https://rog.asus.com/keyboards/keyboards/aura-rgb/rog-strix-scope-tkl-model/gallery/', 'model'],
  ['hyperx', /^Cloud Alpha Wireless$/, 'shop:hyperx.com/hyperx-cloud-alpha-wireless', 'model'],
  ['hyperx', /^Cloud II Wireless/, 'shop:hyperx.com/hyperx-cloud-ii-wireless', 'model'],
  ['hyperx', /^Cloud III$/, 'shop:hyperx.com/hyperx-cloud-iii-wired-gaming-headset', 'model'],
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
  // Drop detached specks (size labels, captions, award badges): opaque blobs under 12% of the largest one.
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
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && areas[label[i]] < big * 0.12) p[i * 4 + 3] = 0;
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

async function cdpTab() {
  const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = fail)));
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    pending.get(m.id)?.(m);
  };
  return {
    call: (method: string, params: object) =>
      new Promise<any>((ok) => {
        pending.set(++id, ok);
        ws.send(JSON.stringify({ id, method, params }));
      }),
    close: async () => {
      ws.close();
      await fetch(`${CDP}/json/close/${target.id}`);
    },
  };
}

async function browser() {
  const tab = await cdpTab();
  return {
    async process(bytes: Buffer, type: string) {
      const expr = `(${PROCESS})(${JSON.stringify(`data:${type};base64,${bytes.toString('base64')}`)}, ${MAX})`;
      const r = await tab.call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result.result.value as { webp: string; width: number; height: number; cutout: boolean; transparent: boolean };
    },
    close: tab.close,
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
  if (src.startsWith('page:')) {
    if (!shopCache.has(src)) shopCache.set(src, await page(src.slice(5)));
    return shopCache.get(src)!;
  }
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
    if (rule) {
      match = rule[3];
      src = await resolve(rule[2]).catch((err) => (console.warn(`skip ${e.id}: ${err.message}`), undefined));
    }
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
