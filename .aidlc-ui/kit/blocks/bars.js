/* @block bars 1.0 -- Category bars (horizontal list or vertical columns), single or stacked, with the numbers printed. Shows the values it is given; never sums or rounds for you.
 * Use for: delays by cause, shipments by status (SpudTrack); month cost by tariff band, last 7 sessions (EV Fleet); incidents by stage, rider items by state (Stagehand).
 * Pick: Compare categories or a split (delays by cause, jobs by status); horizontal or stacked, values printed, forecast hatched.
 * Load: blocks.css, core.js, bars.css, bars.js
 * Call: K.block.bars('#a-causes', {items: [{label: 'Border queue', value: 6}, {label: 'Port congestion', value: 5}], total: 23, unit: 'delays'})
 * Config:
 *   items       array, required  [{label, value?, parts?, status?, cat?, href?, total?}]
 *     label     text, required   category name; long names get ellipsis + title (h) or wrap on spaces into 2 lines (v); in v the label and the value are HTML text under/over the column
 *     value     number           the bar length; printed as given (dp, unit and prefix applied). null = no bar, shows "-"
 *     parts     array            stacked bar [{name, value, cat?, status?, style?}] instead of value; one legend entry per part name. style:'forecast' = hatched (estimate, not a measurement); its legend swatch is hatched too
 *     total     text|number      printed at the end of a stacked bar, verbatim (never the sum of the parts)
 *     style     'forecast'       on an item with a value (not parts): the bar is hatched
 *     status    ok|warn|crit|info|neutral (or aliases)  colours this bar with the status colour; otherwise cat, otherwise the theme accent
 *     cat       number|string    colour key shared with the other blocks (same key, same colour)
 *     href      string           the label becomes a link (e.g. "#/alerts?cause=customs")
 *   orientation 'h'|'v', default 'h'  h = label, bar, value per row (best for long names); v = columns on a value axis (short names, time order)
 *   unit, prefix text            unit after the value ("kWh", "%", "delays"), prefix before it ("£")
 *   dp          number           decimals printed (default: as given, at most 2)
 *   total       text|number      overall total shown under the bars, verbatim. Checked against the sum of the bars: a mismatch logs ONE console.warn
 *   totalLabel  text, default "Total"
 *   sort        'none'|'desc'|'asc', default none   by bar length (parts: by the sum of the parts, for ordering only)
 *   max         number           bar scale maximum (default: the longest bar); use it to compare several charts
 *   limit       number, default 60   show at most this many bars, then a "+ N more" line
 *   height      number, default 240  v only: chart height in px
 *   now         {at, label?}     v only: a divider at the left edge of the category `at` (its label, or its index), e.g. {at:'09', label:'Now 08:30'}: left = measured, right = forecast
 *   legend      boolean          default: shown for stacked bars
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no items), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] bars: load core.js before bars.js'); return; }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var isNum = function (v) { return typeof v === 'number' && isFinite(v); };
  var warned = {}, fcN = 0;
  K.block.define('bars', {
    version: '1.0', fill: true, resize: true, emptyText: 'Nothing to count yet',
    schema: {
      items: { type: 'array', required: true, of: {
        label: { type: 'text', required: true }, value: { type: 'number' }, status: { type: 'string' }, cat: { type: 'any' }, href: { type: 'string' }, total: { type: 'text' }, style: { type: 'string' },
        parts: { type: 'array', of: { name: { type: 'text', required: true }, value: { type: 'number', required: true }, cat: { type: 'any' }, status: { type: 'string' }, style: { type: 'string' } } } } },
      now: { type: 'object' },
      orientation: { type: 'string', enum: ['h', 'v'], default: 'h' }, unit: { type: 'text' }, prefix: { type: 'text' }, dp: { type: 'number' },
      total: { type: 'text' }, totalLabel: { type: 'text', default: 'Total' }, sort: { type: 'string', enum: ['none', 'desc', 'asc'], default: 'none' },
      max: { type: 'number' }, limit: { type: 'number', default: 60 }, height: { type: 'number', default: 240 }, legend: { type: 'boolean' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var cw = (function () { try { var q = getComputedStyle(el); return el.clientWidth - (parseFloat(q.paddingLeft) || 0) - (parseFloat(q.paddingRight) || 0); } catch (e) { return el.clientWidth; } })(), W = Math.max(240, cw || 560), /* content width: a card without a title pads the block element itself */ FF = (function () { try { return getComputedStyle(el).fontFamily; } catch (e) { return 'system-ui'; } })() || 'system-ui';
      var fmt = function (v) { return isNum(v) ? (c.prefix != null ? c.prefix : '') + h.num(v, { dp: c.dp, unit: c.unit }) : '\u2013'; };
      var sizeOf = function (it) { return it.parts && it.parts.length ? it.parts.reduce(function (s, p) { return s + Math.max(0, p.value); }, 0) : isNum(it.value) ? Math.max(0, it.value) : 0; };
      var rows = c.items.map(function (it, i) { return { it: it, i: i, size: sizeOf(it) }; });
      /* the total is shown verbatim; a mismatch with the bars is logged once, never "fixed" */
      var totalTxt = null;
      if (c.total != null && c.total !== '') {
        totalTxt = typeof c.total === 'number' ? fmt(c.total) : String(c.total);
        var tv = typeof c.total === 'number' ? c.total : /^\s*-?\d+(\.\d+)?\s*$/.test(c.total) ? +c.total : NaN, sum = rows.reduce(function (s, r) { return s + (isNum(r.it.value) ? r.it.value : r.size); }, 0);
        var msg = '[K.block] bars: total ' + c.total + ' differs from the sum of the bars (' + r1(sum * 100) / 100 + ')';
        if (isFinite(tv) && Math.abs(tv - sum) > 1e-6 + Math.abs(tv) * 1e-9 && !warned[msg]) { warned[msg] = 1; console.warn(msg); }
      }
      if (c.sort !== 'none') rows.sort(function (a, b) { return (c.sort === 'asc' ? a.size - b.size : b.size - a.size) || a.i - b.i; });
      var lim = Math.max(1, c.limit | 0 || 60), more = rows.length > lim ? rows.length - lim : 0;
      if (more) rows = rows.slice(0, lim);
      var max = isNum(c.max) && c.max > 0 ? c.max : Math.max.apply(null, rows.map(function (r) { return r.size; }).concat([0])) || 1;
      var colOf = function (o, i) {
        if (o.status) { var k = h.statusKind(o.status); return 'var(--k-' + (k === 'crit' ? 'crit' : k) + ')'; }
        if (typeof o.cat === 'number') return h.cat(o.cat);
        if (o.cat != null && o.cat !== '') return h.catFor(o.cat);
        return 'var(--k-accent)'; /* one series, no status or category: the theme accent */
      };
      var partCol = function (p) { return p.status || p.cat != null ? colOf(p) : h.catFor(p.name); };
      var stacked = rows.some(function (r) { return r.it.parts && r.it.parts.length; });
      var tip = function (it) { return String(it.label) + (it.parts && it.parts.length ? ': ' + it.parts.map(function (p) { return p.name + ' ' + fmt(p.value); }).join(', ') : ': ' + fmt(it.value)); };
      var valTxt = function (it) { return it.parts && it.parts.length ? (it.total != null ? String(it.total) : '') : fmt(it.value); };
      var fc = function (p, it) { return (p.style || it.style) === 'forecast'; };
      var legend = function () {
        if (!(c.legend != null ? c.legend : stacked)) return null;
        var seen = {}, out = [];
        rows.forEach(function (r) { (r.it.parts || []).forEach(function (p) { var n = String(p.name); if (!seen[n]) { seen[n] = 1; out.push(h.el('span', { title: n }, [h.el('i', { class: fc(p, r.it) ? 'k-bars-fc' : null, style: { '--sw': partCol(p) } }), n])); } }); });
        return out.length ? h.el('div', { class: 'k-b-legend' }, out) : null;
      };
      var foot = function () {
        var kids = [];
        if (more) kids.push(h.el('p', { class: 'k-bars-more', text: '+ ' + more + ' more' }));
        if (totalTxt != null) kids.push(h.el('div', { class: 'k-bars-total' }, [h.el('span', { text: c.totalLabel }), h.el('strong', { class: 'k-b-num', text: totalTxt, title: totalTxt })]));
        return kids;
      };

      if (c.orientation !== 'v') {
        var narrow = W < 420, F13 = '13px ' + FF, F13b = '600 13px ' + FF;
        var lw = clamp(Math.max.apply(null, rows.map(function (r) { return h.measureText(String(r.it.label), F13); })) + 6, 72, narrow ? W : Math.min(220, W * 0.4));
        var vw = Math.max(24, Math.max.apply(null, rows.map(function (r) { return h.measureText(valTxt(r.it), F13b); })) + 4);
        var ul = h.el('ul', { class: 'k-bars' + (narrow ? ' k-bars-narrow' : ''), style: { '--k-bars-lw': r1(lw) + 'px', '--k-bars-vw': r1(vw) + 'px' } });
        rows.forEach(function (r) {
          var it = r.it, parts = it.parts && it.parts.length ? it.parts : null, track = h.el('div', { class: 'k-bars-track' });
          if (parts) parts.forEach(function (p) {
            var pct = Math.max(0, p.value) / max * 100, px = pct / 100 * (narrow ? W : Math.max(60, W - lw - vw - 24)), col = partCol(p), txt = fmt(p.value);
            track.appendChild(h.el('span', { class: 'k-bars-seg' + (fc(p, it) ? ' k-bars-fc' : ''), style: { flex: '0 0 ' + r1(pct) + '%', '--bc': col }, title: p.name + ': ' + txt }, px >= h.measureText(txt, F13) + 12 ? h.el('span', { text: txt }) : null));
          });
          else if (r.size > 0) track.appendChild(h.el('span', { class: 'k-bars-fill' + (fc(it, it) ? ' k-bars-fc' : ''), style: { width: 'max(3px,' + r1(r.size / max * 100) + '%)', '--bc': colOf(it) }, title: tip(it) }));
          var name = h.line(it.label);
          ul.appendChild(h.el('li', { class: 'k-bars-row', title: tip(it) }, [
            it.href ? h.el('a', { class: 'k-bars-label', href: it.href }, name) : h.el('span', { class: 'k-bars-label' }, name),
            track, h.el('span', { class: 'k-bars-val k-b-num', text: valTxt(it) })]));
        });
        el.appendChild(ul);
        if (h.fill === 'grow') h.fit(h.padFit(ul, 28));
        var lg = legend(); if (lg) { lg.classList.add('k-bars-lg-tint'); el.appendChild(lg); }
        foot().forEach(function (f) { el.appendChild(f); });
        return;
      }

      /* ---- vertical columns (svg, 1:1 pixels) ---- */
      var TF = '11px ' + FF, tw = function (t) { return h.measureText(String(t), TF); }, n = rows.length, HT = clamp(c.height | 0 || 240, 140, 600);
      var allInt = rows.every(function (r) { return r.size % 1 === 0; });
      var tk = h.niceTicks(0, max, 4, { integer: allInt && max <= 8 }), ts = [].slice.call(tk);
      var hi = isNum(c.max) && c.max > 0 ? c.max : ts[ts.length - 1];
      ts = ts.filter(function (v) { return v <= hi + 1e-9; });
      var dp = (function () { var t = String(+tk.step.toFixed(6)).split('.')[1]; return t ? t.length : 0; })();
      var tl = ts.map(function (v) { return h.num(v, { dp: dp }); }), L = Math.max.apply(null, tl.map(tw)) + 14, R = 8, nw = c.now && typeof c.now === 'object' ? c.now : null, nIx = nw ? (typeof nw.at === 'number' ? nw.at : rows.map(function (r) { return String(r.it.label); }).indexOf(String(nw.at))) : -1, T = (c.unit ? 32 : 22) + (nw && nw.label && nIx > 0 ? 16 : 0);
      var pw = Math.max(60, W - L - R), slot = pw / n, bw = clamp(slot * 0.55, 3, 96); /* the plot always spans the card; wide slots get wider (capped) columns */
      /* x labels: one line if it fits, else two lines split on a space, else ellipsis on the second line; very narrow slots keep every k-th label */
      var cut = function (s, w) { if (tw(s) <= w) return s; while (s.length > 1 && tw(s + '\u2026') > w) s = s.slice(0, -1); return s + '\u2026'; };
      var every = 1, lines;
      if (slot < 40) { /* many columns: every k-th label, one line, as wide as k slots */
        every = Math.ceil((Math.min(110, Math.max.apply(null, rows.map(function (r) { return tw(r.it.label); }))) + 8) / slot);
        lines = rows.map(function (r, i) { return [cut(String(r.it.label), Math.min(every * slot - 8, W - 4 - (L + slot * (i + 0.5) - bw / 2)))]; });
      } else lines = rows.map(function (r) {
        var s = String(r.it.label), w = slot - 6;
        if (tw(s) <= w) return [s];
        var parts = s.split(' '), best = null;
        for (var k = 1; k < parts.length; k++) { var a = parts.slice(0, k).join(' '), b = parts.slice(k).join(' '); if (tw(a) <= w && (!best || Math.max(tw(a), tw(b)) < Math.max(tw(best[0]), tw(best[1])))) best = [a, b]; }
        if (best) return [best[0], cut(best[1], w)];
        return [cut(s, w)];
      });
      var two = lines.some(function (l, i) { return l.length > 1 && i % every === 0; });
      var B = two ? 44 : 30, ph = Math.max(60, HT - T - B), pb = T + ph, pl = L;
      var Y = function (v) { return pb - v / hi * ph; };
      /* axis, grid and columns are svg; category labels and values are HTML text laid over it (real text: wraps like text, copies, is read by extractors) */
      var wrap = h.el('div', { class: 'k-barsv', style: { width: W + 'px', height: HT + 'px' } }), tx = h.el('ol', { class: 'k-barsv-t' });
      var svg = wrap.appendChild(h.svg('svg', { class: 'k-bars-svg', width: W, height: HT, viewBox: '0 0 ' + W + ' ' + HT, role: 'img', 'aria-label': (c.title != null ? c.title + ': ' : 'Bars: ') + n + ' categories' }));
      wrap.appendChild(tx);
      var defs = svg.appendChild(h.svg('defs')), pats = {};
      var hatch = function (col) { /* hatched fill for a forecast column: 45 degree stripes of the series colour on a pale ground */
        if (!pats[col]) { var id = 'k-fc-' + (++fcN); pats[col] = id; defs.appendChild(h.svg('pattern', { id: id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [h.svg('rect', { width: 6, height: 6, style: { fill: 'color-mix(in srgb,' + col + ' 14%,var(--k-surface))' } }), h.svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, style: { stroke: col, 'stroke-width': 2.5 } })])); }
        return 'url(#' + pats[col] + ')';
      };
      ts.forEach(function (v, i) {
        var y = r1(Y(v));
        svg.appendChild(h.svg('line', { class: i ? 'k-b-grid' : 'k-bars-base', x1: pl, x2: pl + pw, y1: y, y2: y }));
        svg.appendChild(h.svg('text', { class: 'k-b-tick', x: pl - 8, y: r1(y + 3.5), 'text-anchor': 'end' }, tl[i]));
      });
      if (c.unit) svg.appendChild(h.svg('text', { class: 'k-b-tick k-ser-unit', x: Math.min(pl - 8, W - 2), y: 12, 'text-anchor': tw(c.unit) > L - 6 ? 'start' : 'end' }, c.unit));
      rows.forEach(function (r, i) {
        var it = r.it, cx = pl + slot * (i + 0.5), x0 = cx - bw / 2, g = h.svg('g', {}, h.svg('title', {}, tip(it))), y = pb, li = h.el('li', { class: 'k-barsv-c', title: tip(it) });
        var segs = it.parts && it.parts.length ? it.parts.map(function (p) { return { v: Math.max(0, p.value), col: partCol(p), fc: fc(p, it) }; }) : isNum(it.value) ? [{ v: Math.max(0, it.value), col: colOf(it), fc: fc(it, it) }] : [];
        segs.forEach(function (s) {
          var hh = s.v / hi * ph; if (hh <= 0) return;
          g.appendChild(h.svg('rect', { class: 'k-bars-col', x: r1(x0), y: r1(y - hh), width: r1(bw), height: r1(Math.max(hh, 1)), rx: 2, style: s.fc ? { '--bc': s.col, fill: hatch(s.col), stroke: s.col, 'stroke-width': 1 } : { '--bc': s.col } }));
          y -= hh;
        });
        svg.appendChild(g);
        if (i % every === 0) {
          var ln = lines[i], endA = every > 1 && cx - bw / 2 + Math.min(tw(it.label), 110) > W - 4, ax = every > 1 ? (endA ? cx + bw / 2 : cx - bw / 2) : cx, skipL = false;
          if (endA) { var pv = i - every, pe = pv >= 0 ? L + slot * (pv + 0.5) - bw / 2 + Math.min(tw(rows[pv].it.label), every * slot - 8) : -1e9; skipL = ax - tw(it.label) < pe + 6; ln = [cut(String(it.label), 110)]; }
          if (!skipL) {
            var lw2 = every > 1 ? Math.ceil(Math.max.apply(null, ln.map(tw))) + 2 : slot - 6, st2 = { top: pb + 6 + 'px', width: lw2 + 'px', left: r1(every > 1 ? (endA ? ax - lw2 : ax) : cx - lw2 / 2) + 'px', 'text-align': every > 1 ? (endA ? 'right' : 'left') : 'center' };
            /* the lines are inline pieces with a real space between them: the label reads "Border queue" in the DOM whatever the wrap */
            var kids = []; ln.forEach(function (t, j) { if (j) kids.push(' '); kids.push(h.el('span', { class: 'k-barsv-ln', text: t })); });
            li.appendChild(h.el(it.href ? 'a' : 'span', { class: 'k-barsv-l', href: it.href || null, title: String(it.label), style: st2 }, kids));
          }
        }
        var vt = valTxt(it);
        if (vt && tw(vt) + 4 <= Math.max(slot, bw) && y - 4 > 12) li.appendChild(h.el('span', { class: 'k-barsv-v k-b-num', text: vt, style: { top: r1(y - 18) + 'px', left: r1(cx - slot / 2) + 'px', width: r1(slot) + 'px' } }));
        tx.appendChild(li);
      });
      if (nw && nIx > 0 && nIx < n) { /* measured | forecast divider on the left edge of category nIx; its label sits above the plot, on the side with room */
        var nx = r1(pl + slot * nIx);
        svg.appendChild(h.svg('line', { class: 'k-bars-now', 'data-k-avoid': '', x1: nx, x2: nx, y1: T - 4, y2: pb }));
        if (nw.label) { var nlw = Math.ceil(h.measureText(String(nw.label), '600 11px ' + FF)) + 10, left = nx + 4 + nlw <= W ? nx + 4 : nx - 4 - nlw; wrap.appendChild(h.el('span', { class: 'k-barsv-now', style: { left: left + 'px', top: '0px', width: nlw + 'px' }, text: String(nw.label) })); }
      }
      el.appendChild(wrap);
      var lg2 = legend(); if (lg2) el.appendChild(lg2);
      foot().forEach(function (f) { el.appendChild(f); });
    }
  });
})();
