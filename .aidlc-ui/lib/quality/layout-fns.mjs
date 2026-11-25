// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Layout checks that run INSIDE the page (page.evaluate serialises the function: no outer references allowed).
// B1-T5: the first-UI defects the product owner saw at 1324 px: words broken letter by letter in narrow cards, a 5-column row squeezed into a ~350 px
// card, a nav / top bar on two lines, text sticking out of its card. Called once per (route, width) load; cheap (a few ms plus one
// Range per multi-line text node).

/**
 * Returns { brokenWords[], narrowRows[], headerWraps[], navScroll[], childOverflow[], columnHoles[] } (each at most 4 entries, deduplicated by selector).
 * opts: { width: number } (the viewport width, for the header rules).
 */
export function collectLayout(opts) {
  const iw = window.innerWidth;
  const LIMIT = 4;
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
  const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const SKIP_TAG = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|CANVAS|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/;
  const inSvg = (el) => !!el.closest('svg');
  /** Groups elements into visual lines: boxes whose vertical extents overlap by more than half of the smaller one share a line. */
  const lines = (els) => {
    const boxes = els.map((e) => { const r = e.getBoundingClientRect(); return { e, top: r.top, bottom: r.bottom }; }).sort((a, b) => a.top - b.top);
    const groups = [];
    for (const b of boxes) {
      const g = groups.find((x) => Math.min(x.bottom, b.bottom) - Math.max(x.top, b.top) > 0.5 * Math.min(x.bottom - x.top, b.bottom - b.top));
      if (g) { g.items.push(b.e); g.top = Math.min(g.top, b.top); g.bottom = Math.max(g.bottom, b.bottom); } else groups.push({ items: [b.e], top: b.top, bottom: b.bottom });
    }
    return groups;
  };
  const out = { brokenWords: [], narrowRows: [], headerWraps: [], navScroll: [], childOverflow: [], columnHoles: [] };
  const seen = { w: new Set(), n: new Set(), c: new Set(), h: new Set() };

  // 1. A word split across lines (no hyphen or slash in it): "Lighthous e", "Nobo dy", "N e x t".
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && out.brokenWords.length < LIMIT; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || SKIP_TAG.test(p.tagName) || inSvg(p)) continue;
    if (!/\S{3,}/.test(n.nodeValue)) continue;
    const pr = p.getBoundingClientRect();
    if (pr.height === 0 || pr.width === 0 || !visible(p)) continue;
    const cs = getComputedStyle(p);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    if (pr.height < lh * 1.4 - 1 && p.children.length === 0) continue; // one line: nothing can be split
    for (const m of n.nodeValue.matchAll(/[^\s\-\u00AD\u2010-\u2015/]{3,}/g)) {
      if (m[0].length >= 20) continue; // ids, hashes and URLs may be broken on purpose (class k-break)
      const r = document.createRange();
      r.setStart(n, m.index);
      r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter((q) => q.width > 0);
      if (rects.length < 2) continue;
      const tops = new Set(rects.map((q) => Math.round(q.top / 4)));
      if (tops.size < 2) continue;
      const host = p.closest('.k-card, article, aside, td, th, li, [class*=card], section') || p;
      const sel = selector(p);
      if (seen.w.has(sel)) break;
      seen.w.add(sel);
      out.brokenWords.push({ selector: sel, word: m[0].slice(0, 30), text: clip(p.textContent, 40), boxWidth: Math.round(pr.width), hostWidth: Math.round(host.getBoundingClientRect().width), overflowWrap: cs.overflowWrap, wordBreak: cs.wordBreak });
      break;
    }
  }

  // 2. A row with many columns squeezed into a narrow container (grid always; flex only when it cannot wrap).
  // KF4/KF5: the filterbar block (chip groups, menu buttons: label + value + caret) and chips are shrink-to-fit controls in a strip that scrolls, not column layouts.
  // Other buttons (a card rendered as a <button>) are checked like any other row.
  // KG1: also not column layouts: the segmented control (.k-seg) and the timeline block (.k-tracks: a scroller with its own header column), anything inside a
  // sideways scroll container (the strip scrolls, nothing is squeezed), an absolutely positioned clip, and a schedule grid whose cells are placed on explicit grid rows
  // (calendar week/day, a timetable: events, not columns).
  const SKIP_ROW = 'header, nav, table, svg, .k-topbar, .k-tabs, [role=tablist], .k-table-wrap, .k-pager, .k-chips, .k-chip, .k-legend, .k-fb, .k-seg-wrap, .k-seg, .k-tracks';
  const inHScroll = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (out.narrowRows.length >= LIMIT) break;
    if (SKIP_TAG.test(el.tagName) || el.closest(SKIP_ROW)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed' || inHScroll(el)) continue;
    const grid = cs.display === 'grid' || cs.display === 'inline-grid';
    const flex = cs.display === 'flex' || cs.display === 'inline-flex';
    if (!grid && !flex) continue;
    if (flex && (cs.flexWrap !== 'nowrap' || /column/.test(cs.flexDirection))) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || !visible(el)) continue;
    const kids = [...el.children].filter((k) => {
      const kc = getComputedStyle(k);
      if (kc.position === 'absolute' || kc.position === 'fixed' || kc.display === 'none') return false;
      const r = k.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (kids.length < 3) continue;
    if (grid && kids.filter((k) => getComputedStyle(k).gridRowStart !== 'auto').length >= kids.length / 2) continue;   // schedule grid
    const widest = lines(kids).map((g) => g.items).sort((a, b) => b.length - a.length)[0];
    const cols = widest.length;
    const inner = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const longKid = widest.find((k) => {
      const t = clip(k.textContent, 200);
      return t.length > 12 || /\S{7,}/.test(t);
    });
    if (!longKid) continue;
    // KG1: a row of icons and switches with one label (a calendar list item: dot, name, count, switch) is not a column layout: it needs at least 3 columns that hold text.
    if (widest.filter((k) => clip(k.textContent, 60).length >= 3).length < 3) continue;
    const avg = inner / cols;
    const tooNarrow = (cols >= 4 && inner < 480) || (cols >= 3 && avg < 96);
    if (!tooNarrow) continue;
    const sel = selector(el);
    if (seen.n.has(sel)) continue;
    seen.n.add(sel);
    out.narrowRows.push({ selector: sel, columns: cols, width: Math.round(inner), columnWidth: Math.round(avg), sample: clip(longKid.textContent, 24), display: grid ? 'grid' : 'flex' });
  }

  // 3. Header / top bar on more than one line, or a menu button on a wide screen.
  const w = (opts && opts.width) || iw;
  const bar = document.querySelector('header, .k-topbar, [role=banner]');
  if (bar && visible(bar) && w >= 1024) {
    const kids = [...bar.children].filter((k) => {
      const kc = getComputedStyle(k);
      return kc.position !== 'absolute' && kc.position !== 'fixed' && kc.display !== 'none' && k.getBoundingClientRect().height > 0;
    });
    const barLines = lines(kids).length;
    const links = [...bar.querySelectorAll('nav a, nav button, nav label')].filter((a) => visible(a) && a.getBoundingClientRect().height > 0);
    const linkLines = lines(links).length;
    const menuBtn = [...document.querySelectorAll('[data-k-menu]')].find((b) => visible(b) && b.getBoundingClientRect().width > 0);
    if (barLines > 1 || linkLines > 1 || menuBtn) {
      out.headerWraps.push({ selector: selector(bar), height: Math.round(bar.getBoundingClientRect().height), rows: Math.max(barLines, linkLines), navRows: linkLines, links: links.length,
        menuButton: !!menuBtn, labels: links.slice(0, 10).map((a) => clip(a.textContent, 18)) });
    }
  }
  if (bar && w >= 768) {
    for (const nav of bar.querySelectorAll('nav')) {
      if (visible(nav) && nav.scrollWidth > nav.clientWidth + 2) out.navScroll.push({ selector: selector(nav), hidden: nav.scrollWidth - nav.clientWidth, links: nav.querySelectorAll('a').length });
    }
  }

  // 4. Text that sticks out of its card (and is not clipped by a scroll container on the way).
  const CARD = '.k-card, article, aside, [class*=card], [class*=panel], [class*=tile]';
  for (const el of document.body.querySelectorAll('*')) {
    if (out.childOverflow.length >= LIMIT) break;
    if (SKIP_TAG.test(el.tagName) || inSvg(el)) continue;
    let own = false;
    for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
    if (!own) continue;
    const card = el.parentElement && el.parentElement.closest(CARD);
    if (!card || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed') continue;
    let clipped = false;
    for (let a = el; a; a = a.parentElement) {
      if (a !== el && getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
      if (a === card) break;
    }
    if (clipped) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tr = range.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    if (tr.width === 0 || cr.width === 0) continue;
    const over = Math.max(tr.right - cr.right, cr.left - tr.left);
    if (over <= 2) continue;
    const sel = selector(el);
    if (seen.c.has(sel)) continue;
    seen.c.add(sel);
    out.childOverflow.push({ selector: sel, text: clip(el.textContent, 32), card: selector(card), cardWidth: Math.round(cr.width), over: Math.round(over) });
  }

  // 5. KF4 column hole: two cards side by side in one .k-grid row (direct children starting at the same top) where the shorter one ends more than
  // HOLE px above the taller one. The kit grid aligns items to the start, so the space below the short card stays empty (A2 D1).
  const HOLE = 200;
  const HOLE_SHARE = 0.35;
  /** True when at least half of the cell's height is taken by lists and tables (outermost ones, so a nested list is not counted twice). */
  const listShare = (cell, height) => {
    const LIST = 'ul, ol, table, .k-list, [role=list], [role=table]';
    const outer = [...cell.querySelectorAll(LIST)].filter((e) => { const up = e.parentElement && e.parentElement.closest(LIST); return !up || !cell.contains(up); });
    return outer.reduce((sum, e) => sum + e.getBoundingClientRect().height, 0) >= 0.5 * height;
  };
  const titleOf = (el) => {
    const t = el.querySelector('h1, h2, h3, h4, .k-card-title, .k-b-title');
    return clip((t && t.textContent) || el.getAttribute('aria-label') || '', 40);
  };
  for (const grid of document.body.querySelectorAll('.k-grid')) {
    if (out.columnHoles.length >= LIMIT) break;
    if (!visible(grid)) continue;
    const cells = [...grid.children].filter((k) => {
      const kc = getComputedStyle(k);
      if (kc.position === 'absolute' || kc.position === 'fixed' || kc.display === 'none' || SKIP_TAG.test(k.tagName)) return false;
      // KF5: a cell that spans several grid rows is tall on purpose (a map or list beside stacked cards): not a hole.
      if (/span/.test(kc.gridRowStart) || /span/.test(kc.gridRowEnd)) return false;
      const r = k.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map((k) => ({ k, r: k.getBoundingClientRect() }));
    const rows = [];
    for (const c of cells) {
      const row = rows.find((x) => Math.abs(x[0].r.top - c.r.top) <= 8);
      if (row) row.push(c); else rows.push([c]);
    }
    for (const row of rows) {
      if (row.length < 2) continue;
      const tall = row.reduce((a, b) => (b.r.bottom > a.r.bottom ? b : a));
      const short = row.reduce((a, b) => (b.r.bottom < a.r.bottom ? b : a));
      const gap = tall.r.bottom - short.r.bottom;
      if (gap <= HOLE) continue;
      // KG1: a blank area is only a hole when it is a large part of the tall card (a third). A narrow rail (at most half as wide as the tall card: an agenda or
      // sidebar beside a time grid, a map, a form, a timeline) is a normal layout when the tall card is content that cannot be shortened. When the tall card is mostly
      // a list or a table (KF4: cap it at about 6 rows) the rail is still a hole. A short WIDE card beside a tall narrow one (A2 D1) is always flagged.
      if (gap <= HOLE_SHARE * tall.r.height) continue;
      if (short.r.width <= 0.5 * tall.r.width && !listShare(tall.k, tall.r.height)) continue;
      const sel = selector(grid) + '|' + Math.round(tall.r.top / 8);
      if (seen.h.has(sel)) continue;
      seen.h.add(sel);
      const info = (c) => ({ selector: selector(c.k), title: titleOf(c.k), height: Math.round(c.r.height), width: Math.round(c.r.width) });
      out.columnHoles.push({ grid: selector(grid), columns: row.length, gap: Math.round(gap), short: info(short), tall: info(tall) });
      if (out.columnHoles.length >= LIMIT) break;
    }
  }
  return out;
}
