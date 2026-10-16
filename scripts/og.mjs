// Renders docs/og.png, the 1200 by 630 card that link previews show: the site's card with its measuring scale
// beside a photograph of the Arabian Gulf coast at night, from the site's own fonts and image, then writes its provenance into
// the PNG. Needs Playwright: set PW_MODULE and PW_CHROME when they are not on the
// default paths. --out writes elsewhere, and --ar, --en and --domain override project.json for a trial render.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WIDTH = 1200;
export const HEIGHT = 630;
export const PROVENANCE_KEY = 'impeccable:prompt';
export const PROVENANCE = "Origin: rendered by scripts/og.mjs from the site's own fonts (El Messiri and Alexandria, SIL Open Font License), its colour tokens and its photograph of Dammam and the Eastern Province coast of the Arabian Gulf at night, taken from the International Space Station by the NASA Expedition 62 crew on 25 March 2020 (public domain, Wikimedia Commons page 88992012). No generated imagery.";

// A PNG tEXt chunk placed before IEND. Keyword and text are Latin-1, which the provenance line is.
export function withText(png, key, text) {
  const at = png.lastIndexOf(Buffer.from('IEND', 'latin1')) - 4;
  if (at < 8) throw new Error('not a PNG: no IEND chunk');
  const type = Buffer.from('tEXt', 'latin1');
  const data = Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([png.subarray(0, at), len, type, data, crc, png.subarray(at)]);
}

export function readText(png) {
  const out = {};
  for (let i = 8; i + 8 <= png.length;) {
    const n = png.readUInt32BE(i);
    const type = png.toString('latin1', i + 4, i + 8);
    if (type === 'tEXt') {
      const body = png.subarray(i + 8, i + 8 + n);
      const zero = body.indexOf(0);
      out[body.toString('latin1', 0, zero)] = body.toString('latin1', zero + 1);
    }
    i += 12 + n;
  }
  return out;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function cardHtml({ nameAr, nameEn, domain, title }, root = here) {
  const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, 'docs/fonts', f)).toString('base64')}`;
  const photo = `data:image/jpeg;base64,${readFileSync(join(root, 'docs/img/dammam-night-1600.jpg')).toString('base64')}`;
  const AR = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F';
  const LA = 'U+0000-00FF, U+2000-206F';
  const ticks = Array.from({ length: 29 }, (_, i) => `<i${i % 4 === 0 ? ' class="major"' : ''}></i>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: 'El Messiri'; font-weight: 400; src: url(${font('el-messiri-arabic-400.woff2')}) format('woff2'); unicode-range: ${AR}; }
@font-face { font-family: 'El Messiri'; font-weight: 500; src: url(${font('el-messiri-arabic-500.woff2')}) format('woff2'); unicode-range: ${AR}; }
@font-face { font-family: 'El Messiri'; font-weight: 400; src: url(${font('el-messiri-latin-400.woff2')}) format('woff2'); unicode-range: ${LA}; }
@font-face { font-family: 'Alexandria'; font-weight: 400; src: url(${font('alexandria-latin-400.woff2')}) format('woff2'); unicode-range: ${LA}; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #161c1a; }
.stage { width: 100%; height: 100%; padding: 16px; display: grid; grid-template-columns: 600px 1fr; gap: 16px; }
.card { background: #e3e2da; color: #161c1a; display: flex; flex-direction: column; min-width: 0; }
.scale { display: flex; justify-content: space-between; align-items: flex-start; height: 44px; padding: 0 16px; flex: none; }
.scale i { width: 5px; height: 18px; background: #161c1a; }
.scale i.major { height: 36px; }
.body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 8px 40px; text-align: center; }
.ar { font: 500 34px/1.35 'El Messiri', serif; white-space: nowrap; }
.en { font: 400 22px/1.3 'El Messiri', serif; color: #49524e; direction: ltr; white-space: nowrap; }
h1 { font: 400 66px/1.28 'El Messiri', serif; margin-top: 18px; }
h1 span { display: block; white-space: nowrap; }
.foot { padding: 0 32px 26px; text-align: center; font: 400 22px/1 'Alexandria', sans-serif; direction: ltr; color: #161c1a; }
.photo { background: #0c100f url(${photo}) 58% 50% / cover no-repeat; }
</style></head><body><div class="stage">
<div class="card"><div class="scale">${ticks}</div>
<div class="body"><p class="ar" id="ar">${esc(nameAr)}</p><p class="en" id="en">${esc(nameEn)}</p><h1 id="title"><span>${esc(title[0])}</span><span>${esc(title[1])}</span></h1></div>
<p class="foot">${esc(domain)}</p></div>
<div class="photo"></div>
</div></body></html>`;
}

export async function renderOg({ out, nameAr, nameEn, domain, root = here } = {}) {
  const bundle = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
  const p = bundle.project;
  const card = { nameAr: nameAr || p.name_ar, nameEn: nameEn || p.name_en, domain: domain || p.domain, title: [bundle.ui.hero_title_1.ar, bundle.ui.hero_title_2.ar] };
  if (!card.nameAr || !card.nameEn || !card.domain) throw new Error('the card needs the Arabic and English names and the domain');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PW_MODULE || 'playwright');
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await page.setContent(cardHtml(card, root), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Each line keeps to one line on the card: a long name or headline steps down until it fits.
    const overflow = await page.evaluate(() => {
      const body = document.querySelector('.body');
      const room = body.clientWidth - 80;
      const fit = (el, from, floor) => { let size = from; el.style.fontSize = `${size}px`; while (el.scrollWidth > room && size > floor) { size -= 1; el.style.fontSize = `${size}px`; } return el.scrollWidth > room; };
      const lines = [...document.querySelectorAll('#title span')];
      const tooWide = [fit(document.getElementById('ar'), 34, 22), fit(document.getElementById('en'), 22, 16), ...lines.map((l) => fit(l, 66, 40))].some(Boolean);
      return Math.max(document.documentElement.scrollHeight - innerHeight, tooWide ? 1 : 0);
    });
    if (overflow > 0) throw new Error(`the card does not fit its frame (${overflow}px over)`);
    const png = await page.screenshot({ type: 'png' });
    const target = out || join(root, 'docs/og.png');
    writeFileSync(target, withText(png, PROVENANCE_KEY, PROVENANCE));
    return target;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  renderOg({ out: opt('out'), nameAr: opt('ar'), nameEn: opt('en'), domain: opt('domain') })
    .then((p) => console.log(`og image written: ${p}`))
    .catch((e) => { console.error(`og image: ${e.message}`); process.exit(1); });
}
