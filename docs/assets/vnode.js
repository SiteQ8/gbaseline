// A page as a small tree of plain objects, written once and rendered two ways: to HTML text when the weekly run
// prints every page, and to DOM nodes in the browser for the parts that change while the page is open (the live
// check, the citation buttons). No markup strings are ever parsed and no element carries a style attribute.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function flat(kids, out = []) {
  for (const k of kids) {
    if (Array.isArray(k)) flat(k, out);
    else if (k !== null && k !== undefined && k !== false && k !== '') out.push(k);
  }
  return out;
}

export function h(tag, props, ...kids) {
  return { tag, props: props || {}, kids: flat(kids) };
}

// Children without a wrapping element.
export const frag = (...kids) => ({ tag: null, props: {}, kids: flat(kids) });

const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const quoted = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const skip = (k, v) => v === undefined || v === null || v === false || typeof v === 'function' || k === 'style';

export function toHtml(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node !== 'object') return text(node);
  if (Array.isArray(node)) return node.map(toHtml).join('');
  if (!node.tag) return node.kids.map(toHtml).join('');
  let out = `<${node.tag}`;
  for (const [k, v] of Object.entries(node.props)) {
    if (skip(k, v)) continue;
    out += v === true ? ` ${k}` : ` ${k}="${quoted(v)}"`;
  }
  out += '>';
  if (VOID.has(node.tag)) return out;
  return `${out}${node.kids.map(toHtml).join('')}</${node.tag}>`;
}

const SVG = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'g', 'use', 'symbol']);

export function toDom(node, doc = globalThis.document) {
  if (typeof node !== 'object') return doc.createTextNode(String(node));
  if (Array.isArray(node)) { const f = doc.createDocumentFragment(); for (const n of node) f.append(toDom(n, doc)); return f; }
  if (!node.tag) { const f = doc.createDocumentFragment(); for (const n of node.kids) f.append(toDom(n, doc)); return f; }
  const el = SVG.has(node.tag) ? doc.createElementNS('http://www.w3.org/2000/svg', node.tag) : doc.createElement(node.tag);
  for (const [k, v] of Object.entries(node.props)) {
    if (typeof v === 'function' && k.startsWith('on')) { el.addEventListener(k.slice(2), v); continue; }
    if (skip(k, v)) continue;
    if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of node.kids) el.append(toDom(kid, doc));
  return el;
}
