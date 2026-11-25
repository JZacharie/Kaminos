// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Turns raw measurements into issues[] / warnings[] (repair instructions for a model that did not write the HTML),
// merges partial re-runs and validates the quality/v<N>.json shape. Pure functions: unit-tested without a browser.
import { createRequire } from 'node:module';
import { DESKTOP_WIDTHS, LAYOUT_WIDTHS, SOFT_WIDTHS, MIN_TABLE_ROWS, MIN_LIST_ITEMS, LIGHTHOUSE_MIN_SCORE, CHECKS, CRITERIA, CRITIC_PASS_MEAN, criticBlockingRounds } from './constants.mjs';

const { compareSeed } = createRequire(import.meta.url)('../seed.js');

export const CHECK_OF_ID = (id) => {
  if (id.startsWith('seed-')) return 'data';
  if (id === 'console-error' || id === 'block-error') return 'console';
  if (id === 'overflow' || id === 'text-wrap' || id === 'broken-word' || id === 'narrow-row' || id === 'header-wrap' || id === 'child-overflow' || id === 'column-hole') return 'overflow';
  if (id === 'network') return 'network';
  if (id === 'lighthouse-a11y') return 'lighthouse';
  if (id === 'data-rows' || id === 'placeholder-text' || id === 'data-route-view') return 'data';
  if (id.startsWith('axe-')) return 'axe';
  if (id.startsWith('critic')) return 'critic';
  return 'console';
};

const AXE_HINTS = {
  'color-contrast': 'raise text contrast to 4.5:1 (3:1 for large text): use the kit tokens (var(--fg), var(--muted), var(--accent-fg) on var(--accent)) instead of custom greys or hex colours',
  'image-alt': 'add a meaningful alt="" text to each <img> (alt="" only for decorative images), or role="img" + aria-label on inline SVG',
  'svg-img-alt': 'give the <svg role="img"> a <title> or aria-label that says what the graphic shows',
  label: 'give every form field a visible <label for="id"> (kit forms: .k-field > label + input), or aria-label when no visible label fits',
  'select-name': 'give the <select> a visible <label for>',
  'button-name': 'give every button text content or aria-label (icon-only buttons need aria-label)',
  'link-name': 'give every link text that makes sense alone (or aria-label)',
  'aria-allowed-attr': 'remove ARIA attributes that the role does not allow',
  'aria-required-children': 'add the required child roles (e.g. role=tablist needs role=tab children)',
  'aria-valid-attr-value': 'fix the ARIA attribute value (ids in aria-labelledby/aria-controls must exist)',
  'aria-hidden-focus': 'remove focusable content from aria-hidden regions (or drop aria-hidden)',
  'duplicate-id': 'make the ids unique (anchors id="a-..." must be unique per page)',
  'duplicate-id-aria': 'make the ids used by ARIA attributes unique',
  'html-has-lang': 'add lang="en" (or the idea language) to <html> via src/head.json "lang"',
  'document-title': 'add a <title> via src/head.json "title"',
  'heading-order': 'do not skip heading levels: one <h1> per screen, then <h2>, then <h3>',
  'page-has-heading-one': 'every screen needs exactly one <h1>',
  'landmark-one-main': 'wrap the screens in one <main id="k-main"> landmark',
  region: 'put all visible content inside landmarks (<header>, <nav>, <main>)',
  'scrollable-region-focusable': 'wrap scrolling tables in .k-table-wrap (tabindex=0 is added by the kit) or remove the overflow',
  'td-headers-attr': 'fix the headers="" ids of the table cells',
  'th-has-data-cells': 'every <th> must head at least one data cell; remove empty header cells',
  'empty-table-header': 'give empty <th> cells visible or sr-only text (.k-sr)',
  'table-duplicate-name': 'caption and summary of the table must differ',
  'frame-title': 'give each iframe a title',
  'list': 'only <li> elements may be direct children of <ul>/<ol>',
  listitem: 'wrap <li> in a <ul> or <ol>',
  'nested-interactive': 'do not put buttons or links inside other buttons or links',
  'target-size': 'make click targets at least 24x24 px (kit buttons already are)',
  'meta-viewport': 'keep <meta name="viewport" content="width=device-width, initial-scale=1> without maximum-scale / user-scalable=no',
};

const routeLabel = (route, screens) => (route ? `${route}${screens && screens[route] ? ` (screen "${screens[route]}")` : ''}` : 'whole prototype');
const px = (w) => `${w}px`;

/** Add an item, merging duplicates that differ only by width or route (keeps the first, notes the others in the message). */
function addMerged(list, index, key, item) {
  const hit = index.get(key);
  if (hit) {
    if (item.width != null && item.width !== hit.item.width && !hit.alsoAt.includes(item.width)) hit.alsoAt.push(item.width);
    if (item.route && item.route !== hit.item.route && !hit.alsoRoutes.includes(item.route)) hit.alsoRoutes.push(item.route);
    return;
  }
  const rec = { item, alsoAt: [], alsoRoutes: [] };
  index.set(key, rec);
  list.push(rec);
}
const finish = (list) => list.map(({ item, alsoAt, alsoRoutes }) => {
  const out = { ...item };
  if (alsoAt.length) out.message += ` Same at ${alsoAt.map(px).join(', ')}.`;
  if (alsoRoutes.length) out.message += ` Same on ${alsoRoutes.join(', ')}.`;
  return out;
});

/**
 * raw: {
 *   routes: [route], screens: {route: screenId},
 *   desktop: { <width>: [passRecord] }, soft: { <width>: [passRecord] }, dark: [passRecord],
 *   staticNet: {urls, patterns}|null, lighthouse: [{route, score, failing, error?}]|null,
 *   softAxeSkipped: bool
 * }, run: Set of check names executed.
 */
export function buildFindings(raw, run) {
  const issues = [];
  const warnings = [];
  const iIdx = new Map();
  const wIdx = new Map();
  const sc = raw.screens || {};
  const widthsDesktop = DESKTOP_WIDTHS.filter((w) => raw.desktop && raw.desktop[w]);
  const iss = (key, item) => addMerged(issues, iIdx, key, item);
  const wrn = (key, item) => addMerged(warnings, wIdx, key, { severity: 'warn', ...item });
  const all = (map, widths) => widths.flatMap((w) => (map && map[w]) || []);

  // ---- console --------------------------------------------------------------------------------------------------
  if (run.has('console')) {
    const seenDesktop = new Set();
    const consoleOf = (rec) => [...rec.pageErrors.map((t) => `uncaught error: ${t}`), ...rec.consoleErrors.map((t) => `console.error: ${t}`)];
    for (const rec of all(raw.desktop, widthsDesktop)) {
      if (rec.error) {
        iss(`console|${rec.route}|load`, { id: 'console-error', check: 'console', severity: 'error', route: rec.route, width: rec.width,
          message: `The page ${routeLabel(rec.route, sc)} failed to load: ${rec.error}. Fix: the prototype must open from prototype.html#route without errors.` });
        continue;
      }
      const msgs = [...new Set(consoleOf(rec))];
      for (const m of msgs) seenDesktop.add(`${rec.route}|${m}`);
      if (msgs.length) {
        const shown = msgs.slice(0, 3).map((m) => `"${m.slice(0, 160)}"`).join('; ');
        iss(`console|${msgs[0]}`, { id: 'console-error', check: 'console', severity: 'error', route: rec.route, width: rec.width,
          message: `${msgs.length} console/page error(s) on ${routeLabel(rec.route, sc)}: ${shown}. Fix: find the script line that throws (undefined variable, missing element id, bad selector in data.js) and correct it; the prototype must log no errors.` });
      }
    }
    for (const rec of all(raw.soft, SOFT_WIDTHS)) {
      const fresh = [...new Set(consoleOf(rec))].filter((m) => !seenDesktop.has(`${rec.route}|${m}`));
      if (fresh.length) wrn(`console|${fresh[0]}`, { id: 'console-error', check: 'console', route: rec.route, width: rec.width,
        message: `Console/page error only at this width on ${routeLabel(rec.route, sc)}: "${fresh[0].slice(0, 160)}".` });
    }
  }

  // ---- blocks that could not be drawn (KF4): the card says "cannot be shown"; without this the gate passed it ------------------
  if (run.has('console')) {
    for (const rec of all(raw.desktop, widthsDesktop)) {
      for (const b of (rec.page && rec.page.blockErrors) || []) {
        const screen = sc && sc[rec.route] ? sc[rec.route] : '<screen>';
        const cfg = b.cfg || b.selector;
        iss(`block-error|${rec.route}|${cfg}|${b.block}`, { id: 'block-error', check: 'console', severity: 'error', route: rec.route, width: rec.width,
          message: `The ${b.block || 'block'} block cannot be shown on ${routeLabel(rec.route, sc)} at ${rec.width}px (config "${cfg}"): ${b.message}. The card shows an error instead of the content. Fix: fix \`${cfg}\` in screens/NN-${screen}.blocks.js or the data field it reads.` });
      }
    }
  }

  // ---- network --------------------------------------------------------------------------------------------------
  if (run.has('network')) {
    const s = raw.staticNet;
    if (s && (s.urls.length || s.patterns.length)) {
      const parts = [];
      if (s.urls.length) parts.push(`URL(s): ${s.urls.slice(0, 4).join(', ')}${s.urls.length > 4 ? ` (+${s.urls.length - 4})` : ''}`);
      if (s.patterns.length) parts.push(`code: ${s.patterns.map((p) => `${p.pattern} x${p.count}`).join(', ')}`);
      iss('network|static', { id: 'network', check: 'network', severity: 'error', route: null, width: null,
        message: `prototype.html uses the network (${parts.join('; ')}). Fix: remove every http(s) URL, fetch/XMLHttpRequest/WebSocket/EventSource, <script src>, @import and external <link>; keep data in src/data.js and graphics as inline SVG. Only the SVG xmlns URI is allowed.` });
    }
    for (const rec of all(raw.desktop, widthsDesktop)) {
      if (rec.blocked.length) iss(`network|rt|${rec.blocked[0]}`, { id: 'network', check: 'network', severity: 'error', route: rec.route, width: rec.width,
        message: `Opening ${routeLabel(rec.route, sc)} requested ${rec.blocked.length} external URL(s) (blocked): ${rec.blocked.slice(0, 3).join(', ')}. Fix: remove the external reference; prototypes must work offline.` });
      if (rec.extraFiles.length) iss(`network|extra|${rec.extraFiles[0]}`, { id: 'network', check: 'network', severity: 'error', route: rec.route, width: rec.width,
        message: `Opening ${routeLabel(rec.route, sc)} requested extra file(s) next to prototype.html: ${[...new Set(rec.extraFiles)].slice(0, 3).join(', ')}. Fix: inline images as SVG or data: URIs; the prototype is one file.` });
    }
  }

  // ---- overflow -------------------------------------------------------------------------------------------------
  if (run.has('overflow')) {
    const make = (rec, soft) => {
      const p = rec.page;
      if (!p || p.scrollWidth <= p.innerWidth) return null;
      const off = p.offenders.map((o) => `${o.selector} (${o.width}px wide, right edge at ${o.right}px${o.inlineWidth ? `, inline width ${o.inlineWidth}` : ''})`).join('; ');
      return { id: 'overflow', check: 'overflow', route: rec.route, width: rec.width,
        message: `Horizontal overflow on ${routeLabel(rec.route, sc)} at ${rec.width}px: the page is ${p.scrollWidth}px wide in a ${p.innerWidth}px viewport.${off ? ` Widest elements: ${off}.` : ''} Fix: remove fixed pixel widths on these (use max-width:100% or the kit grid k-grid + k-span-*), wrap tables in .k-table-wrap, let flex rows wrap (.k-row), and keep long unbroken text in elements with min-width:0.` };
    };
    for (const rec of all(raw.desktop, widthsDesktop)) { const m = make(rec); if (m) iss(`overflow|${rec.route}`, { severity: 'error', ...m }); }
    for (const rec of all(raw.soft, SOFT_WIDTHS)) { const m = make(rec); if (m) wrn(`overflow|${rec.route}`, m); }

    // I-07: a word broken across lines, or a control far taller than its siblings, in a nav/header/button/chip/tab.
    const makeWrap = (rec) => {
      const t = rec.page && rec.page.textWraps;
      if (!t || !t.length) return null;
      const list = t.map((w) => (w.kind === 'word' ? `${w.selector} ("${w.text}": the word "${w.word}" is split across lines)` : `${w.selector} ("${w.text}": ${w.height}px tall, over 1.8x its siblings)`)).join('; ');
      return { id: 'text-wrap', check: 'overflow', route: rec.route, width: rec.width,
        message: `Text wraps inside a control on ${routeLabel(rec.route, sc)} at ${rec.width}px: ${list}. Fix: keep each nav link, button, chip and tab on one line (white-space:nowrap), and let the bar wrap or scroll between items (flex-wrap:wrap on the bar, or overflow-x:auto on the nav), never inside a word.` };
    };
    for (const rec of all(raw.desktop, widthsDesktop)) { const m = makeWrap(rec); if (m) iss(`text-wrap|${rec.route}|${rec.page.textWraps[0].selector}`, { severity: 'error', ...m }); }
    for (const rec of all(raw.soft, SOFT_WIDTHS)) { const m = makeWrap(rec); if (m) wrn(`text-wrap|${rec.route}|${rec.page.textWraps[0].selector}`, m); }

    // B1-T5 layout checks, measured at 1280/1440 (desktop passes) and at 1324/1920 (layout passes). Each finding names the selector.
    const layoutRecs = [...all(raw.desktop, widthsDesktop), ...all(raw.layout, LAYOUT_WIDTHS)].filter((r) => r.layout);
    for (const rec of layoutRecs) {
      const L = rec.layout;
      const where = `${routeLabel(rec.route, sc)} at ${rec.width}px`;
      const wrapped = new Set(((rec.page && rec.page.textWraps) || []).map((w) => w.selector));   // already reported as text-wrap (controls)
      for (const b of L.brokenWords) {
        if (wrapped.has(b.selector)) continue;
        iss(`broken-word|${rec.route}|${b.selector}`, { id: 'broken-word', check: 'overflow', severity: 'error', route: rec.route, width: rec.width,
          message: `A word is broken across lines on ${where}: "${b.word}" in ${b.selector} ("${b.text}"), its box is ${b.boxWidth}px wide inside a ${b.hostWidth}px container. Cause: too many columns for the width, or overflow-wrap:anywhere / word-break:break-all on it or a parent. Fix: never break words; give the row fewer columns or make it responsive (class k-rowfit with k-rowfit-sm|md|lg, or grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))), stack the content in narrow cards (max 3 columns below 480px), and remove overflow-wrap:anywhere / word-break.` });
      }
      for (const n of L.narrowRows) {
        iss(`narrow-row|${rec.route}|${n.selector}`, { id: 'narrow-row', check: 'overflow', severity: 'error', route: rec.route, width: rec.width,
          message: `${n.columns} columns are squeezed into ${n.width}px (${n.columnWidth}px per column, ${n.display}) in ${n.selector} on ${where}, e.g. "${n.sample}". A card narrower than 480px takes at most 3 columns. Fix: replace the fixed column count with the kit class k-rowfit (k-rowfit-sm 7rem, k-rowfit-md 10rem, k-rowfit-lg 15rem per column) or repeat(auto-fit,minmax(min(100%,10rem),1fr)), or turn the columns into a stacked list / k-dl. A strip that is meant to scroll sideways (tabs, timeline) goes in a container with overflow-x:auto; the gate skips scroll containers.` });
      }
      for (const h of L.headerWraps) {
        iss(`header-wrap|${h.selector}`, { id: 'header-wrap', check: 'overflow', severity: 'error', route: rec.route, width: rec.width,
          message: `The top bar ${h.selector} is ${h.height}px tall on ${where}${h.menuButton ? ' and shows the mobile Menu button' : ''}: ${h.navRows > 1 ? `the ${h.links} nav links (${h.labels.join(', ')}) are on ${h.navRows} lines` : h.rows > 1 ? `its items sit on ${h.rows} lines` : 'the bar has one line, but the Menu button must be hidden from 768px (the kit does it with .k-topbar .k-menu-btn; do not restyle .k-btn or .k-menu-btn display)'}. Fix: one line from 1024px: at most 7 nav links with labels of 1-2 words (max 14 characters), white-space:nowrap, no extra items in the bar (move secondary links to a screen), keep the shell.html markup of components/shell.html (the kit hides .k-menu-btn from 768px).` });
      }
      for (const c of L.childOverflow) {
        iss(`child-overflow|${rec.route}|${c.selector}`, { id: 'child-overflow', check: 'overflow', severity: 'error', route: rec.route, width: rec.width,
          message: `Text sticks out of its card on ${where}: ${c.selector} ("${c.text}") ends ${c.over}px outside ${c.card} (${c.cardWidth}px wide). Fix: let the row wrap (k-rowfit or flex-wrap:wrap), give the child min-width:0, or shorten the content; never size columns so the sum is wider than the card.` });
      }
      for (const c of rec.width <= 1440 ? L.columnHoles || [] : []) {   // laptop widths only (1280, 1324, 1440); a 1920 px screen has its own grid
        const nm = (x) => `${x.title ? `"${x.title}" ` : ''}(${x.selector}, ${x.height}px tall, ${x.width}px wide)`;
        iss(`column-hole|${rec.route}|${c.grid}|${c.short.selector}`, { id: 'column-hole', check: 'overflow', severity: 'error', route: rec.route, width: rec.width,
          message: `Empty space beside a taller card on ${where}: ${nm(c.short)} ends ${c.gap}px above ${nm(c.tall)}, side by side in ${c.grid}, so ${c.gap}px of the page below the short card is blank. Cards in one row must end within 200px of each other (or within 35% of the tall card's height when that is more; a narrow sidebar beside a tall block is fine). Fix: easiest, add class \`k-row-fill\` to the grid ${c.grid} (or \`fill:true\` on the short card): the short card then uses the row height, more rows or roomier rows. Or cap the long list to about 6 rows with a View all link, put the short cards in one k-stack column, or move a card below.` });
      }
      for (const s of L.navScroll) {
        wrn(`nav-scroll|${rec.route}|${s.selector}`, { id: 'nav-scroll', check: 'overflow', route: rec.route, width: rec.width,
          message: `The navigation ${s.selector} (${s.links} links) scrolls sideways on ${where}: ${s.hidden}px are out of view. Fix: fewer or shorter nav labels (max 7 links, max 14 characters).` });
      }
    }
  }

  // ---- axe ------------------------------------------------------------------------------------------------------
  if (run.has('axe')) {
    const describe = (v, rec) => {
      const ex = v.examples.map((e) => `${e.target}${e.detail ? ` [${e.detail}]` : ''}`).join('; ');
      const hint = AXE_HINTS[v.id] || `see the axe rule "${v.id}" and fix the listed elements`;
      return `${rec.theme === 'dark' ? '[dark theme] ' : ''}axe rule "${v.id}" (${v.impact}): ${v.help}. ${v.nodes} element(s) on ${routeLabel(rec.route, sc)} at ${rec.width}px, e.g. ${ex}. Fix: ${hint}.`;
    };
    const handle = (rec, blocking) => {
      for (const v of rec.axe || []) {
        const serious = v.impact === 'critical' || v.impact === 'serious';
        const target = (v.examples[0] && v.examples[0].target) || '';
        const key = `axe|${rec.theme}|${v.id}|${target}`;
        if (rec.theme === 'dark' && iIdx.has(`axe|light|${v.id}|${target}`)) continue; // already reported for the light theme
        if (blocking && serious) iss(key, { id: `axe-${v.id}`, check: 'axe', severity: v.impact, route: rec.route, width: rec.width, message: describe(v, rec) });
        else if (blocking || serious) wrn(`${key}|w`, { id: `axe-${v.id}`, check: 'axe', route: rec.route, width: rec.width, message: describe(v, rec) });
      }
    };
    for (const rec of all(raw.desktop, widthsDesktop)) handle(rec, true);
    for (const rec of raw.dark || []) handle(rec, true);
    for (const rec of all(raw.soft, SOFT_WIDTHS)) handle(rec, false);
    if (raw.softAxeSkipped) wrn('axe|skipped', { id: 'axe-skipped', check: 'axe', route: null, width: null,
      message: 'axe at 768/375 px was skipped for some routes because the 45 s budget was used up by the blocking checks.' });
  }

  // ---- data -----------------------------------------------------------------------------------------------------
  if (run.has('data')) {
    const base = (raw.desktop && (raw.desktop[1280] || raw.desktop[widthsDesktop[0]])) || [];
    for (const rec of base) {
      const p = rec.page;
      if (!p) continue;
      for (const t of p.tables) if (t.rows < MIN_TABLE_ROWS && !(t.canon && t.rows >= 1)) iss(`data|t|${rec.route}|${t.selector}`, { id: 'data-rows', check: 'data', severity: 'error', route: rec.route, width: rec.width,
        message: `Table ${t.selector}${t.label ? ` ("${t.label}")` : ''} on ${routeLabel(rec.route, sc)} has ${t.rows} body row(s), needs at least ${MIN_TABLE_ROWS}. Fix: generate ${MIN_TABLE_ROWS}-60 realistic rows in src/data.js with the seed helpers (data-template.md) and fill the tbody with fill().` });
      for (const l of p.lists) if (l.items < MIN_LIST_ITEMS && !(l.canon && l.items >= 1)) iss(`data|l|${rec.route}|${l.selector}`, { id: 'data-rows', check: 'data', severity: 'error', route: rec.route, width: rec.width,
        message: `List ${l.selector}${l.label ? ` ("${l.label}")` : ''} on ${routeLabel(rec.route, sc)} has ${l.items} item(s), needs at least ${MIN_LIST_ITEMS}. Fix: add realistic domain items (generate them in src/data.js).` });
      const rv = p.routeView;
      if (rv && rv.total > 1 && rec.route.startsWith('#/')) {
        const seg = (r) => r.split('/').slice(0, 2).join('/');
        const own = rv.visible.some((v) => v === rec.route || seg(v) === seg(rec.route));
        if (!own) iss(`data|v|${rec.route}`, { id: 'data-route-view', check: 'data', severity: 'error', route: rec.route, width: rec.width,
          message: `Opening ${routeLabel(rec.route, sc)} (${rec.route}) shows ${rv.visible.length ? `the section ${rv.visible.join(', ')}` : 'no screen'} instead of its own section. Fix: the kit router skips every <section data-route> that has aria-hidden="true", so remove hidden and aria-hidden from the screen sections (the router hides the inactive ones itself) and check that data-route equals the screen route of ui-map.json.` });
      }
      if (p.placeholders.length) {
        const shown = p.placeholders.slice(0, 5).map((h) => `"${h.text}" in ${h.selector} (${h.label})`).join('; ');
        iss(`data|p|${rec.route}`, { id: 'placeholder-text', check: 'data', severity: 'error', route: rec.route, width: rec.width,
          message: `Placeholder text on ${routeLabel(rec.route, sc)}: ${shown}${p.placeholders.length > 5 ? ` (+${p.placeholders.length - 5} more)` : ''}. Fix: replace it with realistic domain data (names, places, dates, amounts that fit the idea).` });
      }
    }
  }

  // ---- seed fidelity (B1-T5b): the page against the canonical seed of the app (check `data`) --------------------------
  if (run.has('data') && raw.seed) {
    if (raw.seed.error || !raw.seed.state) {
      wrn('seed|unavailable', { id: 'seed-unavailable', check: 'data', route: null, width: null, message: `The seed-fidelity pass could not read the page: ${raw.seed.error || 'no state'}.` });
    } else {
      for (const f of compareSeed(raw.seed.seed, raw.seed.state)) {
        iss(`seed|${f.key}`, { id: f.id, check: 'data', severity: 'error', route: null, width: 1280, message: `Canonical seed (${raw.seed.seed.app}): ${f.message}` });
      }
    }
  }

  // ---- lighthouse -----------------------------------------------------------------------------------------------
  if (run.has('lighthouse') && raw.lighthouse) {
    for (const r of raw.lighthouse) {
      if (r.error || r.score === null) {
        iss(`lh|${r.route}`, { id: 'lighthouse-a11y', check: 'lighthouse', severity: 'error', route: r.route, width: 1280,
          message: `Lighthouse could not score ${routeLabel(r.route, sc)}: ${r.error || 'no accessibility score'}. Fix: make sure the page loads without errors; then re-run the gate.` });
      } else if (r.score < LIGHTHOUSE_MIN_SCORE) {
        const fails = r.failing.slice(0, 5).map((f) => `${f.id} (${f.nodes} element(s)${f.examples[0] && f.examples[0].selector ? `, e.g. ${f.examples[0].selector}` : ''})`).join('; ');
        iss(`lh|${r.route}`, { id: 'lighthouse-a11y', check: 'lighthouse', severity: 'error', route: r.route, width: 1280,
          message: `Lighthouse accessibility score ${r.score} on ${routeLabel(r.route, sc)} (desktop preset), needs at least ${LIGHTHOUSE_MIN_SCORE}. Failing audits: ${fails || 'none listed'}. Fix: ${r.failing.slice(0, 3).map((f) => AXE_HINTS[f.id] || f.title).join('; ') || 'fix the listed audits'}.` });
      }
    }
  }

  return { issues: finish(issues), warnings: finish(warnings) };
}

// ---- vision critic -> issues --------------------------------------------------------------------------------------
// A28: the critic blocks only in rounds 1..criticBlockingRounds() (2; more with AIDLC_GATE_MAX_ROUNDS, every round when unlimited) (critic.round = calls on the same quality/v<N>.json).
const criticBlocks = (critic) => !(Number.isInteger(critic.round) && critic.round > criticBlockingRounds());

export function criticIssues(critic) {
  if (!critic || critic.error || !critic.scores) return [];
  // A critic that PASSES (mean >= CRITIC_PASS_MEAN, no score below 3) is not a blocking finding: scores of 3 become hints (criticHints).
  if (critic.pass) return [];
  // After round CRITIC_BLOCKING_ROUNDS the critic only advises (criticHints).
  if (!criticBlocks(critic)) return [];
  const issues = [];
  const low = CRITERIA.filter((c) => critic.scores[c] <= 3);
  const list = low.length ? low : [CRITERIA.reduce((a, b) => (critic.scores[b] < critic.scores[a] ? b : a))];
  for (const c of list) {
    const reason = (critic.reasons && critic.reasons[c]) || '';
    const fix = (critic.fixes && critic.fixes[c]) || '';
    issues.push({ id: `critic-${c}`, check: 'critic', severity: 'error', route: null, width: null,
      message: `Vision review: ${c} scored ${critic.scores[c]}/5 (mean ${critic.mean.toFixed(2)}, needs mean >= ${CRITIC_PASS_MEAN} and no score below 3). ${reason}${fix ? ` Fix: ${fix}` : ''}`.trim() });
  }
  return issues;
}

/**
 * Non-blocking hints: every criterion scored 3 or lower when the critic passed, or when it failed in a round where it no longer blocks.
 * A failing, non-blocking critic also gets one `critic-nonblocking` warning.
 */
export function criticHints(critic) {
  if (!critic || critic.error || !critic.scores) return [];
  const advisory = !critic.pass && !criticBlocks(critic);
  if (!critic.pass && !advisory) return [];
  const why = critic.pass ? `the critic passed with mean ${critic.mean.toFixed(2)}` : `round ${critic.round} no longer blocks; mean ${critic.mean.toFixed(2)}`;
  const low = CRITERIA.filter((c) => critic.scores[c] <= 3);
  const hints = low.map((c) => ({
    id: `critic-hint-${c}`, check: 'critic', severity: 'warn', route: null, width: null,
    message: `Vision review hint (not blocking, ${why}): ${c} scored ${critic.scores[c]}/5. ${(critic.reasons && critic.reasons[c]) || ''}${(critic.fixes && critic.fixes[c]) ? ` Fix: ${critic.fixes[c]}` : ''}`.trim(),
  }));
  if (advisory) hints.unshift({ id: 'critic-nonblocking', check: 'critic', severity: 'warn', route: null, width: null,
    message: `Vision review did not pass (mean ${critic.mean.toFixed(2)}, needs ${CRITIC_PASS_MEAN}) but it is round ${critic.round} and the critic blocks only in rounds 1-${criticBlockingRounds()}; the gate does not wait for it.` });
  return hints;
}

// ---- merge, summarise, validate -----------------------------------------------------------------------------------
/** Combine fresh findings with a previous report for the checks that were not re-run. */
/**
 * UE6-02: a critic verdict kept by a `--only` run (critic not re-run) judged the prototype the critic saw (critic.prototypeSha). When the prototype
 * changed since (a repair round followed the verdict, as the stage text prescribes: one critic round, then deterministic checks only) the verdict
 * is out of date: it must not keep failing quality/v<N>.json forever. A verdict without a recorded build, or on an unchanged prototype, still blocks.
 */
export function criticVerdictOutdated(previous, currentSha) {
  const c = previous && previous.critic;
  return !!(c && !c.error && typeof c.prototypeSha === 'string' && c.prototypeSha && currentSha && c.prototypeSha !== currentSha);
}

export function mergeWithPrevious({ run, fresh, freshChecks, previous, all, currentSha = null }) {
  const issues = [...fresh.issues.map((i) => ({ ...i }))];
  const warnings = [...fresh.warnings.map((w) => ({ ...w }))];
  const checks = {};
  for (const name of all) {
    if (run.has(name)) { checks[name] = { ...freshChecks[name], rerun: true }; continue; }
    if (name === 'critic' && criticVerdictOutdated(previous, currentSha) && !(freshChecks[name] && freshChecks[name].skipped)) {
      checks[name] = { pass: null, rerun: false, outdated: true };
      const c = previous.critic;
      if (c.pass === false) warnings.push({ id: 'critic-outdated', check: 'critic', severity: 'warn', route: null, width: null,
        message: `The vision review (round ${c.round ?? '?'}, mean ${typeof c.mean === 'number' ? c.mean.toFixed(2) : '?'}) judged an earlier build; the prototype changed since and was not reviewed again, so that verdict no longer blocks. Run quality-gate --critic to review the current build.` });
      continue;
    }
    const prevCheck = previous && previous.checks && previous.checks[name];
    checks[name] = prevCheck ? { ...prevCheck, rerun: false } : { pass: null, rerun: false };
    if (freshChecks[name] && freshChecks[name].skipped) checks[name] = { ...checks[name], skipped: freshChecks[name].skipped, rerun: false };
    if (previous) {
      for (const i of previous.issues || []) if ((i.check || CHECK_OF_ID(i.id)) === name) issues.push({ ...i, check: name, rerun: false });
      for (const w of previous.warnings || []) if ((w.check || CHECK_OF_ID(w.id)) === name) warnings.push({ ...w, check: name, rerun: false });
    }
  }
  const order = (x) => CHECKS.indexOf(x.check || CHECK_OF_ID(x.id));
  issues.sort((a, b) => order(a) - order(b));
  warnings.sort((a, b) => order(a) - order(b));
  return { issues, warnings, checks };
}

export function validateReport(r) {
  const errs = [];
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(r)) return ['report is not an object'];
  if (!Number.isInteger(r.version) || r.version < 1) errs.push('version must be an integer >= 1');
  if (typeof r.pass !== 'boolean') errs.push('pass must be boolean');
  if (!isObj(r.checks)) errs.push('checks must be an object');
  for (const key of ['issues', 'warnings']) {
    if (!Array.isArray(r[key])) { errs.push(`${key} must be an array`); continue; }
    r[key].forEach((it, n) => {
      if (!isObj(it)) { errs.push(`${key}[${n}] not an object`); return; }
      if (typeof it.id !== 'string' || !it.id) errs.push(`${key}[${n}].id`);
      if (typeof it.severity !== 'string') errs.push(`${key}[${n}].severity`);
      if (!(it.route === null || typeof it.route === 'string')) errs.push(`${key}[${n}].route`);
      if (!(it.width === null || Number.isInteger(it.width))) errs.push(`${key}[${n}].width`);
      if (typeof it.message !== 'string' || !it.message) errs.push(`${key}[${n}].message`);
      if (key === 'warnings' && it.severity !== 'warn') errs.push(`warnings[${n}].severity must be "warn"`);
    });
  }
  if (r.pass !== (Array.isArray(r.issues) && r.issues.length === 0)) errs.push('pass must equal (issues.length === 0)');
  if (r.critic !== null && r.critic !== undefined) {
    if (!isObj(r.critic)) errs.push('critic must be null or an object');
    else if (!r.critic.error) {
      if (!isObj(r.critic.scores) || CRITERIA.some((c) => !Number.isInteger(r.critic.scores[c]) || r.critic.scores[c] < 1 || r.critic.scores[c] > 5)) errs.push('critic.scores must hold the 6 criteria as integers 1-5');
      for (const k of ['mean', 'costUsd']) if (typeof r.critic[k] !== 'number') errs.push(`critic.${k} must be a number`);
      if (typeof r.critic.pass !== 'boolean') errs.push('critic.pass must be boolean');
      if (typeof r.critic.model !== 'string') errs.push('critic.model must be a string');
    } else if (typeof r.critic.error !== 'string') errs.push('critic.error must be a string');
  }
  if (!Number.isInteger(r.durationMs) || r.durationMs < 0) errs.push('durationMs must be an integer >= 0');
  return errs;
}

export function summaryLines({ report, quiet = false }) {
  const lines = [];
  for (const i of report.issues) lines.push(`ISSUE ${i.id} ${i.severity} ${i.route ?? '-'} ${i.width ?? '-'} ${i.message}`);
  for (const w of report.warnings) lines.push(`WARN ${w.id} ${w.route ?? '-'} ${w.width ?? '-'} ${w.message}`);
  lines.push(report.pass ? 'QUALITY PASS' : `QUALITY FAIL (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})`);
  return quiet ? [lines[lines.length - 1]] : lines;
}
