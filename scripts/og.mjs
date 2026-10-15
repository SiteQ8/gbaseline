// Renders docs/og.png, the 1200 by 630 card that link previews show, from the site's own fonts and colours, then
// writes its provenance into the PNG. Needs Playwright: set PW_MODULE and PW_CHROME when they are not on the
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
export const PROVENANCE = "Origin: rendered by scripts/og.mjs from the site's own fonts (Amiri and Noto Naskh Arabic, SIL Open Font License) and its colour tokens. No generated, stock or sourced imagery.";

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

export function cardHtml({ nameAr, nameEn, domain, tagline, countries }, root = here) {
  const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, 'docs/fonts', f)).toString('base64')}`;
  const cells = Object.values(countries).map((c) => `<td><b>${esc(c.ar)}</b><span>${esc(c.en)}</span></td>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Amiri'; font-weight: 700; src: url(${font('amiri-arabic-700.woff2')}) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F; }
@font-face { font-family: 'Amiri'; font-weight: 700; src: url(${font('amiri-latin-700.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; }
@font-face { font-family: 'Naskh'; font-weight: 400 700; src: url(${font('noto-naskh-arabic.woff2')}) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E; }
@font-face { font-family: 'Naskh'; font-weight: 400 700; src: url(${font('noto-naskh-latin.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #F3F4F1; color: #15181B; }
.card { width: 100%; height: 100%; padding: 48px 72px 44px; display: flex; flex-direction: column; font-family: 'Naskh', serif; }
.card > * { flex-shrink: 0; }
.mast { display: flex; align-items: baseline; justify-content: space-between; gap: 40px; }
.ar { font-family: 'Amiri', serif; font-weight: 700; font-size: 108px; line-height: 1.1; white-space: nowrap; }
.en { font-family: 'Amiri', serif; font-weight: 700; font-size: 40px; line-height: 1.2; white-space: nowrap; direction: ltr; }
.rule { border-top: 5px solid #15181B; border-bottom: 1.5px solid #15181B; height: 10px; margin: 6px 0 26px; }
.tag-ar { font-size: 31px; line-height: 1.6; font-weight: 500; text-wrap: balance; }
.tag-en { font-size: 21px; line-height: 1.5; color: #474D53; direction: ltr; text-align: left; margin-top: 8px; text-wrap: balance; }
table { width: 100%; border-collapse: collapse; margin-top: auto; table-layout: fixed; }
td { border-top: 1px solid #AEB3AB; border-bottom: 1px solid #AEB3AB; border-inline-start: 1px solid #CDD1CA; padding: 10px 14px 8px; vertical-align: top; }
td:first-child { border-inline-start: 0; padding-inline-start: 0; }
td b { display: block; font-size: 25px; line-height: 1.5; font-weight: 700; }
td span { display: block; font-size: 16px; line-height: 1.3; color: #61686F; direction: ltr; text-align: right; }
.foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
.mark { width: 22px; height: 22px; border-radius: 50%; background: #1C3D8C; }
.domain { font-size: 25px; color: #1C3D8C; direction: ltr; font-weight: 600; letter-spacing: .01em; }
</style></head><body><div class="card">
<div class="mast"><div class="ar" id="ar">${esc(nameAr)}</div><div class="en" id="en">${esc(nameEn)}</div></div>
<div class="rule"></div>
<p class="tag-ar">${esc(tagline.ar)}</p>
<p class="tag-en">${esc(tagline.en)}</p>
<table><tr>${cells}</tr></table>
<div class="foot"><span class="mark"></span><span class="domain">${esc(domain)}</span></div>
</div></body></html>`;
}

export async function renderOg({ out, nameAr, nameEn, domain, root = here } = {}) {
  const bundle = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
  const p = bundle.project;
  const card = { nameAr: nameAr || p.name_ar, nameEn: nameEn || p.name_en, domain: domain || p.domain, tagline: bundle.ui.tagline, countries: bundle.scope.countries };
  if (!card.nameAr || !card.nameEn || !card.domain) throw new Error('the card needs the Arabic and English names and the domain');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PW_MODULE || 'playwright');
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await page.setContent(cardHtml(card, root), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Fit the names on one line and the card in its frame: the Arabic name shrinks first, then the English one.
    // Amiri's descenders run deep, so the ink of the Arabic name is measured and the double rule kept clear of it.
    const overflow = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const mast = document.querySelector('.mast');
      const rule = document.querySelector('.rule');
      const ar = document.getElementById('ar');
      const en = document.getElementById('en');
      const ctx = document.createElement('canvas').getContext('2d');
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      const settle = (size) => {
        ar.style.fontSize = `${size}px`;
        card.style.paddingTop = '';
        rule.style.marginTop = '';
        const cs = getComputedStyle(ar);
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const ink = ctx.measureText(ar.textContent);
        ar.append(probe);
        const top = probe.getBoundingClientRect().top - ink.actualBoundingBoxAscent;
        if (top < 34) card.style.paddingTop = `${48 + 34 - top}px`;
        const gap = rule.getBoundingClientRect().top - (probe.getBoundingClientRect().top + ink.actualBoundingBoxDescent);
        if (gap < 16) rule.style.marginTop = `${6 + 16 - gap}px`;
        probe.remove();
        return document.documentElement.scrollHeight - innerHeight;
      };
      const wide = () => ar.scrollWidth + en.scrollWidth + 40 > mast.clientWidth;
      let size = 108;
      let over = settle(size);
      while ((wide() || over > 0) && size > 56) { size -= 2; over = settle(size); }
      for (let s = 40; s > 22 && wide(); s -= 1) en.style.fontSize = `${s}px`;
      return Math.max(over, wide() ? 1 : 0);
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
