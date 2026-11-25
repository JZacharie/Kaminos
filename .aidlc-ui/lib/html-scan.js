// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// Minimal, dependency-free scanner for prototype.html.
// It is a tokenizer, not a full HTML parser: it finds start tags and their attributes, skips
// comments, and treats <script>/<style> bodies as raw text. That is all the validator needs
// (element ids, the aidlc-ui-version meta tag, and network references).

const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

// Standard namespace strings that are identifiers, not network access (ANCHORS.md section 2).
const NAMESPACE_RE =
  /http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1999\/xhtml|2000\/xmlns|XML\/1998\/namespace|1998\/Math\/MathML)\/?(?![\w/.\-])/g;

const URL_ATTRS = new Set([
  'src', 'href', 'xlink:href', 'action', 'formaction', 'poster', 'data', 'background',
  'cite', 'manifest', 'ping', 'longdesc', 'codebase', 'icon', 'srcset', 'imagesrcset',
]);

/** Replace every match of `re` in `text` with spaces, keeping newlines (offsets and lines stay valid). */
function blank(text, re) {
  return text.replace(re, (m) => m.replace(/[^\n]/g, ' '));
}

function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

function isProtoRelative(value) {
  return /^\/\/[^\s/]/.test(value.trim());
}

// ---------------------------------------------------------------------------------------------
// Tokenizer

function tokenize(source) {
  const text = blank(source, /<!--[\s\S]*?(?:-->|$)/g); // comments are not content
  const tags = []; // { name, attrs: [{name,value,offset}], offset, end }
  const raws = []; // { tag: 'script'|'style', text, offset, attrs }
  let i = 0;
  const n = text.length;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    const m = /^<([A-Za-z][^\s/>]*)/.exec(text.slice(lt, lt + 64));
    if (!m) {
      i = lt + 1;
      continue;
    }
    const name = m[1].toLowerCase();
    let p = lt + m[0].length;
    const attrs = [];
    // attribute loop
    for (;;) {
      while (p < n && /[\s/]/.test(text[p])) p++;
      if (p >= n || text[p] === '>') break;
      const nm = /^[^\s"'<>/=]+/.exec(text.slice(p, p + 256));
      if (!nm) {
        p++;
        continue;
      }
      const attrName = nm[0].toLowerCase();
      const attrOffset = p;
      p += nm[0].length;
      let q = p;
      while (q < n && /\s/.test(text[q])) q++;
      let value = '';
      if (text[q] === '=') {
        q++;
        while (q < n && /\s/.test(text[q])) q++;
        const quote = text[q];
        if (quote === '"' || quote === "'") {
          const close = text.indexOf(quote, q + 1);
          const stop = close === -1 ? n : close;
          value = text.slice(q + 1, stop);
          p = close === -1 ? n : close + 1;
        } else {
          const um = /^[^\s>]*/.exec(text.slice(q));
          value = um[0];
          p = q + value.length;
        }
      }
      attrs.push({ name: attrName, value, offset: attrOffset });
    }
    const end = p < n ? p + 1 : n;
    tags.push({ name, attrs, offset: lt, end });
    i = end;
    if (RAW_TEXT_TAGS.has(name)) {
      const closeRe = new RegExp('</' + name + '[\\s/>]', 'ig');
      closeRe.lastIndex = i;
      const cm = closeRe.exec(text);
      const bodyEnd = cm ? cm.index : n;
      if (name === 'script' || name === 'style') {
        raws.push({ tag: name, text: text.slice(i, bodyEnd), offset: i, attrs });
      }
      i = bodyEnd;
    }
  }
  return { text, tags, raws };
}

// ---------------------------------------------------------------------------------------------
// Network checks

const JS_API_RES = [
  [/\bfetch\s*\(/g, 'fetch()'],
  [/\bnew\s+XMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\b/g, 'WebSocket'],
  [/\bEventSource\b/g, 'EventSource'],
  [/\bsendBeacon\b/g, 'sendBeacon'],
  [/\bimportScripts\s*\(/g, 'importScripts()'],
  [/\bimport\s*\(/g, 'dynamic import()'],
];

function scanCss(css, baseOffset, lineAt, out) {
  const urlRe = /url\(\s*(['"]?)\s*([^'")\s]+)/gi;
  let m;
  while ((m = urlRe.exec(css))) {
    if (isProtoRelative(m[2])) out.push({ line: lineAt(baseOffset + m.index), what: `protocol-relative url(${m[2]})` });
  }
  const impRe = /@import\s+(?:url\(\s*)?['"]?\s*([^'")\s;]+)/gi;
  while ((m = impRe.exec(css))) {
    if (isProtoRelative(m[1])) out.push({ line: lineAt(baseOffset + m.index), what: `protocol-relative @import ${m[1]}` });
  }
}

function scanJs(js, baseOffset, lineAt, out) {
  for (const [re, label] of JS_API_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(js))) out.push({ line: lineAt(baseOffset + m.index), what: `network API ${label}` });
  }
  const strRe = /["'`]\/\/[A-Za-z0-9_][A-Za-z0-9_.\-]*/g;
  let m;
  while ((m = strRe.exec(js))) {
    out.push({ line: lineAt(baseOffset + m.index), what: `protocol-relative URL ${m[0].slice(1)}` });
  }
}

/**
 * Scan prototype.html text.
 * Returns { ids: [{id, line}], metaVersions: [content], network: [{line, what}],
 * effects: [{line, type, text}] }.
 */
function scanHtml(source) {
  const { text, tags, raws } = tokenize(source);
  const lineAt = lineIndex(text);

  const ids = [];
  const metaVersions = [];
  const network = [];

  for (const t of tags) {
    for (const a of t.attrs) {
      if (a.name === 'id') ids.push({ id: a.value, line: lineAt(a.offset) });
    }
    if (t.name === 'meta') {
      const get = (k) => (t.attrs.find((a) => a.name === k) || {}).value;
      const nm = get('name');
      if (nm !== undefined && nm.toLowerCase() === 'aidlc-ui-version') metaVersions.push(get('content') === undefined ? '' : get('content'));
    }
    for (const a of t.attrs) {
      const line = lineAt(a.offset);
      if (URL_ATTRS.has(a.name)) {
        const parts = a.name.endsWith('srcset') ? a.value.split(',').map((s) => s.trim().split(/\s+/)[0]) : [a.value];
        for (const v of parts) if (isProtoRelative(v)) network.push({ line, what: `protocol-relative ${a.name}="${v}"` });
      } else if (a.name === 'style') {
        scanCss(a.value, 0, () => line, network);
      } else if (a.name.startsWith('on')) {
        scanJs(a.value, 0, () => line, network);
      }
    }
  }
  const effects = []; // <script id="aidlc-effects"> blocks (ANCHORS.md section 2b)
  for (const r of raws) {
    const attr = (k) => (r.attrs.find((a) => a.name === k) || {}).value;
    const type = attr('type');
    if (r.tag === 'script' && attr('id') === 'aidlc-effects') {
      effects.push({ line: lineAt(r.offset), type: type === undefined ? null : type, text: r.text });
    }
    if (r.tag === 'style') scanCss(r.text, r.offset, lineAt, network);
    else if (type !== undefined && /json/i.test(type)) continue; // data block, not code
    else scanJs(r.text, r.offset, lineAt, network);
  }

  // Any absolute network URL anywhere in the document (attributes, text, CSS, JS), except
  // standard namespace identifiers.
  const cleaned = blank(text, NAMESPACE_RE);
  const absRe = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>)\\]*/gi;
  let m;
  while ((m = absRe.exec(cleaned))) {
    network.push({ line: lineAt(m.index), what: `absolute URL ${m[0].slice(0, 80)}` });
  }
  network.sort((a, b) => a.line - b.line);
  return { ids, metaVersions, network, effects };
}

module.exports = { scanHtml };
