/* @block lanes 1.0 -- lane timeline: one row per resource on a shared time axis (set slots, shifts, charging sessions).
 * Use for: Stagehand lineup (stage lanes, sets, curfews, now) and crew shifts; EV Fleet charging plan (charger lanes, sessions per van, tariff bands).
 * Pick: Work over time, one row per resource (lineup, shifts, charging plan, beds by bay); now/curfew lines, bands, groups.
 * Load: blocks.css, core.js, lanes.css, lanes.js
 * Call: K.block.lanes('#a-lineup', {start:'14:00', end:'02:00', lanes:[{id:'A',label:'Lighthouse'}], items:[{id:'AR-09',lane:'A',start:'23:00',end:'00:00',label:'Lumen Fray'}]})
 * Config:
 *   start, end  text            axis range as times; end earlier than start = next day ("14:00" to "02:00"). Leave both out and the axis fits the slots (rounded out to half hours, plus a margin each side)
 *   fit         'data'          with start/end given: still trim the axis to the slots (inside start/end); without it start/end are pinned
 *   emptyLaneText text, default 'No sessions'  quiet marker in a lane without slots ('' = none; not shown in off lanes)
 *   lanes       array [{id, label, sub?, off?}] one row each (sub = small second line; off = unavailable, hatched). Give lanes or groups
 *   groups      array [{label, sub?, lanes[]}] instead of lanes: a header band per group (a ward's bays), lane rows under it, 28 px rows by default (44 beds + 8 headers in about 1.5 screens); the lane names and group headers stay at the left while the plot scrolls
 *   items       array, default [] [{id, lane, start, end, label, sub?, short?, status?, statusText?, cat?|catKey?, href?}]
 *     start/end text, required  times; end earlier than start = next day; a slot may start before the axis (clipped)
 *     label     text, required  full name when it fits, else a chip beside the slot (colour of the slot, short leader) if free, else whole words + "...", else cut + "...", else initials, else short (the app's id) last; aria-label and tooltip have everything
 *     sub       text            second line instead of the time range (range goes to the tooltip). Second lines are shown whole or not at all, never cut or wrapped
 *     status    text            ok|warn|crit|info|neutral or an app word; warn/crit/info get a dot, statusText is the detail (tooltip, second line)
 *     cat, catKey  text|number  colour group, same key = same colour in every block; the legend lists up to 8
 *   bands       array           [{start, end, label?, tone?}] shaded time ranges with a label strip above the plot (tariff); tone = status kind
 *   markers     array           [{time, label?, kind:'now'|'curfew'|'limit', lane?}] vertical lines; without lane they cross every lane and get a flag
 *                               above the lanes. Text is never drawn over a line: a slot a line crosses puts its label on the wider side.
 *   legendLabels object             {crit, warn, info}: the word the legend shows for each status kind (default: the commonest app word in status, else Critical/Warning/Info); one entry per kind
 *   plotLeft, plotRight number      px from the block's left/right edge to where the time axis starts/ends, same meaning as in series: give both blocks the same values and stacked charts align to the pixel (plotLeft = lane label column + 21)
 *   laneLabelWidth number (default: fits the lane names, 96-200; a lane sub wraps to 2 lines and the row grows)   rowHeight number, default 44, 28 with groups (overlapping slots of a lane stack in more tracks)
 *   minPxPerHour number, default 40 (below this the plot scrolls inside the card, lane names stay)   legend boolean, default true
 *   step number, default 30   onMove function(item, minutes)  slots move with arrow keys or drag, snapped to step; the block never edits data: update({items})
 *   onSelect function(item)   click or Enter on a slot
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no lanes), loading, error, bad config (inline error). A note counts slots outside the lanes or the time range.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] lanes: load core.js before lanes.js'); return; }
  var DAY = 1440, ARR = Array.from;
  var mod = function (n) { return ((n % DAY) + DAY) % DAY; };
  var tm = function (v) {
    if (typeof v === 'number') return isFinite(v) ? mod(v) : NaN;
    var m = /(\d{1,2}):(\d{2})/.exec(String(v == null ? '' : v));
    return m ? mod(+m[1] * 60 + +m[2]) : NaN;
  };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var hhmm = function (m) { m = mod(m); return p2((m / 60) | 0) + ':' + p2(m % 60); };
  var fitText = function (h, text, font, w) {
    text = String(text);
    if (w < 1) return '';
    if (h.measureText(text, font) <= w) return text;
    var ch = ARR(text), lo = 0, hi = ch.length;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (h.measureText(ch.slice(0, mid).join('').trim() + '\u2026', font) <= w) lo = mid; else hi = mid - 1; }
    return lo >= 3 ? ch.slice(0, lo).join('').trim() + '\u2026' : '';
  };
  var wordCut = function (h, t, font, w) {
    var ws = String(t).split(/\s+/);
    for (var n = ws.length - 1; n >= 1; n--) { var x = ws.slice(0, n).join(' ') + '\u2026'; if (h.measureText(x, font) <= w) return x; }
    return '';
  };
  var wrap2 = function (h, t, font, w) { // two lines of whole words that both fit w, the shortest longer line wins; null when there is no such split
    var ws = String(t).split(/\s+/).filter(Boolean), best = null;
    for (var k = 1; k < ws.length; k++) {
      var a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '), wa = h.measureText(a, font), wb = h.measureText(b, font);
      if (wa <= w && wb <= w && (!best || Math.max(wa, wb) < best[2])) best = [a, b, Math.max(wa, wb)];
    }
    return best;
  };
  var initials = function (t) {
    var w = String(t).split(/[\s\/&\u00b7,\u2013\u2014-]+/).filter(Boolean);
    return w.length < 2 || w.length > 3 ? '' : w.slice(0, 3).map(function (x) { return ARR(x)[0]; }).join('').toUpperCase();
  };
  var tidy = function (t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/\s+([,;:.!?])/g, '$1').trim(); };
  var wrapN = function (h, t, font, w) { // lines (max 2) a muted second line needs at w px
    var ws = String(t).split(/\s+/).filter(Boolean), n = 1, cur = 0, sp = h.measureText(' ', font);
    ws.forEach(function (x) { var q = h.measureText(x, font); if (cur && cur + sp + q > w) { n++; cur = q; } else cur += (cur ? sp : 0) + q; });
    return Math.min(2, n);
  };
  /* lanes of the config: `lanes`, or the lanes of every group in order (each tagged with its group) */
  var flat = function (c) {
    var g = (c.groups || []).filter(function (x) { return x && Array.isArray(x.lanes); });
    return g.length ? [].concat.apply([], g.map(function (x, i) { return x.lanes.filter(function (l) { return l && typeof l === 'object'; }).map(function (l) { return Object.assign({}, l, { _g: i }); }); })) : c.lanes;
  };
  var lf = null; // keyboard focus to give back after update({items}): {root, id, t}
  // first track whose last end is left of x; used for slots and band strips
  var track = function (ends, x0, x1, gap) {
    for (var i = 0; i < ends.length; i++) if (ends[i] <= x0 + 0.5) { ends[i] = x1 + gap; return i; }
    ends.push(x1 + gap); return ends.length - 1;
  };

  K.block.define('lanes', {
    version: '1.0',
    resize: true,
    emptyText: 'Nothing scheduled yet',
    schema: {
      start: { type: 'time' }, end: { type: 'time' }, fit: { type: 'string', enum: ['data'] }, emptyLaneText: { type: 'text', default: 'No sessions' },
      groups: { type: 'array', of: { label: { type: 'text', required: true }, sub: { type: 'text' }, lanes: { type: 'array', required: true } } },
      lanes: { type: 'array', default: [], of: { id: { type: 'text', required: true }, label: { type: 'text', required: true }, sub: { type: 'text' }, off: { type: 'boolean' } } },
      items: { type: 'array', default: [], of: {
        id: { type: 'text', required: true }, lane: { type: 'text', required: true }, start: { type: 'time', required: true }, end: { type: 'time', required: true },
        label: { type: 'text', required: true }, sub: { type: 'text' }, short: { type: 'text' }, status: { type: 'text' }, statusText: { type: 'text' },
        cat: { type: 'any' }, catKey: { type: 'text' }, href: { type: 'string' } } },
      bands: { type: 'array', default: [], of: { start: { type: 'time', required: true }, end: { type: 'time', required: true }, label: { type: 'text' }, tone: { type: 'string' } } },
      markers: { type: 'array', default: [], of: { time: { type: 'time', required: true }, label: { type: 'text' }, kind: { type: 'string', enum: ['now', 'curfew', 'limit'] }, lane: { type: 'text' } } },
      laneLabelWidth: { type: 'number' }, plotLeft: { type: 'number' }, plotRight: { type: 'number' }, legendLabels: { type: 'object' }, rowHeight: { type: 'number' }, minPxPerHour: { type: 'number', default: 40 },
      step: { type: 'number', default: 30 }, onMove: { type: 'function' }, onSelect: { type: 'function' }, legend: { type: 'boolean', default: true }
    },
    empty: function (c) { return !flat(c).length; },
    render: function (el, c, h) {
      var lanes = flat(c), grouped = lanes !== c.lanes, groups = grouped ? c.groups : [];
      var pinned = c.start != null && c.end != null, s = pinned ? tm(c.start) : NaN, e = pinned ? tm(c.end) : NaN;
      if (pinned && (isNaN(s) || isNaN(e))) throw new Error('start and end must be times like 14:00');
      var PAD = 0, spans = [], known = {};
      lanes.forEach(function (l) { known[String(l.id)] = 1; });
      c.items.forEach(function (it) { var a = tm(it.start), z = tm(it.end); if (!isNaN(a) && !isNaN(z) && known[String(it.lane)]) spans.push([a, mod(z - a)]); });
      var total = pinned ? mod(e - s) || DAY : DAY;
      if (!pinned) {
        // no pinned range: the shortest window (start at one of the slot starts) that holds every slot, padded and rounded to whole hours
        if (!spans.length) throw new Error('start and end are needed when there are no slots to fit the axis to');
        var best = null, seen0 = {};
        spans.forEach(function (sp) {
          if (seen0[sp[0]]) return; seen0[sp[0]] = 1;
          var ext = 0; spans.forEach(function (q) { ext = Math.max(ext, mod(q[0] - sp[0]) + q[1]); });
          if (!best || ext < best[1]) best = [sp[0], ext];
        });
        var lo0 = Math.floor((best[0] - PAD) / 30) * 30, hi0 = Math.ceil((best[0] + best[1] + PAD) / 30) * 30;
        s = mod(lo0); total = Math.min(DAY, Math.max(60, hi0 - lo0));
      } else if (c.fit === 'data' && spans.length) {
        var lo = Infinity, hi = -Infinity;
        spans.forEach(function (sp) {
          var st = mod(sp[0] - s); if (st >= total && st - DAY + sp[1] > 0) st -= DAY;
          var vs = Math.max(0, st), ve = Math.min(total, st + sp[1]);
          if (ve < vs || (ve === vs && sp[1] > 0)) return;
          lo = Math.min(lo, vs); hi = Math.max(hi, ve);
        });
        if (lo <= hi) {
          var l2 = Math.max(0, Math.floor((s + lo - PAD) / 30) * 30 - s), h2 = Math.min(total, Math.ceil((s + hi + PAD) / 30) * 30 - s);
          if (h2 - l2 < 60) h2 = Math.min(total, l2 + 60);
          s = mod(s + l2); total = h2 - l2;
        }
      }
      var rel = function (t) { return mod(tm(t) - s); };
      var cs = getComputedStyle(el), fam = cs.fontFamily, r = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      var FL = '600 ' + 0.75 * r + 'px ' + fam, FL2 = '600 11.5px ' + fam, FT = '500 ' + 0.6875 * r + 'px ' + fam, FK = '400 ' + 0.6875 * r + 'px ' + fam, FB = '600 ' + 0.6875 * r + 'px ' + fam, FS = '400 ' + 0.6875 * r + 'px ' + fam;
      var LW = c.laneLabelWidth;
      if (LW == null) { LW = 96; lanes.forEach(function (l) { LW = Math.max(LW, h.measureText(l.label, '600 ' + 0.8125 * r + 'px ' + fam) + 25, l.sub == null ? 0 : h.measureText(l.sub, '400 ' + 0.6875 * r + 'px ' + fam) + 25); }); LW = Math.min(200, Math.ceil(LW)); }
      var GL = 20, GR = 20;
      if (c.plotRight != null) GR = Math.max(0, c.plotRight - 1); // the 1 px border of the frame: the time axis ends plotRight px from the block's right edge, as in series
      if (c.plotLeft != null) { LW = Math.max(60, Math.min(300, c.plotLeft - 1 - GL)); GL = Math.max(0, c.plotLeft - 1 - LW); } // time 0 sits plotLeft px from the block's left edge, as in series
      LW = Math.max(60, Math.min(300, LW)); var RH = Math.max(28, c.rowHeight || (grouped ? 28 : 44)), minPx = Math.max(24, c.minPxPerHour);
      var avail = (el.clientWidth || 960) - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0), PW = Math.max(Math.round(total / 60 * minPx), avail - LW - 2 - GL - GR), PE = PW + GL + GR;
      var X = function (m) { return GL + m / total * PW; }, PPM = PW / total;

      // ---- ticks
      var wTick = h.measureText('00:00', FK), tstep = 720, steps = [30, 60, 120, 180, 240, 360, 720];
      for (var i = 0; i < steps.length; i++) if (steps[i] * PPM >= wTick * 1.5 + 14) { tstep = steps[i]; break; }
      var ticks = [];
      for (var m = Math.ceil(s / tstep) * tstep; m <= s + total; m += tstep) ticks.push(m);

      // ---- markers
      var marks = c.markers.map(function (k) { return { x: 0, m: rel(k.time), t: tm(k.time), kind: k.kind || 'limit', label: k.label, lane: k.lane == null ? null : String(k.lane), time: k.time }; })
        .filter(function (k) { return !isNaN(k.t) && k.m >= 0 && k.m <= total; });
      marks.forEach(function (k) { k.x = Math.min(PE - 1, Math.max(1, X(k.m))); });
      var gmarks = marks.filter(function (k) { return k.lane == null; });
      var pills = gmarks.filter(function (k) { return k.label; });

      // ---- bands (label strips, stacked when they overlap)
      var bends = [], bands = c.bands.map(function (b) {
        var dur = mod(tm(b.end) - tm(b.start)) || DAY, st = rel(b.start);
        if (st >= total && st - DAY + dur > 0) st -= DAY;
        var a = Math.max(0, st), z = Math.min(total, st + dur);
        if (isNaN(st) || z <= a) return null;
        var x0 = X(a), x1 = X(z);
        return { b: b, x0: x0, w: x1 - x0, tr: track(bends, x0, x1, 0), kind: b.tone ? h.statusKind(b.tone) : 'neutral' };
      }).filter(Boolean);
      var BH = 20, bandsH = bends.length ? bends.length * BH + 2 : 0, tickH = 22, pillH = pills.length ? 24 : 0, headH = bandsH + tickH + pillH;

      // ---- lanes, slots, tracks
      var laneIx = {}, rows = lanes.map(function (l, i) { laneIx[String(l.id)] = i; return { l: l, items: [], ends: [], lines: [] }; });
      marks.forEach(function (k) { if (k.lane == null) rows.forEach(function (rw) { rw.lines.push(k); }); else if (laneIx[k.lane] != null) rows[laneIx[k.lane]].lines.push(k); });
      var hidden = 0, stat = {}, cats = {}, catOrder = [];
      var list = c.items.map(function (it) {
        var a = tm(it.start), z = tm(it.end), li = laneIx[String(it.lane)];
        if (isNaN(a) || isNaN(z) || li == null) { hidden++; return null; }
        var dur = mod(z - a), st = rel(it.start);
        if (st >= total && st - DAY + dur > 0) st -= DAY;
        if ((st + dur <= 0 && dur > 0) || st > total || (st === total && dur > 0)) { hidden++; return null; }
        var vs = Math.max(0, st), ve = Math.min(total, st + dur), x0 = X(vs), w = Math.max(6, X(ve) - x0);
        if (x0 + w > GL + PW) x0 = GL + PW - w;
        return { it: it, li: li, x0: x0, w: w, cl: st < 0, cr: st + dur > total, range: hhmm(a) + '\u2013' + hhmm(z) };
      }).filter(Boolean).sort(function (a, b) { return a.x0 - b.x0 || b.w - a.w; });
      list.forEach(function (o) {
        var rw = rows[o.li], key = o.it.catKey != null ? o.it.catKey : o.it.cat;
        o.tr = track(rw.ends, o.x0, o.x0 + o.w, 1); rw.items.push(o);
        o.kind = o.it.status ? h.statusKind(o.it.status) : '';
        if (o.kind && o.kind !== 'ok' && o.kind !== 'neutral') (stat[o.kind] = stat[o.kind] || []).push(tidy(o.it.status));
        if (key != null) {
          o.col = typeof key === 'number' ? h.cat(key) : h.catFor(key); o.key = String(key);
          if (!cats[o.key]) cats[o.key] = o.col;
        }
      });

      rows.forEach(function (rw) { rw.items.forEach(function (o) { if (o.key != null && catOrder.indexOf(o.key) < 0) catOrder.push(o.key); }); }); // legend follows the lane order

      // ---- DOM
      var sc = h.el('div', { class: 'k-lanes-sc', role: 'region', 'aria-label': String(c.title || 'Timeline') });
      var inner = sc.appendChild(h.el('div', { class: 'k-lanes-in', style: { width: LW + PE + 'px' } }));
      var axis = h.el('div', { class: 'k-lanes-axis', style: { width: PE + 'px', height: headH + 'px' } });
      inner.appendChild(h.el('div', { class: 'k-lanes-head', style: { height: headH + 'px' } }, [h.el('div', { class: 'k-lanes-corner', style: { width: LW + 'px' } }), axis]));
      bands.forEach(function (o) {
        var lab = o.b.label ? fitText(h, o.b.label, FB, o.w - 10) : '';
        axis.appendChild(h.el('span', { class: 'k-lanes-band k-s-' + o.kind, style: { left: o.x0 + 'px', width: o.w + 'px', top: o.tr * BH + 'px', height: BH - 2 + 'px' }, title: (o.b.label || '') + ' ' + hhmm(tm(o.b.start)) + '\u2013' + hhmm(tm(o.b.end)) }, lab ? h.el('span', { text: lab }) : null));
      });
      ticks.forEach(function (t, i) {
        var x = X(t - s), wd = h.measureText(hhmm(t), FK) + 2, left = Math.min(PE - (c.plotRight != null ? GR : 0) - wd + 2, Math.max(0, x - wd / 2 + 1)); // wd carries 2 px of slack: the text itself is wd - 2 wide
        axis.appendChild(h.el('span', { class: 'k-lanes-tick' + (mod(t) === 0 ? ' k-lanes-tick-day' : ''), style: { left: left + 'px', top: bandsH + 'px', height: tickH + 'px' }, text: hhmm(t) }));
      });
      // pills (flags of the lines that cross every lane); a pill that would collide keeps only its line
      var placed = [], pillX = {};
      pills.sort(function (a, b) { return (b.kind === 'now') - (a.kind === 'now'); }).forEach(function (k) {
        var wd = h.measureText(k.label, FB) + 14, left = Math.min(PE - wd, Math.max(0, k.x - wd / 2));
        if (placed.some(function (p) { return left < p[1] + 4 && p[0] < left + wd + 4; })) return;
        placed.push([left, left + wd]);
        axis.appendChild(h.el('span', { class: 'k-lanes-pill ' + (k.kind === 'now' ? 'k-lanes-pill-now' : 'k-s-' + (k.kind === 'curfew' ? 'crit' : 'warn')), style: { left: left + 'px', top: bandsH + tickH + 4 + 'px' }, text: k.label, title: k.label }));
        pillX[k.kind + k.m] = 1;
      });
      var plot = h.el('div', { class: 'k-lanes-plot', 'aria-hidden': 'true', style: { left: LW + 'px', top: bandsH + tickH + 'px', width: PE + 'px', bottom: 0 } });
      var wholeBand = bands.some(function (o) { return o.w >= PW * 0.8; }); // a tint over most of the axis says nothing: label strips only
      bands.forEach(function (o) { if (o.kind !== 'neutral' && !wholeBand) plot.appendChild(h.el('span', { class: 'k-lanes-shade k-s-' + o.kind, style: { left: o.x0 + 'px', width: o.w + 'px' } })); });
      ticks.forEach(function (t) { var x = X(t - s); if (x > 0 && x < PE) plot.appendChild(h.el('span', { class: 'k-lanes-gl' + (mod(t) === 0 ? ' k-lanes-gl-day' : ''), style: { left: x + 'px' } })); });
      inner.appendChild(plot);

      var movable = typeof c.onMove === 'function', selectable = typeof c.onSelect === 'function';
      var lineEl = function (k, extra) {
        var a = { class: 'k-lanes-line k-lanes-' + k.kind, style: { left: k.x - 1 + 'px' }, title: (k.label || k.kind) + ' ' + hhmm(k.t) };
        a[k.kind === 'now' ? 'data-k-now' : 'data-k-avoid'] = '';
        if (extra) for (var p in extra) a.style[p] = extra[p];
        return h.el('span', a);
      };
      var tipOf = function (o) {
        var it = o.it, st = tidy(it.statusText || it.status);
        return it.label + '\n' + o.range + (st ? ' \u00b7 ' + st : '') + (it.sub ? '\n' + it.sub : '');
      };
      var gSeen = -1;
      rows.forEach(function (rw) {
        if (grouped && rw.l._g !== gSeen) { /* group header row: full width band, its text stays at the left edge while the plot scrolls */
          gSeen = rw.l._g; var gr = groups[gSeen], n = lanes.filter(function (l) { return l._g === gSeen; }).length;
          inner.appendChild(h.el('div', { class: 'k-lanes-gh', role: 'presentation' }, [h.el('span', { class: 'k-lanes-gt' }, [h.el('b', { text: String(gr.label) }), h.el('span', { text: gr.sub != null ? String(gr.sub) : n + (n === 1 ? ' lane' : ' lanes') })])]));
        }
        var nt = Math.max(1, rw.ends.length), sn = rw.l.sub == null ? 0 : wrapN(h, rw.l.sub, FS, LW - 25), th = Math.max(nt * RH, sn ? Math.ceil(25 + 14.3 * sn) : 0), rh = th / nt;
        var trk = h.el('div', { class: 'k-lanes-trk' + (rw.l.off ? ' k-lanes-off' : ''), style: { width: PE + 'px', height: th + 'px' } });
        var lines = rw.lines.slice().sort(function (a, b) { return a.x - b.x; });
        rw.items.forEach(function (o) {
          var it = o.it, ih = rh - 8, top = o.tr * rh + 4, x0 = o.x0, x1 = o.x0 + o.w, pad = o.cl ? 5 : 8, W = 0, sx = x0 + pad;
          // the label always starts at the slot start; a line that crosses the text is cut around it afterwards (see carve below), the label never moves
          W = Math.max(0, x1 - 3 - (x0 + pad) - 1); sx = x0 + pad;
          var nextL = PE, nextLine = PE;
          rw.items.forEach(function (q) { if (q !== o && q.tr === o.tr && q.x0 >= x1 - 0.5 && q.x0 < nextL) nextL = q.x0; });
          lines.forEach(function (k) { if (k.x > x1 - 2 && k.x < nextLine) nextLine = k.x; });
          var dot = o.kind && o.kind !== 'ok' && o.kind !== 'neutral', dw = dot ? 13 : 0, label = '', mode = 'in';
          var L = String(it.label), fs = 0, two = null, fnt = FL;
          // full name, else the full name one step smaller (12 -> 11.5 px), else beside the slot, else two lines (whole words, time dropped), else whole words + "...",
          // else the name cut + "...", else initials, else the app's short (id) as the last resort
          if (h.measureText(L, FL) + dw <= W) label = L;
          else if (h.measureText(L, FL2) + dw <= W) { label = L; fs = 11.5; }
          else if (h.measureText(L, FL) <= Math.min(nextL, nextLine - 7) - x1 - 22) { label = L; mode = 'out'; }
          else {
            fnt = FL2; fs = 11.5;
            if (ih >= 32 && (two = wrap2(h, L, FL2, W - dw))) label = L;
            else if ((label = wordCut(h, L, FL2, W - dw))) { /* whole words and an ellipsis */ }
            else if ((label = fitText(h, L, FL2, W - dw))) { /* name cut with an ellipsis (3+ characters) */ }
            else if ((label = initials(L)) && h.measureText(label, FL2) + dw <= W) { /* initials */ }
            else if (it.short != null && h.measureText(String(it.short), FL2) + dw <= W) label = String(it.short);
            else label = '';
          }
          var subOut = '', cls = 'k-lanes-item' + (o.col || !o.kind ? '' : ' k-lanes-plain') + (o.cl ? ' k-lanes-cl' : '') + (o.cr ? ' k-lanes-cr' : '') + (movable || selectable || it.href ? ' k-lanes-act' : '');
          var ic = o.col || (o.kind ? 'var(--k-s)' : 'var(--k-accent)'); // no category: the theme accent (a status colours the slot with its own colour)
          var a = { class: cls + (o.kind ? ' k-s-' + o.kind : ''), title: tipOf(o), 'aria-label': tipOf(o).replace(/\n/g, ', '), 'data-id': it.id, 'data-lane': it.lane,
            style: { left: x0 + 'px', width: o.w + 'px', top: top + 'px', height: ih + 'px', '--k-ic': ic } };
          if (it.href) a.href = it.href; else if (movable || selectable) { a.tabindex = 0; a.role = 'button'; }
          var kids = [];
          if (label && mode === 'in') {
            var T = ih >= 32 && !two ? (function (b) { var w = dot && it.statusText ? b + ' \u00b7 ' + tidy(it.statusText) : b; return h.measureText(w, FT) <= W ? w : h.measureText(b, FT) <= W ? b : ''; })(String(it.sub != null ? it.sub : o.range)) : '';
            if (!T && it.sub != null && ih >= 32 && h.measureText(String(it.sub), FL) <= Math.min(nextL, nextLine - 7) - x1 - 22) subOut = String(it.sub); // the second line does not fit in the slot: it goes beside it, never dropped
            var tn = two ? h.el('span', { class: 'k-lanes-w' }, [h.el('span', { text: two[0] }), ' ', h.el('span', { text: two[1] })]) : h.el('span', { text: label });
            kids.push(h.el('span', { class: 'k-lanes-txt', style: { left: sx - x0 + 'px' } }, [
              h.el('span', { class: 'k-lanes-l', style: fs ? { 'font-size': fs + 'px' } : null }, [dot ? h.el('i', { class: 'k-b-dot k-s-' + o.kind, 'aria-hidden': 'true' }) : null, tn]),
              T ? h.el('span', { class: 'k-lanes-t', text: T }) : null]));
          }
          var ch = Math.min(ih, 22), chip = { left: x1 + 7 + 'px', top: top + (ih - ch) / 2 + 'px', height: ch + 'px', '--k-ic': ic }; /* a label beside its slot is a chip in the slot's colour, tied to it by a short leader */
          var node = h.el(it.href ? 'a' : 'div', a, kids);
          trk.appendChild(node);
          if (subOut) trk.appendChild(h.el('span', { class: 'k-lanes-out', title: tipOf(o), style: chip }, [h.el('span', { text: subOut })]));
          if (label && mode === 'out') trk.appendChild(h.el('span', { class: 'k-lanes-out', title: tipOf(o), style: chip }, [dot ? h.el('i', { class: 'k-b-dot k-s-' + o.kind, 'aria-hidden': 'true' }) : null, h.el('span', { text: label + (it.sub != null && h.measureText(L + ' \u00b7 ' + it.sub, FL) <= Math.min(nextL, nextLine - 7) - x1 - 22 ? ' \u00b7 ' + it.sub : '') })]));
          if (selectable && !it.href) {
            node.addEventListener('click', function () { c.onSelect(it); });
            node.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && !movable) { ev.preventDefault(); c.onSelect(it); } });
          }
          if (movable && !it.href) {
            var stepM = Math.max(1, c.step), x00 = null, moved = 0;
            node.addEventListener('keydown', function (ev) {
              if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); lf = { root: el.closest('[data-k-block]') || el, id: it.id, t: Date.now() }; c.onMove(it, (ev.key === 'ArrowRight' ? 1 : -1) * stepM); }
              else if (ev.key === 'Enter' && selectable) { ev.preventDefault(); c.onSelect(it); }
            });
            node.addEventListener('pointerdown', function (ev) { if (ev.button) return; x00 = ev.clientX; moved = 0; try { node.setPointerCapture(ev.pointerId); } catch (x) { /* ignore */ } });
            node.addEventListener('pointermove', function (ev) {
              if (x00 == null) return;
              moved = Math.round((ev.clientX - x00) / PPM / stepM) * stepM;
              node.style.transform = 'translateX(' + moved * PPM + 'px)'; node.classList.toggle('k-lanes-drag', !!moved);
            });
            var end = function () { if (x00 == null) return; x00 = null; node.style.transform = ''; node.classList.remove('k-lanes-drag'); if (moved) { var mm = moved; moved = 0; lf = { root: el.closest('[data-k-block]') || el, id: it.id, t: Date.now() }; c.onMove(it, mm); } };
            node.addEventListener('pointerup', end); node.addEventListener('pointercancel', function () { moved = 0; end(); });
          }
        });
        if (!rw.items.length && !rw.l.off && c.emptyLaneText) trk.appendChild(h.el('span', { class: 'k-lanes-none', style: { left: GL + 6 + 'px', height: th + 'px' }, text: c.emptyLaneText }));
        lines.filter(function (k) { return k.lane != null; }).forEach(function (k) { trk.appendChild(lineEl(k, { top: 0, height: th + 'px' })); });
        var lab = h.el('div', { class: 'k-lanes-lab', style: { width: LW + 'px' } }, [h.line(rw.l.label, { class: 'k-lanes-ln' }), rw.l.sub != null ? h.el('span', { class: 'k-lanes-ls', title: String(rw.l.sub), text: String(rw.l.sub) }) : null]);
        inner.appendChild(h.el('div', { class: 'k-lanes-row', 'data-lane': rw.l.id, style: { height: th + 'px' } }, [lab, trk]));
      });
      // lines that cross every lane, drawn once above the rows; they start under their flag
      gmarks.forEach(function (k) {
        var top = bandsH + tickH + (pillX[k.kind + k.m] ? 22 : pillH);
        var ln = lineEl(k, { top: top + 'px', bottom: 0 }); ln.style.left = LW + k.x - 1 + 'px';
        inner.appendChild(ln);
      });
      el.appendChild(sc);
      if (hidden) el.appendChild(h.el('p', { class: 'k-lanes-note', text: hidden + (hidden === 1 ? ' slot is' : ' slots are') + ' outside the shown lanes or time range' }));
      if (c.legend) {
        var lg = [];
        catOrder.slice(0, 8).forEach(function (k) { lg.push(h.el('span', null, [h.el('i', { style: { '--sw': cats[k] } }), k])); });
        var LL = c.legendLabels || {}, DEF = { crit: 'Critical', warn: 'Warning', info: 'Info' };
        ['crit', 'warn', 'info'].forEach(function (k) { // one entry per status kind, in the app's word for that kind
          if (!stat[k]) return;
          var cnt = {}, best = '';
          stat[k].forEach(function (x) { if (x && !/^(ok|warn|crit|info|neutral)$/i.test(x)) { cnt[x] = (cnt[x] || 0) + 1; if (!best || cnt[x] > cnt[best]) best = x; } });
          var w = LL[k] != null ? tidy(LL[k]) : best ? best.charAt(0).toUpperCase() + best.slice(1) : DEF[k];
          if (w) lg.push(h.el('span', null, [h.el('i', { class: 'k-b-sw-dot k-s-' + k, style: { '--sw': 'var(--k-s)' } }), w]));
        });
        if (lanes.some(function (l) { return l.off; })) lg.push(h.el('span', null, [h.el('i', { class: 'k-lanes-sw-off' }), 'Unavailable']));
        var kinds = {};
        marks.forEach(function (k) { if (!kinds[k.kind]) { kinds[k.kind] = 1; lg.push(h.el('span', null, [h.el('i', { class: 'k-b-sw-line', style: { '--sw': k.kind === 'now' ? 'var(--k-text)' : k.kind === 'curfew' ? 'var(--k-crit)' : 'var(--k-warn)' } }), (k.label || '').replace(/\s*\d{1,2}:\d{2}.*$/, '') || (k.kind === 'now' ? 'Now' : k.kind === 'curfew' ? 'Curfew' : 'Limit')])); } });
        if (lg.length) el.appendChild(h.el('div', { class: 'k-b-legend' }, lg));
      }
      if (sc.scrollWidth > sc.clientWidth + 1) sc.tabIndex = 0;
      if (lf && lf.root === (el.closest('[data-k-block]') || el)) { // the moved slot keeps keyboard focus after update({items}) redraws
        var fid = String(lf.id), fresh = Date.now() - lf.t < 2000; lf = null;
        var fn = fresh && ARR(el.querySelectorAll('[data-id]')).filter(function (n) { return n.getAttribute('data-id') === fid; })[0];
        if (fn && fn.focus) fn.focus({ preventScroll: true });
      }
      // cut every line where it would cross text: the line passes "behind" the label as a gap of 4 px around the text, so labels stay at the slot start
      var texts = ARR(inner.querySelectorAll('.k-lanes-txt, .k-lanes-out, .k-lanes-none')).map(function (n) {
        var rg = document.createRange(), u = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
        rg.selectNodeContents(n);
        ARR(rg.getClientRects()).forEach(function (q) { if (q.width > 0 && q.height > 0) { u.l = Math.min(u.l, q.left); u.r = Math.max(u.r, q.right); u.t = Math.min(u.t, q.top); u.b = Math.max(u.b, q.bottom); } });
        return u;
      }).filter(function (u) { return u.r > u.l; });
      ARR(inner.querySelectorAll('.k-lanes-line')).forEach(function (ln) {
        var lr = ln.getBoundingClientRect(), pr = ln.parentNode.getBoundingClientRect(), cuts = [];
        texts.forEach(function (t) { if (t.l - 4 < lr.right && t.r + 4 > lr.left && t.t < lr.bottom && t.b > lr.top) cuts.push([Math.max(lr.top, t.t - 1), Math.min(lr.bottom, t.b + 1)]); });
        if (!cuts.length) return;
        cuts.sort(function (p, q) { return p[0] - q[0]; });
        var segsY = [], y = lr.top;
        cuts.forEach(function (q) { if (q[0] > y + 1) segsY.push([y, q[0]]); y = Math.max(y, q[1]); });
        if (lr.bottom > y + 1) segsY.push([y, lr.bottom]);
        segsY = segsY.filter(function (q) { return q[1] - q[0] >= 3; }); // drop slivers
        segsY.forEach(function (q, i) {
          var node = i ? ln.cloneNode(true) : ln;
          node.style.bottom = 'auto'; node.style.top = q[0] - pr.top + 'px'; node.style.height = q[1] - q[0] + 'px';
          if (i) ln.parentNode.appendChild(node);
        });
        if (!segsY.length) ln.style.display = 'none';
      });
    }
  });
})();
