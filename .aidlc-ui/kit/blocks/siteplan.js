/* @block siteplan 1.0 -- schematic site plan: places, labelled routes, zones, status; labels never overlap (leader lines when crowded).
 * Use for: a festival site (gate, shuttle stop, stages, artist village, station, walking times), a depot yard (gate, charger bays, transformer, parking),
 *   a warehouse floor (dock doors, aisles, pack stations). Schematic, not a map: x/y are only relative positions.
 * Pick: Schematic plan of a site (gate, stages, bays, docks) with labelled paths; not a map.
 * Load: blocks.css, core.js, siteplan.css, siteplan.js
 * Call: K.block.siteplan('#a-site', {nodes:[{id:'gate',label:'Main gate',x:50,y:90,kind:'gate'},{id:'a',label:'Lighthouse',x:30,y:50,kind:'stage',status:'on time'}],
 *   paths:[{from:'gate',to:'a',label:'350 m, 5 min'}], areas:[{label:'Backstage',x:5,y:5,w:35,h:35}]})
 * Config:
 *   nodes   array, required  places [{id, label, x, y, kind?, status?, sub?, href?}]
 *     x,y   number           any numbers; the block scales the plan to fill the container (fit) and nudges overlapping places apart
 *     kind  text             gate, stop, stage, station, building, charger, parking, dock, catering... picks the icon + colour (same in the legend); free text
 *     status ok|warn|crit|info|neutral or app words  dot on the place + the word under the label (never colour alone)
 *     sub   text             muted second line under the label (replaces the status word)
 *   paths   array            routes [{from, to, label?, dashed?, status?, via?}]; label sits on the path ("350 m \u00b7 5 min"), via = [{x,y}] waypoints
 *   areas   array            zones [{label, x, y, w, h, status?}] (same coordinates as nodes)
 *   height  number, default 340   plot height in px (width = container; text stays 1:1)
 *   fit     boolean, default true  scale the data bounding box to the container
 *   legend  boolean, default true  kinds, statuses and dashed routes present
 *   dashedLabel text, default 'Alternative route'   legend text for dashed routes
 *   selected text          id of the highlighted place; onSelect function(node) makes places keyboard buttons
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no nodes), loading, error, bad config (also an unknown or duplicate node id). Crowded plans: labels move, get a leader line, and as a last resort
 *   are hidden (full text stays in the tooltip) with a note under the plan that says how many.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] siteplan: load core.js before siteplan.js'); return; }
  var R = 14, IC = {
    pin: 'M8 14s4.5-3.8 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10.2 8 14 8 14z M8 6.6h.01', gate: 'M3 14V7.5a5 5 0 0 1 10 0V14 M6.5 14V9.5 M9.5 14V9.5',
    stop: 'M3.5 3h9v8.5h-9z M3.5 8h9 M5.5 14v-2.5 M10.5 14v-2.5 M5.8 10h.01 M10.2 10h.01', stage: 'M2 13h12 M3.5 13 5 4h6l1.5 9 M5.8 8.5h4.4',
    station: 'M4 2.5h8v8.5H4z M4 7h8 M5.5 14 7 11 M10.5 14 9 11 M6 9.2h.01 M10 9.2h.01', bolt: 'M9 2 4 9h4l-1 5 5-7H8z', parking: 'M5.5 14V2.5h3.2a3 3 0 0 1 0 6H5.5',
    box: 'M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z M2.5 5 8 7.5 13.5 5 M8 7.5v6', fork: 'M4.5 2v4.5a1.5 1.5 0 0 0 3 0V2 M6 2v12 M11.5 14V2c-2 1.2-2.5 3.5-2.5 6h2.5',
    building: 'M3 14V2.5h6V14 M9 6.5h4V14 M2 14h12 M5.2 5h1.6 M5.2 8h1.6 M5.2 11h1.6' };
  var KIND = [[/gate|entr|exit|door/, 'gate'], [/stop|bus|shuttle|transit|kerb|curb|drop/, 'stop'], [/stage|arena|show/, 'stage'], [/station|train|rail/, 'station'],
    [/charg|bolt|power|transformer|grid|board|panel|switch/, 'bolt'], [/park|yard|lot|bay/, 'parking'], [/dock|stor|stock|ware|rack|pallet|shelf|pack|bin/, 'box'],
    [/cater|food|kitchen|canteen/, 'fork'], [/village|build|office|work|depot|site|hall|tent|hq|room/, 'building']];
  var icon = function (k) { k = String(k || '').toLowerCase(); for (var i = 0; i < KIND.length; i++) if (KIND[i][0].test(k)) return IC[KIND[i][1]]; return IC.pin; };
  var hitR = function (a, b, m) { m = m || 0; return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m; };
  var segR = function (p, q, r) { // Liang-Barsky: does segment p-q touch rect r
    var t0 = 0, t1 = 1, dx = q.x - p.x, dy = q.y - p.y, P = [-dx, dx, -dy, dy], Q = [p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
      var t = Q[i] / P[i];
      if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  };
  var near = function (b, x, y) { return { x: Math.max(b.x, Math.min(x, b.x + b.w)), y: Math.max(b.y, Math.min(y, b.y + b.h)) }; };
  var sev = { crit: 0, warn: 1, info: 2, ok: 3, neutral: 4 };
  K.block.define('siteplan', {
    version: '1.0',
    resize: true,
    emptyText: 'No places on this plan yet',
    schema: {
      nodes: { type: 'array', required: true, of: { id: { type: 'text', required: true }, label: { type: 'text', required: true }, x: { type: 'number', required: true }, y: { type: 'number', required: true },
        kind: { type: 'string' }, status: { type: 'string' }, tone: { type: 'string' }, sub: { type: 'text' }, href: { type: 'string' } } },
      paths: { type: 'array', default: [], of: { from: { type: 'text', required: true }, to: { type: 'text', required: true }, label: { type: 'text' }, dashed: { type: 'boolean' }, status: { type: 'string' }, tone: { type: 'string' }, via: { type: 'array' } } },
      areas: { type: 'array', default: [], of: { label: { type: 'text', required: true }, x: { type: 'number', required: true }, y: { type: 'number', required: true }, w: { type: 'number', required: true }, h: { type: 'number', required: true }, status: { type: 'string' }, tone: { type: 'string' } } },
      height: { type: 'number', default: 340 }, fit: { type: 'boolean', default: true }, legend: { type: 'boolean', default: true },
      dashedLabel: { type: 'text', default: 'Alternative route' }, selected: { type: 'text' }, onSelect: { type: 'function' }
    },
    empty: function (c) { return !c.nodes.length; },
    render: function (el, c, h) {
      var W = Math.max(280, el.clientWidth || 640), H = Math.max(200, Math.round(c.height * (W < 520 ? 1.6 : 1))), py = 46, pyB = 56, px = W < 520 ? 40 : 64;
      var capH = H;
      var fam = getComputedStyle(el).fontFamily || 'system-ui', fL = '600 12px ' + fam, fS = '400 11px ' + fam, fC = '500 11px ' + fam, maxL = W < 520 ? 120 : 210, maxS = W < 520 ? 200 : 280;
      var M = function (t, f) { return h.measureText(t, f); };
      var cut = function (t, f, max) { t = String(t); if (M(t, f) <= max) return t; while (t.length > 1 && M(t + '\u2026', f) > max) t = t.slice(0, -1); return t + '\u2026'; };
      var wrap = function (t, f, max) { // up to two lines, the second ends in an ellipsis when it is still too long
        t = String(t); if (M(t, f) <= max) return [t];
        var w = t.split(' '), a = '';
        while (w.length > 1 && M((a ? a + ' ' : '') + w[0], f) <= max) a += (a ? ' ' : '') + w.shift();
        return a ? [a, cut(w.join(' '), f, max)] : [cut(t, f, max)];
      };
      var by = {}, N = c.nodes.map(function (n, i) {
        var id = String(n.id); if (by[id]) throw new Error('duplicate node id "' + id + '"');
        return (by[id] = { n: n, i: i, kind: String(n.kind || 'place'), st: n.status || n.tone ? h.statusKind(n.tone || n.status) : '' });
      });
      // scale the data to the plot
      var xs = [], ys = [];
      N.forEach(function (o) { xs.push(o.n.x); ys.push(o.n.y); });
      c.areas.forEach(function (a) { xs.push(a.x, a.x + a.w); ys.push(a.y, a.y + a.h); });
      var x0 = c.fit ? Math.min.apply(null, xs) : 0, x1 = c.fit ? Math.max.apply(null, xs) : 100, y0 = c.fit ? Math.min.apply(null, ys) : 0, y1 = c.fit ? Math.max.apply(null, ys) : 100;
      if (c.fit) { // plot height follows the data: a few places do not get a tall empty plot (never under 160 px)
        var ideal = x1 > x0 ? py + pyB + (y1 - y0) / (x1 - x0) * (W - 2 * px) : y1 > y0 ? capH : 0, minH = N.length <= 3 ? 160 : N.length <= 6 ? 220 : 300;
        H = Math.round(Math.max(160, Math.min(capH, N.length <= 3 ? 230 : 1e4, Math.max(ideal, minH))));
      }
      var sx = function (v) { return x1 > x0 ? px + (v - x0) / (x1 - x0) * (W - 2 * px) : W / 2; }, sy = function (v) { return y1 > y0 ? py + (v - y0) / (y1 - y0) * (H - py - pyB) : H / 2; };
      N.forEach(function (o) { o.x = sx(o.n.x); o.y = sy(o.n.y); });
      for (var it = 0; it < 30; it++) { // places never sit on top of each other
        var moved = false;
        for (var a = 0; a < N.length; a++) for (var b = a + 1; b < N.length; b++) {
          var dx = N[b].x - N[a].x, dy = N[b].y - N[a].y, d = Math.sqrt(dx * dx + dy * dy), min = 2 * R + 30;
          if (d >= min) continue;
          if (d < 0.01) { dx = 1; dy = 0; d = 1; }
          var k = (min - d) / 2 / d; moved = true;
          N[a].x = Math.max(R + 2, Math.min(W - R - 2, N[a].x - dx * k)); N[a].y = Math.max(R + 2, Math.min(H - R - 2, N[a].y - dy * k));
          N[b].x = Math.max(R + 2, Math.min(W - R - 2, N[b].x + dx * k)); N[b].y = Math.max(R + 2, Math.min(H - R - 2, N[b].y + dy * k));
        }
        if (!moved) break;
      }
      // paths as polylines
      var pair = {}, P = c.paths.map(function (p, i) {
        var f = by[String(p.from)], t = by[String(p.to)];
        if (!f || !t) throw new Error('path ' + i + ' refers to unknown node "' + (f ? p.to : p.from) + '"');
        var key = [p.from, p.to].sort().join('\u0001'); pair[key] = (pair[key] || 0) + 1;
        return { p: p, i: i, f: f, t: t, key: key, k: pair[key] - 1 };
      });
      P.forEach(function (q) {
        var pts = [{ x: q.f.x, y: q.f.y }];
        (Array.isArray(q.p.via) ? q.p.via : []).forEach(function (v) { if (v && isFinite(v.x) && isFinite(v.y)) pts.push({ x: sx(v.x), y: sy(v.y) }); });
        if (pair[q.key] > 1 && pts.length === 1) { // parallel routes between the same two places bend apart
          var dx = q.t.x - q.f.x, dy = q.t.y - q.f.y, d = Math.sqrt(dx * dx + dy * dy) || 1, off = (q.k - (pair[q.key] - 1) / 2) * 44;
          pts.push({ x: (q.f.x + q.t.x) / 2 - dy / d * off, y: (q.f.y + q.t.y) / 2 + dx / d * off });
        }
        pts.push({ x: q.t.x, y: q.t.y }); q.pts = pts; q.len = 0; q.cum = [0];
        for (var i = 1; i < pts.length; i++) { q.len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); q.cum.push(q.len); }
      });
      var at = function (q, s) {
        for (var i = 1; i < q.pts.length; i++) if (s <= q.cum[i] || i === q.pts.length - 1) {
          var a = q.pts[i - 1], b = q.pts[i], l = q.cum[i] - q.cum[i - 1] || 1, u = Math.max(0, Math.min(1, (s - q.cum[i - 1]) / l));
          return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, nx: -(b.y - a.y) / l, ny: (b.x - a.x) / l };
        }
      };
      var segs = []; P.forEach(function (q) { for (var i = 1; i < q.pts.length; i++) segs.push({ a: q.pts[i - 1], b: q.pts[i], q: q.i }); });
      // obstacles: place badges, then zone labels, node labels, route labels
      var occ = N.map(function (o) { return { x: o.x - R - 1, y: o.y - R - 1, w: 2 * R + 2, h: 2 * R + 2 }; }), bounds = { x: 4, y: 4, w: W - 8, h: H - 8 };
      var inB = function (b) { b.x = Math.max(bounds.x, Math.min(b.x, bounds.x + bounds.w - b.w)); b.y = Math.max(bounds.y, Math.min(b.y, bounds.y + bounds.h - b.h)); return b; };
      var hard = function (b, m) { var n = 0; occ.forEach(function (o) { if (hitR(b, o, m == null ? 2 : m)) n++; }); return n; };
      var crossed = function (b, skip) { var s = {}; segs.forEach(function (g) { if (g.q !== skip && segR(g.a, g.b, b)) s[g.q] = 1; }); return Object.keys(s).length; };
      var foreign = function (b, o) { var s = {}; segs.forEach(function (g) { var q = P[g.q]; if (q.f !== o && q.t !== o && segR(g.a, g.b, { x: b.x - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 })) s[g.q] = 1; }); return Object.keys(s).length; };
      var areaEls = c.areas.map(function (a, i) {
        var r = { x: sx(a.x), y: sy(a.y), w: sx(a.x + a.w) - sx(a.x), h: sy(a.y + a.h) - sy(a.y) }, fA = '600 11px ' + fam, full = String(a.label).toUpperCase(), out = r.y > 22 && M(full, fA) + full.length * 0.7 > r.w - 16, txt = out ? (r.y > 36 ? wrap(full, fA, Math.min(280, Math.max(140, r.w)) * .92) : [cut(full, fA, 280)]) : wrap(full, fA, Math.max(60, r.w - 20) * .92), w = Math.max.apply(null, txt.map(function (x) { return M(x, fA) + x.length * 0.7; })) + 4, best = null;
        var th = txt.length * 14 + 2, cands = out ? [[0, -(txt.length * 14 + 5)]] : [[8, 6], [r.w - w - 8, 6], [8, r.h - th - 6], [r.w - w - 8, r.h - th - 6]];
        if (!out) for (var sxo = 8; sxo <= r.w - w - 8; sxo += 12) { cands.push([sxo, 6]); cands.push([sxo, r.h - th - 6]); }
        cands.forEach(function (o, ci) { // fewest touched places and routes wins; corners first on a tie
          var b = { x: r.x + o[0], y: r.y + o[1], w: w, h: th }, cost = hard(b) * 1000 + crossed(b, -1) * 60 + (ci < 4 ? ci : 4 + ci * .05) + (b.y < 4 || b.y + th > H - 4 ? 500 : 0);
          if (!best || cost < best.cost) best = { x: b.x, y: b.y, w: b.w, h: b.h, cost: cost };
        });
        best = { x: best.x, y: best.y, w: best.w, h: best.h };
        occ.push(best);
        return { a: a, r: r, txt: txt, b: best, st: a.status || a.tone ? h.statusKind(a.tone || a.status) : '' };
      });
      var bord = function (b) { // zone outlines are obstacles: a caption or pill is wholly inside a zone or wholly outside it
        var n = 0; areaEls.forEach(function (z) { var r = z.r; if (hitR(b, r, 0) && !(b.x >= r.x + 3 && b.y >= r.y + 3 && b.x + b.w <= r.x + r.w - 3 && b.y + b.h <= r.y + r.h - 3)) n++; }); return n;
      };
      var hid = 0, hidP = 0, leads = [];
      var order = N.slice().sort(function (p, q) { return (sev[p.st] == null ? 5 : sev[p.st]) - (sev[q.st] == null ? 5 : sev[q.st]) || p.i - q.i; });
      order.forEach(function (o) {
        var L = wrap(o.n.label, fL, maxL), sub = o.n.sub != null ? (o.n.status != null ? o.n.status + ' \u00b7 ' : '') + o.n.sub : (o.n.status != null ? String(o.n.status) : ''), l2 = sub && W >= 480 ? cut(sub, fS, maxS) : ''; // under 480 px the second line is dropped (the tooltip keeps it)
        var w = Math.max.apply(null, L.map(function (x) { return M(x, fL); }).concat(l2 ? M(l2, fS) : 0)) + 6, hh = (L.length + (l2 ? 1 : 0)) * 14 + 2, best = null;
        [[0, 1, 3], [0, -1, 3], [1, 0, 3], [-1, 0, 3], [1, 1, 18], [-1, 1, 18], [1, -1, 18], [-1, -1, 18], [0, 1, 26], [0, -1, 26], [1, 0, 26], [-1, 0, 26],
          [1, 1, 44], [-1, 1, 44], [1, -1, 44], [-1, -1, 44], [0, 1, 56], [0, -1, 56], [1, 0, 56], [-1, 0, 56], [1, 1, 76], [-1, 1, 76], [1, -1, 76], [-1, -1, 76]].forEach(function (d, i) {
          var bx = d[0] > 0 ? o.x + R + d[2] : d[0] < 0 ? o.x - R - d[2] - w : o.x - w / 2, by2 = d[1] > 0 ? o.y + R + d[2] : d[1] < 0 ? o.y - R - d[2] - hh : o.y - hh / 2;
          if (d[0] && d[1]) { by2 = d[1] > 0 ? o.y + 4 + d[2] / 2 : o.y - 4 - d[2] / 2 - hh; }
          var b = inB({ x: bx, y: by2, w: w, h: hh }), cost = i * 1.5 + hard(b) * 1000 + crossed({ x: b.x - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 }, -1) * 60 + foreign(b, o) * 300 + bord(b) * 40 + (d[2] > 8 ? 22 + d[2] / 3 : 0), lead = d[2] > 8, ld = null; /* a route of ANOTHER place through the label costs most: the label moves (with a leader) before a route is struck through it */
          if (lead) { // the leader line must reach its own place without crossing another one
            var nb = near(b, o.x, o.y), ang = Math.atan2(nb.y - o.y, nb.x - o.x); ld = { x1: o.x + Math.cos(ang) * R, y1: o.y + Math.sin(ang) * R, x2: nb.x, y2: nb.y, dot: 1 };
            N.forEach(function (m) { if (m !== o && segR({ x: ld.x1, y: ld.y1 }, { x: ld.x2, y: ld.y2 }, { x: m.x - R - 2, y: m.y - R - 2, w: 2 * R + 4, h: 2 * R + 4 })) cost += 400; });
          }
          if (!best || cost < best.cost) best = { b: b, cost: cost, an: d[0] > 0 ? 'start' : d[0] < 0 ? 'end' : 'middle', ld: ld };
        });
        if (hard(best.b)) { hid++; o.hidden = true; return; }
        occ.push(best.b); o.lbl = { b: best.b, an: best.an, L: L, l2: l2 };
        if (best.ld) leads.push(best.ld);
      });
      /* a route that would run through another place's label bends round it: one waypoint, the shortest detour whose two legs clear every foreign label and place */
      var lboxes = N.filter(function (o) { return o.lbl; }).map(function (o) { return { o: o, b: { x: o.lbl.b.x - 3, y: o.lbl.b.y - 3, w: o.lbl.b.w + 6, h: o.lbl.b.h + 6 } }; }), bdg = function (n) { return { x: n.x - R - 3, y: n.y - R - 3, w: 2 * R + 6, h: 2 * R + 6 }; };
      P.forEach(function (q) {
        if (q.pts.length !== 2) return;
        var A = q.pts[0], B = q.pts[1], bad = function (a, b) { return lboxes.some(function (l) { return l.o !== q.f && l.o !== q.t && segR(a, b, l.b); }); };
        if (!bad(A, B)) return;
        var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1, best = null;
        [.5, .35, .65, .25, .75, .15, .85].forEach(function (u) { [26, -26, 48, -48, 74, -74, 104, -104, 140, -140].forEach(function (off) {
          var m = { x: A.x + dx * u - dy / d * off, y: A.y + dy * u + dx / d * off };
          if (m.x < 8 || m.y < 8 || m.x > W - 8 || m.y > H - 8 || bad(A, m) || bad(m, B)) return;
          if (N.some(function (n) { return n !== q.f && n !== q.t && (segR(A, m, bdg(n)) || segR(m, B, bdg(n))); })) return;
          var cost = Math.abs(off) + Math.abs(u - .5) * 40; if (!best || cost < best.cost) best = { m: m, cost: cost };
        }); });
        if (!best) return;
        q.pts = [A, best.m, B]; q.len = Math.hypot(best.m.x - A.x, best.m.y - A.y) + Math.hypot(B.x - best.m.x, B.y - best.m.y); q.cum = [0, Math.hypot(best.m.x - A.x, best.m.y - A.y), q.len];
      });
      segs.length = 0; P.forEach(function (q) { for (var i = 1; i < q.pts.length; i++) segs.push({ a: q.pts[i - 1], b: q.pts[i], q: q.i }); });
      // route pills: capped by priority when the plan is crowded, then placed short routes first; each pill slides along its own edge
      // (and only then away from it, with a leader) until it clears every other pill, label and place by 5 px
      var lab = P.filter(function (q) { return q.p.label != null && q.p.label !== ''; }), capP = Math.max(8, Math.round(W * H / 24000));
      var prio = function (q) { return (sev[q.p.status || q.p.tone ? h.statusKind(q.p.tone || q.p.status) : 'neutral'] == null ? 5 : sev[q.p.status || q.p.tone ? h.statusKind(q.p.tone || q.p.status) : 'neutral']) * 1e6 + (q.p.dashed ? 5e5 : 0) + q.len; };
      if (lab.length > capP) {
        var keep = lab.slice().sort(function (p, q) { return prio(p) - prio(q); }).slice(0, capP);
        hidP += lab.length - capP; lab = lab.filter(function (q) { return keep.indexOf(q) >= 0; });
      }
      lab.sort(function (p, q) { return p.len - q.len; }).forEach(function (q) {
        var tl = wrap(q.p.label, fC, 210), w = Math.max.apply(null, tl.map(function (x) { return M(x, fC); })) + 16, ph = tl.length > 1 ? 31 : 18, best = null;
        [.5, .44, .56, .38, .62, .32, .68, .26, .74, .2, .8, .14, .86, .08, .92].forEach(function (u, ui) {
          var pt = at(q, q.len * u);
          [0, 26, -26, 46, -46, 70, -70, 96, -96].forEach(function (off, oi) {
            var cx = pt.x + pt.nx * off, cy = pt.y + pt.ny * off, b = { x: cx - w / 2, y: cy - ph / 2, w: w, h: ph };
            if (b.x < 4 || b.y < 4 || b.x + w > W - 4 || b.y + ph > H - 4) return;
            var own = off ? segs.some(function (g) { return g.q === q.i && segR(g.a, g.b, b); }) : false;
            var cost = hard(b, 8) * 1000 + crossed(b, q.i) * 30 + bord(b) * 40 + (own ? 60 : 0) + (off ? 22 + Math.abs(off) / 4 : 0) + Math.abs(u - .5) * 36 + oi * 0.1;
            if (off) { var lq = near(b, pt.x, pt.y), ls = { x: pt.x, y: pt.y }, le = { x: lq.x, y: lq.y }; occ.forEach(function (o) { if (segR(ls, le, o)) cost += 1000; }); } /* the leader of a pill must not run through a label or a place */
            if (!best || cost < best.cost) best = { b: b, cost: cost, pt: pt, off: off, t: tl };
          });
        });
        if (!best || best.cost >= 1000) { hidP++; return; }
        occ.push(best.b); q.chip = best;
        if (best.off) { var nb = near(best.b, best.pt.x, best.pt.y); leads.push({ x1: best.pt.x, y1: best.pt.y, x2: nb.x, y2: nb.y, dot: 1, q: q }); }
      });
      // draw
      var S = h.svg, pid = h.uid('k-sp'), kinds = [], stats = [], tones = {}, dashed = false;
      var badge = function (kind, st) {
        return S('g', { class: 'k-sp-badge', style: { '--k-sp-c': h.catFor(kind) } }, [S('rect', { x: -R, y: -R, width: 2 * R, height: 2 * R, rx: 8 }),
          S('g', { transform: 'translate(-8 -8)', class: 'k-sp-ico' }, [S('path', { d: icon(kind) })]),
          st ? S('circle', { class: 'k-sp-dot k-s-' + st, cx: R - 2, cy: -R + 2, r: st === 'crit' ? 6.5 : 5 }) : null]);
      };
      var svg = S('svg', { class: 'k-sp-svg' + (P.length > 24 ? ' k-sp-dense' : ''), width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: c.onSelect ? 'group' : 'img',
        'aria-label': (c.title ? c.title + ': ' : 'Site plan: ') + N.length + ' places, ' + P.length + ' routes' }, [
        S('defs', {}, [S('pattern', { id: pid, width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, [S('circle', { cx: 2, cy: 2, r: 1, class: 'k-sp-gd' })])]),
        S('rect', { class: 'k-sp-bg', x: .5, y: .5, width: W - 1, height: H - 1, rx: 8 }), S('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 8, fill: 'url(#' + pid + ')' })]);
      areaEls.forEach(function (z) {
        svg.appendChild(S('g', { class: 'k-sp-area' + (z.st ? ' k-s-' + z.st : '') }, [S('title', { text: z.a.label + (z.a.status ? ' (' + z.a.status + ')' : '') }),
          S('rect', { x: z.r.x, y: z.r.y, width: z.r.w, height: z.r.h, rx: 8 })]));
        if (z.a.status && stats.indexOf(String(z.a.status)) < 0) { stats.push(String(z.a.status)); tones[String(z.a.status)] = z.a.tone || z.a.status; }
      });
      P.forEach(function (q) {
        if (q.p.dashed) dashed = true;
        svg.appendChild(S('polyline', { 'data-a': q.f.n.id, 'data-b': q.t.n.id, class: 'k-sp-path' + (q.p.dashed ? ' k-sp-dash' : '') + (q.p.status || q.p.tone ? ' k-s-' + h.statusKind(q.p.tone || q.p.status) : ''), points: q.pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ') },
          [S('title', { text: (q.f.n.label + ' \u2194 ' + q.t.n.label) + (q.p.label ? ': ' + q.p.label : '') })]));
      });
      areaEls.forEach(function (z) { // captions sit above the routes with a halo, so a route that must pass behind one never strikes through it
        svg.appendChild(S('g', { class: 'k-sp-area k-sp-acap' + (z.st ? ' k-s-' + z.st : ''), 'pointer-events': 'none' }, [S('text', { x: z.b.x + 2, y: z.b.y + 12 }, z.txt.map(function (x, i) { return S('tspan', { x: z.b.x + 2, dy: i ? 14 : 0, text: x }); }))]));
      });
      leads.forEach(function (l) {
        svg.appendChild(S('line', { class: 'k-sp-lead' + (l.q ? ' k-sp-lq' + (l.q.p.status || l.q.p.tone ? ' k-s-' + h.statusKind(l.q.p.tone || l.q.p.status) : '') : ''), x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }));
        if (l.dot) svg.appendChild(S('circle', { class: 'k-sp-ld' + (l.q ? ' k-sp-lq' + (l.q.p.status || l.q.p.tone ? ' k-s-' + h.statusKind(l.q.p.tone || l.q.p.status) : '') : ''), cx: l.x1, cy: l.y1, r: l.q ? 3.5 : 2.5 }));
      });
      P.forEach(function (q) {
        if (!q.chip) return;
        var b = q.chip.b;
        svg.appendChild(S('g', { 'data-a': q.f.n.id, 'data-b': q.t.n.id, class: 'k-sp-chip' + (q.p.status || q.p.tone ? ' k-s-' + h.statusKind(q.p.tone || q.p.status) : '') }, [S('title', { text: String(q.p.label) }), S('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h > 20 ? 12 : 9 }),
          S('text', { x: b.x + b.w / 2, y: b.y + (b.h > 20 ? 13 : 13), 'text-anchor': 'middle' }, q.chip.t.map(function (x, i) { return S('tspan', { x: b.x + b.w / 2, dy: i ? 12 : 0, text: x }); }))]));
      });
      N.forEach(function (o) {
        var n = o.n, tip = n.label + (n.status ? ' (' + n.status + ')' : '') + (n.sub ? ' - ' + n.sub : ''), on = c.onSelect || n.href;
        if (kinds.indexOf(o.kind) < 0) kinds.push(o.kind);
        if (n.status && stats.indexOf(String(n.status)) < 0) { stats.push(String(n.status)); tones[String(n.status)] = n.tone || n.status; }
        var g = S(n.href ? 'a' : 'g', { class: 'k-sp-node' + (on ? ' k-sp-int' : '') + (c.selected != null && String(c.selected) === String(n.id) ? ' k-sp-sel' : ''), id: 'a-site-' + String(n.id).replace(/[^\w-]/g, '-'),
          transform: 'translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')', href: n.href, tabindex: c.onSelect && !n.href ? 0 : null, role: c.onSelect && !n.href ? 'button' : null,
          'aria-label': on ? tip : null }, [S('title', { text: tip }), badge(o.kind, o.st)]);
        if (c.onSelect) {
          g.addEventListener('click', function () { c.onSelect(n); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.onSelect(n); } });
        }
        var hot = function (on) {
          svg.classList.toggle('k-sp-hot', on);
          [].forEach.call(svg.querySelectorAll('[data-a]'), function (e) { e.classList.toggle('k-sp-on', on && (e.getAttribute('data-a') === String(n.id) || e.getAttribute('data-b') === String(n.id))); });
        };
        g.addEventListener('mouseenter', function () { hot(true); }); g.addEventListener('mouseleave', function () { hot(false); });
        g.addEventListener('focusin', function () { hot(true); }); g.addEventListener('focusout', function () { hot(false); });
        svg.appendChild(g);
        if (o.lbl) {
          var b = o.lbl.b, ax = o.lbl.an === 'start' ? b.x + 3 : o.lbl.an === 'end' ? b.x + b.w - 3 : b.x + b.w / 2;
          var zone = null, cx0 = b.x + b.w / 2, cy0 = b.y + b.h / 2;
          areaEls.forEach(function (z) { if (cx0 > z.r.x && cx0 < z.r.x + z.r.w && cy0 > z.r.y && cy0 < z.r.y + z.r.h) zone = z; });
          var tx = S('text', { class: 'k-sp-lbl' + (zone ? ' k-sp-lz' + (zone.st ? ' k-s-' + zone.st : '') : ''), x: ax, y: b.y + 12, 'text-anchor': o.lbl.an }, o.lbl.L.map(function (x, i) { return S('tspan', { x: ax, dy: i ? 14 : 0, text: x }); }));
          if (o.lbl.l2) tx.appendChild(S('tspan', { class: 'k-sp-sub', x: ax, dy: 14, text: o.lbl.l2 }));
          svg.appendChild(tx);
        }
      });
      el.appendChild(h.el('div', { class: 'k-sp' }, [svg]));
      var wrap = el.firstChild, notes = [];
      if (hid) notes.push(hid + ' of ' + N.length + ' place ' + (hid > 1 ? 'labels' : 'label') + ' hidden at this size (hover a place for its name)');
      if (hidP) notes.push(hidP + ' route ' + (hidP > 1 ? 'labels' : 'label') + ' hidden at this size (hover a route)');
      if (c.legend) {
        var lg = h.el('ul', { class: 'k-sp-legend', 'aria-label': 'Legend' });
        kinds.forEach(function (k) {
          lg.appendChild(h.el('li', {}, [S('svg', { width: 20, height: 20, viewBox: '-14 -14 28 28', 'aria-hidden': 'true' }, [badge(k)]), h.el('span', { text: k.charAt(0).toUpperCase() + k.slice(1) })]));
        });
        var byTone = {}; // one entry per colour: words that share a colour share a legend item
        stats.forEach(function (s) { var k = h.statusKind(tones[s]); (byTone[k] = byTone[k] || []).push(s); });
        Object.keys(byTone).forEach(function (k) { lg.appendChild(h.el('li', {}, [h.el('span', { class: 'k-b-dot k-s-' + k, 'aria-hidden': 'true' }), h.el('span', { text: byTone[k].join(' / ') })])); });
        if (dashed) lg.appendChild(h.el('li', {}, [S('svg', { width: 24, height: 8, viewBox: '0 0 24 8', 'aria-hidden': 'true' }, [S('line', { class: 'k-sp-path k-sp-dash', x1: 1, y1: 4, x2: 23, y2: 4 })]), h.el('span', { text: c.dashedLabel })]));
        wrap.appendChild(lg);
      }
      if (notes.length) wrap.appendChild(h.el('p', { class: 'k-sp-note', text: notes.join('. ') + '.' }));
    }
  });
})();
