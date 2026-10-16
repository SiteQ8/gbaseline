// Renders docs/og.png, the 1200 by 630 card that link previews show: the six states at night as a mosaic beside the
// title, set in the site's own type and colours, then writes its provenance into the PNG. Needs Playwright: set
// PW_MODULE and PW_CHROME when they are not on the default paths. --out writes elsewhere, and --ar, --en and --domain
// override project.json for a trial render.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WIDTH = 1200;
export const HEIGHT = 630;
export const PROVENANCE_KEY = 'impeccable:prompt';
export function provenance(pictures) {
  const pages = pictures.map((p) => p.commons).join(', ');
  return `Origin: rendered by scripts/og.mjs from the site's own typeface (Alexandria, SIL Open Font License), its colour tokens and its six night photographs of the Arabian Gulf's cities taken from the International Space Station by NASA crews (public domain, Wikimedia Commons pages ${pages}). No generated imagery.`;
}

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

export function cardHtml({ nameAr, nameEn, domain, title, pictures }, root = here) {
  const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, 'docs/fonts', f)).toString('base64')}`;
  const photo = (p) => `data:image/jpeg;base64,${readFileSync(join(root, 'docs/img', p.files.tile.file)).toString('base64')}`;
  const AR = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F';
  const LA = 'U+0000-00FF, U+2000-206F';
  const tiles = pictures.map((p) => `<i style="background-image:url(${photo(p)})"></i>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Alexandria'; font-weight: 600; src: url(${font('alexandria-arabic-600.woff2')}) format('woff2'); unicode-range: ${AR}; }
@font-face { font-family: 'Alexandria'; font-weight: 400; src: url(${font('alexandria-arabic-400.woff2')}) format('woff2'); unicode-range: ${AR}; }
@font-face { font-family: 'Alexandria'; font-weight: 600; src: url(${font('alexandria-latin-600.woff2')}) format('woff2'); unicode-range: ${LA}; }
@font-face { font-family: 'Alexandria'; font-weight: 400; src: url(${font('alexandria-latin-400.woff2')}) format('woff2'); unicode-range: ${LA}; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #0f1928; color: #f3b562; font-family: 'Alexandria', sans-serif; }
.stage { width: 100%; height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 520px; }
.text { display: flex; flex-direction: column; justify-content: space-between; min-width: 0; padding: 0 48px 40px 40px; }
.mark { align-self: flex-start; background: #f3b562; color: #0f1928; padding: 14px 20px; font-weight: 600; font-size: 22px; line-height: 1.3; }
.mark span { display: block; white-space: nowrap; }
.mark span + span { font-weight: 400; }
h1 { font-weight: 600; font-size: 80px; line-height: 1.22; }
h1 span { display: block; white-space: nowrap; }
.foot { display: flex; justify-content: space-between; align-items: baseline; font-size: 22px; }
.en { color: #cfa064; direction: ltr; }
.dom { direction: ltr; font-weight: 600; }
.tiles { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); }
.tiles i { background: #0a121e center / cover no-repeat; }
</style></head><body><div class="stage">
<div class="text"><p class="mark" id="ar"><span>${esc(nameAr.split(' ').slice(0, -2).join(' '))}</span><span>${esc(nameAr.split(' ').slice(-2).join(' '))}</span></p>
<h1 id="title"><span>${esc(title[0])}</span><span>${esc(title[1])}</span></h1>
<p class="foot"><span class="dom" id="dom">${esc(domain)}</span><span class="en" id="en">${esc(nameEn)}</span></p></div>
<div class="tiles">${tiles}</div>
</div></body></html>`;
}

export async function renderOg({ out, nameAr, nameEn, domain, root = here } = {}) {
  const bundle = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
  const p = bundle.project;
  const pictures = JSON.parse(readFileSync(join(root, 'data/src/pictures.json'), 'utf8')).pictures;
  const card = { nameAr: nameAr || p.name_ar, nameEn: nameEn || p.name_en, domain: domain || p.domain, title: [bundle.ui.title_1.ar, bundle.ui.title_2.ar], pictures };
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
      const box = document.querySelector('.text');
      const room = box.clientWidth - 88;
      const fit = (el, from, floor) => { let size = from; el.style.fontSize = `${size}px`; while (el.scrollWidth > room && size > floor) { size -= 1; el.style.fontSize = `${size}px`; } return el.scrollWidth > room; };
      const lines = [...document.querySelectorAll('#title span')];
      const tooWide = lines.map((l) => fit(l, 80, 48)).some(Boolean) || document.querySelector('.foot').scrollWidth > room + 40;
      return Math.max(document.documentElement.scrollHeight - innerHeight, tooWide ? 1 : 0);
    });
    if (overflow > 0) throw new Error(`the card does not fit its frame (${overflow}px over)`);
    const png = await page.screenshot({ type: 'png' });
    const target = out || join(root, 'docs/og.png');
    writeFileSync(target, withText(png, PROVENANCE_KEY, provenance(pictures)));
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
