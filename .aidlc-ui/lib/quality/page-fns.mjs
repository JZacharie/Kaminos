// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Functions that run INSIDE the page (page.evaluate serialises them: no outer references allowed).

/**
 * One DOM pass for a loaded route.
 * opts: { data: boolean, placeholders: [[label, source, flags], ...] }
 * Returns overflow facts, a component count (density of the active screen) and, with opts.data, tables/lists/placeholder hits.
 */
export function collectPage(opts) {
  const iw = window.innerWidth;
  const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);

  const selector = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      if (cur.id) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      let s = cur.tagName.toLowerCase();
      const cls = [...cur.classList].filter((c) => !/^\d/.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.map((c) => CSS.escape(c)).join('.');
      parts.unshift(s);
      cur = cur.parentElement;
      if (cur && (cur.tagName === 'BODY' || cur.tagName === 'HTML')) break;
    }
    return parts.join(' > ');
  };
  const visible = (el) => {
    try { return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); } catch (e) { return !!(el.offsetWidth || el.offsetHeight); }
  };
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== 'visible') {
        // body/html propagate their overflow to the viewport: that is not a clip of the content.
        if (p === document.body) continue;
        return true;
      }
    }
    return false;
  };

  const out = { innerWidth: iw, scrollWidth: sw, offenders: [], componentCount: 0, tables: [], lists: [], placeholders: [] };

  if (sw > iw) {
    const found = [];
    for (const el of document.body.querySelectorAll('*')) {
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= iw + 1) continue;
      if (!visible(el) || clipped(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue;
      found.push({ selector: selector(el), width: Math.round(r.width), right: Math.round(r.right), over: r.right - iw, inline: el.style && el.style.width ? el.style.width : '' });
    }
    found.sort((a, b) => b.over - a.over);
    const seen = new Set();
    for (const f of found) {
      if (seen.has(f.selector)) continue;
      seen.add(f.selector);
      out.offenders.push({ selector: f.selector, width: f.width, right: f.right, inlineWidth: f.inline });
      if (out.offenders.length === 3) break;
    }
  }

  const scope = document.querySelector('[data-route]:not([hidden])') || document.body;
  let kitCount = 0;
  let all = 0;
  for (const el of scope.querySelectorAll('*')) {
    all++;
    if (el.hasAttribute('data-kit') || [...el.classList].some((c) => c.startsWith('k-'))) kitCount++;
  }
  out.componentCount = kitCount || all;

  // I-07: words broken across lines in a nav/header/button/chip/tab ("Dashboar d", "A-l-e-r-t-s"), or a control much taller than its
  // siblings (the same wrap, seen as height). Measured per word with a Range, so normal line breaks between words are fine.
  out.textWraps = [];
  const WRAP_SEL = 'header a, header button, header label, nav a, nav button, nav label, button, [role=tab], .k-btn, .k-chip, .k-tab, .k-badge';
  const wrapSeen = new Set();
  const wrapEls = [...document.querySelectorAll(WRAP_SEL)].filter((el) => visible(el) && el.getBoundingClientRect().height > 0);
  for (const el of wrapEls) {
    if (out.textWraps.length >= 5) break;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let broken = '';
    for (let n = w.nextNode(); n && !broken; n = w.nextNode()) {
      for (const m of n.nodeValue.matchAll(/\S{2,}/g)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top / 4)));
        if (tops.size > 1) { broken = m[0]; break; }
      }
    }
    let kind = broken ? 'word' : '';
    if (!kind && el.parentElement) {
      const sibs = [...el.parentElement.children].filter((s) => s !== el && wrapEls.includes(s));
      const h = el.getBoundingClientRect().height;
      const min = Math.min(...sibs.map((s) => s.getBoundingClientRect().height));
      // KG1: an event block placed on explicit grid rows (calendar week/day) or absolutely is as tall as its duration: not a wrapped control.
      const cs = getComputedStyle(el);
      const placed = cs.position === 'absolute' || cs.gridRowStart !== 'auto';
      if (sibs.length && h > 1.8 * min && h - min > 8 && !placed) kind = 'height';
    }
    if (!kind) continue;
    const sel = selector(el);
    if (wrapSeen.has(sel)) continue;
    wrapSeen.add(sel);
    out.textWraps.push({ selector: sel, kind, text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), word: broken, height: Math.round(el.getBoundingClientRect().height) });
  }

  // A28: which <section data-route> is visible. A route whose own section is not the visible one is a broken screen (run 4: the
  // kit router skips sections marked aria-hidden="true", so three screens showed the dashboard).
  out.routeView = {
    hash: location.hash,
    visible: [...document.querySelectorAll('[data-route]')].filter((e) => visible(e)).map((e) => e.getAttribute('data-route')),
    total: document.querySelectorAll('[data-route]').length,
  };

  // KF4: blocks that could not draw (bad config, render failure, unknown config key) carry data-k-block-error; the card only shows "cannot be shown".
  out.blockErrors = [];
  for (const el of document.querySelectorAll('[data-k-block-error]')) {
    if (out.blockErrors.length >= 6) break;
    if (!visible(el)) continue;
    out.blockErrors.push({ selector: selector(el), block: el.getAttribute('data-k-block') || '', cfg: el.getAttribute('data-k-cfg') || '', message: (el.getAttribute('data-k-block-error') || '').slice(0, 300) });
  }

  if (!opts || !opts.data) return out;

  for (const t of document.querySelectorAll('table')) {
    if (!visible(t)) continue;
    const rows = [...t.querySelectorAll('tr')].filter((tr) => !tr.closest('thead,tfoot') && tr.querySelector('td') &&
      !tr.hasAttribute('data-k-empty') && !tr.classList.contains('k-empty') && !tr.closest('[data-k-empty]'));
    const cap = t.querySelector('caption');
    out.tables.push({ selector: selector(t), label: (cap && cap.textContent.trim()) || t.getAttribute('aria-label') || '', rows: rows.length, canon: !!t.closest('[data-k-canon]') });
  }
  for (const l of document.querySelectorAll('[data-kit="list"], .k-list')) {
    if (!visible(l)) continue;
    const items = /^(UL|OL)$/.test(l.tagName) ? l.querySelectorAll(':scope > li').length : l.children.length;
    out.lists.push({ selector: selector(l), label: l.getAttribute('aria-label') || '', items, canon: !!l.closest('[data-k-canon]') });
  }

  const res = opts.placeholders.map(([label, src, flags]) => ({ label, re: new RegExp(src, flags) }));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenHit = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName)) continue;
    const text = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!text || !visible(p)) continue;
    for (const { label, re } of res) {
      if (re.test(text)) {
        const key = label + '|' + text;
        if (seenHit.has(key)) continue;
        seenHit.add(key);
        out.placeholders.push({ label, text: text.slice(0, 80), selector: selector(p) });
      }
    }
  }
  return out;
}

/** Runs axe-core (already injected as window.axe). Returns violations with up to 3 example nodes each. */
export async function runAxe() {
  const res = await window.axe.run(document, { resultTypes: ['violations'] });
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact || 'minor',
    help: v.help,
    nodes: v.nodes.length,
    examples: v.nodes.slice(0, 3).map((n) => {
      const data = (n.any && n.any[0] && n.any[0].data) || null;
      let detail = '';
      if (data && typeof data.contrastRatio !== 'undefined') {
        detail = `contrast ${data.contrastRatio}:1, needs ${data.expectedContrastRatio}:1 (text ${data.fgColor} on ${data.bgColor})`;
      } else {
        detail = String(n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim();
      }
      return { target: (Array.isArray(n.target) ? n.target.flat(3) : [String(n.target)]).join(' '), detail: detail.slice(0, 160) };
    }),
  }));
}

/** Height of the document (for the screenshot clip). */
export function documentHeight() {
  return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
}
