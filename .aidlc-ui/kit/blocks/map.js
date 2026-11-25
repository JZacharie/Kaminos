/* @block map 1.0 -- places and routes on a real Europe basemap cropped to what is shown, or a schematic grid.
 * Pick: Places and routes on a real Europe basemap, cropped to what is shown; edge chips for far places; schematic mode.
 * Load: blocks.css, core.js, map.css, ../data/basemap.js, map.js
 * Call: K.block.map('#a-map', {places: [{id:'a-map-ams', lat:52.309, lon:4.764, label:'AMS'}, {id:'a-map-lis', lat:38.781, lon:-9.136, label:'LIS'}], routes: [{from:'a-map-lis', to:'a-map-ams'}]})
 * Config:
 *   places  required [{id?, lat, lon, label?, sub?, kind?, status?, cat?, shape? dot|square|diamond|triangle|ring, priority?, x?, y?}]  off the basemap = edge chip; x,y 0..1 (schematic).
 *           Label beside its marker, or (hub knot, no clean side) in a callout column with a leader; no room = small marker named on hover. Same kind/cat/status = same colour.
 *   routes  [{from, to, id?, status?, cat?, kind?, dashed?, label?, distance?, via?}]  ends = place ids, offmap ids or [lat, lon]; km = great-circle (along via). At an end of 3+ arcs,
 *           arcs within ~25 deg leave as one bundle of lanes, then fan out. Km on long, clear routes, else on hover. via [[lat, lon], ...] = the app's waypoints: a tight curve through them.
 *   offmap  [{id, label, toward:[lat, lon], sub?, status?, cat?, kind?}]  chip on the frame edge, dashed leg from the route's place
 *   legend  [{label, cat|status|kind, shape?, dashed?}]  shape line|dash or dashed = line swatch; default: from markers and routes
 *   mode geo|schematic; fit places|all; padding (40); height; aspect '1:1'|'16:9'|1.5; labelWidth (240); selected; onSelect(place, merged)
 *   merge (true), mergeRadius (14): closer pins share ONE marker, 2 = "A \u00b7 B" + ring, 3+ = bubble "A +n more". (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty, loading, error, bad config.
 */
(function () {
'use strict';
var K = window.K, hyp = Math.hypot, mn = Math.min, mx = Math.max;
if (!K || !K.block || !K.block.define) { console.warn('[K.block] map: load core.js before map.js'); return; }
var SH = {
  dot: '<circle class="k-map-pin" r="5.5"/>', square: '<rect class="k-map-pin" x="-5" y="-5" width="10" height="10" rx="2"/>',
  diamond: '<rect class="k-map-pin" x="-5" y="-5" width="10" height="10" rx="1.5" transform="rotate(45)"/>', triangle: '<path class="k-map-pin" d="M0-6.5L6.5 5H-6.5Z"/>',
  ring: '<circle class="k-map-pin k-map-ring" r="5"/>'
};
var SIDES = [['r', 9, 4, 0], ['l', -9, 4, 2], ['t', 0, -11, 1], ['b', 0, 19, 1], ['tr', 8, -8, 0], ['tl', -8, -8, 2], ['br', 8, 17, 0], ['bl', -8, 17, 2]];
var isN = function (v) { return typeof v === 'number' && isFinite(v); };
var r1 = function (v) { return Math.round(v * 10) / 10; };
var hit = function (a, b, g) { g = g || 0; return a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g; };
var free = function (b, list, g) { for (var i = 0; i < list.length; i++) if (hit(b, list[i], g)) return false; return true; };
var inside = function (b, W, H) { return b.x >= 3 && b.y >= 3 && b.x + b.w <= W - 3 && b.y + b.h <= H - 3; };
var tone = function (h, it) {
  if (it.status != null && it.status !== '') return { c: 'var(--k-' + h.statusKind(it.status) + ')', t: String(it.status) };
  var k = it.cat != null && it.cat !== '' ? it.cat : it.kind;
  return k != null && k !== '' ? { c: h.catFor(k), t: String(k) } : null;
};
var swatch = function (shape, col, dash) {
  var w = SH[shape] ? 16 : 20;
  return '<svg class="k-map-sw" width="' + w + '" height="14" viewBox="' + -w / 2 + ' -7 ' + w + ' 14" aria-hidden="true"><g style="--c:' + col + '">' + (SH[shape] || '<path class="k-map-arc' + (shape === 'dash' || dash ? ' k-map-dash' : '') + '" d="M-9 0H9"/>') + '</g></svg>';
};
K.block.define('map', {
  version: '1.0',
  resize: true,
  emptyText: 'No places to show on the map yet',
  schema: {
    places: { type: 'array', required: true, of: {
      id: { type: 'text' }, lat: { type: 'number' }, lon: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, label: { type: 'text' }, sub: { type: 'text' },
      kind: { type: 'text' }, status: { type: 'text' }, cat: { type: 'text' }, shape: { type: 'string' }, priority: { type: 'number' } } },
    routes: { type: 'array', default: [], of: {
      id: { type: 'text' }, from: { type: 'any', required: true }, to: { type: 'any', required: true }, status: { type: 'text' }, cat: { type: 'text' }, kind: { type: 'text' },
      dashed: { type: 'boolean' }, label: { type: 'text' }, distance: { type: 'boolean' }, via: { type: 'array' } } },
    offmap: { type: 'array', default: [], of: {
      id: { type: 'text' }, label: { type: 'text', required: true }, toward: { type: 'array', required: true }, sub: { type: 'text' }, status: { type: 'text' }, cat: { type: 'text' }, kind: { type: 'text' } } },
    legend: { type: 'array', default: [], of: {
      label: { type: 'text', required: true }, cat: { type: 'text' }, status: { type: 'text' }, kind: { type: 'text' }, shape: { type: 'string' }, dashed: { type: 'boolean' } } },
    mode: { type: 'string', enum: ['geo', 'schematic'], default: 'geo' },
    fit: { type: 'string', enum: ['places', 'all'], default: 'places' },
    padding: { type: 'number', default: 40 }, height: { type: 'number' }, aspect: { type: 'any' }, labelWidth: { type: 'number', default: 240 },
    merge: { type: 'boolean', default: true }, mergeRadius: { type: 'number', default: 14 }, selected: { type: 'text' }, onSelect: { type: 'function' }
  },
  empty: function (c) { return !c.places.length && !c.offmap.length; },
  render: function (el, c, h) {
    var geo = c.mode !== 'schematic';
    if (geo && !(typeof basemapEurope === 'function' && typeof basemapFit === 'function')) throw new Error('load kit/data/basemap.js before map.js');
    var wrap = h.el('div', { class: 'k-map-wrap' });
    el.appendChild(wrap);
    var W = mx(240, Math.round(wrap.clientWidth || el.clientWidth || 640)), pad = mx(8, c.padding);
    var am = String(c.aspect).split(/[:\/x]/), asp0 = am.length > 1 ? am[0] / am[1] : +c.aspect;
    if (!(asp0 > 0.2 && asp0 < 8)) asp0 = 0;
    var Ht0 = Math.round(asp0 ? mx(120, mn(1600, W / asp0)) : c.height || mx(240, mn(440, W * 0.5)));
    var fam = ''; try { fam = getComputedStyle(el).fontFamily; } catch (e) { fam = 'system-ui'; }
    var F12 = '600 12px ' + fam, F11 = '600 11px ' + fam, maxL = mx(40, c.labelWidth);
    var trunc = function (t, w, f) { if (h.measureText(t, f) <= w) return t; var s = t; while (s.length > 1 && h.measureText(s + '\u2026', f) > w) s = s.slice(0, -1); var sp = s.lastIndexOf(' '); if (sp > s.length * 0.55) s = s.slice(0, sp); return s.replace(/[\s\u00b7,;:-]+$/, '') + '\u2026'; };
    var notes = [], skipped = 0, P = [], by = {}, O = [], ob = {};
    c.places.forEach(function (p, i) {
      if (!(geo ? isN(p.lat) && isN(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 : isN(p.x) && isN(p.y))) { skipped++; return; }
      var tn = tone(h, p), q = { p: p, lat: p.lat, lon: p.lon, id: p.id != null ? String(p.id) : '', label: p.label != null ? String(p.label) : (p.id == null && geo ? h.num(p.lat, { dp: 2 }) + ', ' + h.num(p.lon, { dp: 2 }) : ''), tn: tn, col: tn ? tn.c : h.catFor('place'), sh: SH[p.shape] ? p.shape : 'dot' };
      P.push(q); if (q.id) by[q.id] = q;
    });
    c.offmap.forEach(function (o) {
      var t = o.toward;
      if (!geo || !isN(t[0]) || !isN(t[1])) { skipped++; return; }
      var tn = tone(h, o), q = { o: o, chip: true, id: o.id != null ? String(o.id) : '', label: String(o.label), sub: o.sub != null ? String(o.sub) : '', lat: t[0], lon: t[1], col: tn ? tn.c : 'var(--k-text-3)', tn: tn, routes: [] };
      O.push(q); if (q.id) ob[q.id] = q;
    });
    if (!P.length && !O.length) { h.empty(el, 'No places with coordinates', skipped + ' place(s) could not be placed: ' + (geo ? 'lat and lon are numbers' : 'x and y are numbers 0..1')); return; }
    if (!c.height && !asp0 && P.length + O.length <= 1) Ht0 = 300;
    var end = function (e) {
      if (geo && Array.isArray(e) && isN(e[0]) && isN(e[1])) return { lat: e[0], lon: e[1], pt: true };
      var k = e == null ? '' : String(e);
      return by[k] || ob[k] || null;
    };
    var f, S = 1, Hs = Ht0, u = 1, X, Y, US;
    var pjt = function (lat, lon) { return basemapProject(lat, lon); };
    var onBase = function (p) { return p.x >= 0 && p.x <= BASEMAP_W && p.y >= 0 && p.y <= BASEMAP_H; };
    var routes = [];
    var arcOf = function (rr) {
      var A = pjt(rr.a.lat, rr.a.lon), B = pjt(rr.b.lat, rr.b.lon), k, t, w, p;
      if (rr.via) {
        w = [[A.x, A.y]].concat(rr.via.map(function (v) { p = pjt(v[0], v[1]); return [p.x, p.y]; }), [[B.x, B.y]]);
        rr.d = 'M' + r1(w[0][0]) + ' ' + r1(w[0][1]); rr.pts = [w[0]];
        for (k = 0; k + 1 < w.length; k++) {
          var P = [w[mx(0, k - 1)], w[k], w[k + 1], w[mn(w.length - 1, k + 2)]], dl = function (a, b) { return hyp(P[b][0] - P[a][0], P[b][1] - P[a][1]); }, q = [0, 1].map(function (j) { var g = 0.18 * dl(1, 2) / (dl(j, j + 1) + dl(1 + j, 2 + j) || 1); return [P[1 + j][0] + (1 - 2 * j) * (P[2 + j][0] - P[j][0]) * g, P[1 + j][1] + (1 - 2 * j) * (P[2 + j][1] - P[j][1]) * g]; });
          rr.d += 'C' + r1(q[0][0]) + ' ' + r1(q[0][1]) + ' ' + r1(q[1][0]) + ' ' + r1(q[1][1]) + ' ' + r1(P[2][0]) + ' ' + r1(P[2][1]);
          for (t = 1; t <= 10; t++) { var u0 = t / 10, m = 1 - u0, f4 = [m * m * m, 3 * m * m * u0, 3 * m * u0 * u0, u0 * u0 * u0], Q = [P[1], q[0], q[1], P[2]]; rr.pts.push([0, 1].map(function (c) { return f4.reduce(function (s0, f, j) { return s0 + f * Q[j][c]; }, 0); })); }
        }
        return;
      }
      var n = basemapArc(rr.a.lat, rr.a.lon, rr.b.lat, rr.b.lon, { lift: 0, steps: 32 }).match(/-?\d+(?:\.\d+)?/g).map(Number), cx = B.x - A.x, cy = B.y - A.y, len = hyp(cx, cy) || 1, nx = -cy / len, ny = cx / len;
      if (ny > 0) { nx = -nx; ny = -ny; }
      rr.pts = [];
      for (k = 0; k + 1 < n.length; k += 2) { var s0 = Math.sin(Math.PI * k / (n.length - 2)) * 0.12 * len; rr.pts.push([n[k] + nx * s0, n[k + 1] + ny * s0]); }
      rr.d = rr.pts.map(function (q2, i) { return (i ? 'L' : 'M') + r1(q2[0]) + ' ' + r1(q2[1]); }).join('');
    };
    c.routes.forEach(function (r) {
      var a = end(r.from), b = end(r.to);
      if (!a || !b || a === b) { skipped++; return; }
      var tn = tone(h, r), rr = { r: r, a: a, b: b, col: tn ? tn.c : 'var(--k-text-3)', tn: tn, dash: !!r.dashed };
      if (geo) {
        var vw = Array.isArray(r.via) ? r.via.filter(function (v) { return Array.isArray(v) && isN(v[0]) && isN(v[1]); }) : [];
        rr.km = distanceKm(a.lat, a.lon, b.lat, b.lon);
        rr.geoArc = !a.chip && !b.chip && onBase(pjt(a.lat, a.lon)) && onBase(pjt(b.lat, b.lon));
        if (vw.length && rr.geoArc && vw.every(function (v) { return onBase(pjt(v[0], v[1])); })) {
          rr.via = vw; rr.km = 0;
          [[a.lat, a.lon]].concat(vw, [[b.lat, b.lon]]).forEach(function (v, i, all) { if (i) rr.km += distanceKm(all[i - 1][0], all[i - 1][1], v[0], v[1]); });
        }
      }
      routes.push(rr);
    });
    if (geo) routes.forEach(function (rr) { if (rr.geoArc) arcOf(rr); });
    if (geo) {
      var fitPts = [], keyPts = [];
      P.forEach(function (q) { var p = pjt(q.p.lat, q.p.lon); q.out = !onBase(p); if (!q.out) { fitPts.push([q.p.lat, q.p.lon]); keyPts.push([p.x, p.y, pad]); } });
      if (c.fit === 'all') O.forEach(function (o) { if (onBase(pjt(o.lat, o.lon))) fitPts.push([o.lat, o.lon]); });
      routes.forEach(function (r) { if (r.pts) r.pts.forEach(function (p) { keyPts.push([p[0], p[1], 8]); }); });
      var pd = 0.05, asp = W / Ht0;
      for (var it = 0; it < 60; it++) {
        f = basemapFit(fitPts, { pad: pd, aspect: asp, minW: fitPts.length > 1 ? 100 : 600 });
        S = W / f.w;
        var okf = true;
        for (var z = 0; z < keyPts.length && okf; z++) {
          var kx = (keyPts[z][0] - f.x) * S, ky = (keyPts[z][1] - f.y) * S, m = keyPts[z][2];
          if (kx < m || kx > W - m || ky < m || ky > f.h * S - m) okf = false;
        }
        if (okf || (f.w >= BASEMAP_W - 0.5 && f.h >= BASEMAP_H - 0.5)) break;
        if (f.w >= BASEMAP_W - 0.5) { asp *= 0.9; pd = 0.05; continue; }
        pd = pd * 1.15 + 0.01;
      }
      Hs = r1(f.h * S); u = f.w / W;
      X = function (x) { return (x - f.x) * S; }; Y = function (y) { return (y - f.y) * S; };
      P.forEach(function (q) { var p = pjt(q.p.lat, q.p.lon); q.x = X(p.x); q.y = Y(p.y); });
      O.forEach(function (o) { var p = pjt(o.lat, o.lon); o.tx = X(p.x); o.ty = Y(p.y); });
    } else {
      f = { x: 0, y: 0, w: W, h: Ht0 };
      P.forEach(function (q) { q.x = pad + mn(1, mx(0, q.p.x)) * (W - 2 * pad); q.y = pad + mn(1, mx(0, q.p.y)) * (Hs - 2 * pad); });
    }
    US = Math.round(u * 10000) / 10000;
    var E = [], M = [];
    P.forEach(function (q) {
      if (geo && (q.out || q.x < 2 || q.x > W - 2 || q.y < 2 || q.y > Hs - 2)) {
        var o = { o: q.p, chip: true, id: q.id, label: q.label || q.id, sub: q.p.sub != null ? String(q.p.sub) : '', lat: q.p.lat, lon: q.p.lon, col: q.col, tn: q.tn, routes: [], tx: q.x, ty: q.y, fromPlace: q };
        E.push(o);
        routes.forEach(function (r) { if (r.a === q) { r.a = o; r.d = null; } if (r.b === q) { r.b = o; r.d = null; } });
      } else M.push(q);
    });
    O.forEach(function (o) {
      if (o.tx > pad / 2 && o.tx < W - pad / 2 && o.ty > pad / 2 && o.ty < Hs - pad / 2) {
        var q = { p: o.o, id: o.id, label: o.label, tn: o.tn, col: o.col === 'var(--k-text-3)' ? h.catFor('place') : o.col, sh: 'dot', x: o.tx, y: o.ty };
        M.push(q); if (o.id) by[o.id] = q;
        routes.forEach(function (r) { if (r.a === o) r.a = q; if (r.b === o) r.b = q; });
        q.lat = o.lat; q.lon = o.lon;
      } else E.push(o);
    });
    /* hub bundling: at an end of 3+ arcs, arcs within ~25 deg leave as one bundle of lanes, then fan out; the rest radially */
    var hubs = [];
    if (geo) {
      var HB = {}, pxy = function (e) { var p = pjt(e.lat, e.lon); return [X(p.x), Y(p.y)]; }, PI2 = 2 * Math.PI;
      routes.forEach(function (r) { if (r.geoArc && !r.via && !r.a.chip && !r.b.chip) [r.a, r.b].forEach(function (e) { var k = pxy(e).map(Math.round).join(); (HB[k] = HB[k] || []).push({ r: r, e: e }); }); });
      Object.keys(HB).sort(function (x, y) { return HB[y].length - HB[x].length; }).forEach(function (k) {
        var g = HB[k].filter(function (m) { return !m.r.bu; }), N = g.length, H, i, G = [], cur, st = 0, gap;
        if (N < 3) return;
        H = pxy(g[0].e); hubs.push(H);
        g.forEach(function (m) { var o = m.o = pxy(m.r.a === m.e ? m.r.b : m.r.a); m.len = hyp(o[0] - H[0], o[1] - H[1]); m.th = Math.atan2(o[1] - H[1], o[0] - H[0]); });
        g.sort(function (a, b) { return a.th - b.th; });
        gap = function (i) { i %= N; return (g[(i + 1) % N].th - g[i].th + PI2) % PI2 || PI2; };
        for (i = 0; i < N; i++) if (gap(i) > gap(st)) st = i;
        for (i = 1; i <= N; i++) { var a = gap(st + i - 1); if (cur && a < 0.4 && cur.sp + a < 0.72) { cur.sp += a; cur.m.push(g[(st + i) % N]); } else G.push(cur = { m: [g[(st + i) % N]], sp: 0 }); }
        if (G.length < N) G.forEach(function (B) {
          var tx = 0, ty = 0, n = B.m.length, tl, Lt, cr = function (m) { return (tx * (m.o[1] - H[1]) - ty * (m.o[0] - H[0])) / m.len; };
          B.m.forEach(function (m) { tx += Math.cos(m.th); ty += Math.sin(m.th); });
          tl = hyp(tx, ty) || 1; tx /= tl; ty /= tl;
          Lt = n > 1 ? mn(64, 0.42 * mn.apply(null, B.m.map(function (m) { return m.len; }))) : 0;
          if (Lt < 22) Lt = 0;
          B.m.sort(function (a, b) { return cr(a) - cr(b); });
          B.m.forEach(function (m, j) {
            var o = Lt ? (j - (n - 1) / 2) * 3.5 : 0, S0 = [H[0] + tx * Lt - ty * o, H[1] + ty * Lt + tx * o], ux = Lt ? tx : Math.cos(m.th), uy = Lt ? ty : Math.sin(m.th), d = hyp(m.o[0] - S0[0], m.o[1] - S0[1]) * 0.45, q = [H], t, v;
            if (Lt) q.push([H[0] + tx * 9 - ty * o, H[1] + ty * 9 + tx * o], S0);
            for (t = 1; t <= 24; t++) { v = t / 24; q.push([0, 1].map(function (z) { return (1 - v) * (1 - v) * S0[z] + 2 * (1 - v) * v * (S0[z] + (z ? uy : ux) * d) + v * v * m.o[z]; })); }
            if (m.r.a !== m.e) q.reverse();
            m.r.bu = 1; m.r.pts = q.map(function (p) { return [f.x + p[0] * u, f.y + p[1] * u]; });
            m.r.d = m.r.pts.map(function (p, i) { return (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1]); }).join('');
          });
        });
      });
    }
    var markers = [], R = c.merge ? mx(0, c.mergeRadius) : 0;
    M.forEach(function (q) { q.grp = [q]; });
    M.forEach(function (q) {
      if (q.gone) return;
      if (R) M.forEach(function (r) { if (r !== q && !r.gone && hyp(r.x - q.x, r.y - q.y) < R) { r.gone = true; q.grp.push(r); } });
      var ls = []; q.grp.forEach(function (r) { if (r.label && ls.indexOf(r.label) < 0) ls.push(r.label); });
      q.grp.forEach(function (r) { r.mk = q; });
      q.big = q.grp.length > 2;
      q.bc = q.big && q.grp.some(function (r) { return r.col !== q.col; }) ? 'var(--k-text-2)' : q.col;
      q.all = ls.join(' \u00b7 ') + (q.big ? ' (' + q.grp.length + ' places here)' : ''); q.full = q.big ? (ls[0] || '') + ' +' + (q.grp.length - 1) + ' more' : ls.join(' \u00b7 ');
      q.prio = mx.apply(null, q.grp.map(function (r) { return isN(r.p && r.p.priority) ? r.p.priority : 0; }));
      q.sel = c.selected != null && q.grp.some(function (r) { return r.id && r.id === String(c.selected); });
      q.name = q.full ? trunc(q.full, maxL, F12) : ''; q.nw = q.name ? h.measureText(q.name, F12) + 2 : 0;
      markers.push(q);
    });
    var CH = 26, chipBoxes = [], dotBoxes = markers.map(function (q) { var k = q.big ? 13 : 8; return { x: q.x - k, y: q.y - k, w: 2 * k, h: 2 * k }; });
    E.forEach(function (e) {
      routes.forEach(function (r) { if (r.a === e || r.b === e) e.routes.push(r); });
      var auto = e.sub || (e.routes.length === 1 && geo ? h.num(e.routes[0].km, { dp: 0 }) + ' km' : '');
      e.text = e.label + (auto ? ' \u00b7 ' + auto : '');
      e.w = mn(mx(120, W - 12), Math.ceil(h.measureText(e.text, F12)) + 12 + 6 + 16 + 3 + 4); e.h = CH;
    });
    E.sort(function (a, b) { return Math.atan2(a.ty - Hs / 2, a.tx - W / 2) - Math.atan2(b.ty - Hs / 2, b.tx - W / 2); });
    var arcPx = geo ? routes.filter(function (r) { return r.pts && r.d; }).map(function (r) { return r.pts.map(function (p) { return [X(p[0]), Y(p[1])]; }); }) : [], legs = [];
    var cross = function (a, b, c2, d) { var o = function (p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }; return o(a, b, c2) * o(a, b, d) < 0 && o(c2, d, a) * o(c2, d, b) < 0; };
    var ptSeg = function (x, y, a, b) { var vx = b[0] - a[0], vy = b[1] - a[1], t = mx(0, mn(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1))); return hyp(x - a[0] - vx * t, y - a[1] - vy * t); };
    var legCost = function (ox, oy, px, py, own) {
      var L = hyp(px - ox, py - oy), n = mx(2, Math.ceil(L / 4)), cost = 0, hd = {}, hl = {}, k;
      for (k = 0; k <= n; k++) {
        var x = ox + (px - ox) * k / n, y = oy + (py - oy) * k / n, d0 = L * k / n;
        if (d0 < 10 || L - d0 < 14) continue;
        arcPx.forEach(function (pts) { for (var j = 0; j + 1 < pts.length; j++) if (ptSeg(x, y, pts[j], pts[j + 1]) < 6) { cost += 2; break; } });
        markers.forEach(function (m, i) {
          var rr = m.big ? 15 : 11;
          if (m === own) return;
          if (!hd[i] && Math.abs(x - m.x) < rr && Math.abs(y - m.y) < rr) { hd[i] = 1; cost += 120; }
          if (m.nw && !hl[i] && x > m.x - m.nw - 12 && x < m.x + m.nw + 12 && y > m.y - 12 && y < m.y + 6) { hl[i] = 1; cost += 30; }
        });
      }
      legs.forEach(function (g) { if (cross([ox, oy], [px, py], [g[0], g[1]], [g[2], g[3]])) cost += 30; });
      return cost;
    };
    E.forEach(function (e) {
      var src = null; e.routes.forEach(function (r) { var o = r.a === e ? r.b : r.a; if (!src && isN(o.x)) src = o; });
      var ox = src ? src.x : W / 2, oy = src ? src.y : Hs / 2, base = Math.atan2(e.ty - oy, e.tx - ox);
      var x0 = 8 + e.w / 2, x1 = W - x0, y0 = 8 + e.h / 2, y1 = Hs - y0, inf = 1e9, best = null;
      ox = mn(x1, mx(x0, ox)); oy = mn(y1, mx(y0, oy));
      for (var dg = 0; dg <= (src ? 24 : 0) && !(best && best.c <= 2.5 * best.dg); dg = dg > 0 ? -dg : 6 - dg) {
        var th = base + dg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
        var tx = ux > 1e-6 ? (x1 - ox) / ux : ux < -1e-6 ? (x0 - ox) / ux : inf, ty = uy > 1e-6 ? (y1 - oy) / uy : uy < -1e-6 ? (y0 - oy) / uy : inf, t = mn(tx, ty), cx = ox + ux * t, cy = oy + uy * t, slideX = ty <= tx;
        var ok = false, px = cx, py = cy;
        for (var k = 0; k < 80 && !ok; k++) {
          var sd = (k & 1 ? 1 : -1) * Math.ceil(k / 2) * 8;
          px = slideX ? mn(W - e.w / 2 - 8, mx(e.w / 2 + 8, cx + sd)) : cx;
          py = slideX ? cy : mn(Hs - e.h / 2 - 8, mx(e.h / 2 + 8, cy + sd));
          var b = { x: px - e.w / 2, y: py - e.h / 2, w: e.w, h: e.h };
          ok = free(b, dotBoxes, 4) && free(b, chipBoxes, 4);
        }
        if (!ok) { px = cx; py = cy; }
        var cs = (ok ? 0 : 400) + (src ? legCost(ox, oy, px, py, src.mk) : 0) + Math.abs(dg) * 2.5;
        if (!best || cs < best.c) best = { c: cs, dg: Math.abs(dg), x: px, y: py, ang: Math.atan2(py - oy, px - ox) };
        if (dg === 0 && !src) break;
      }
      e.deg = Math.round((src ? best.ang : base) * 180 / Math.PI);
      e.x = best.x; e.y = best.y; chipBoxes.push({ x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h });
      if (src) legs.push([ox, oy, e.x, e.y]);
    });
    routes.forEach(function (r) {
      var a = r.a, b = r.b;
      if ((a.chip && b.chip) || ((a.pt || b.pt) && (a.chip || b.chip))) { r.skip = true; return; }
      if (a.chip || b.chip) r.stub = a.chip ? [b.x, b.y, a.x, a.y] : [a.x, a.y, b.x, b.y];
    });
    var lines = [];
    var dense = function (pts, id, stub) { pts.forEach(function (p, i) { var a = pts[i - 1], n, k; if (a) for (n = mx(1, Math.ceil(hyp(p[0] - a[0], p[1] - a[1]) / 4)), k = 0; k < n; k++) lines.push([a[0] + (p[0] - a[0]) * k / n, a[1] + (p[1] - a[1]) * k / n, id, stub]); }); };
    routes.forEach(function (r, ri) {
      if (r.skip) return;
      var A = r.a, B = r.b;
      if (r.stub) { r.dd = 'M' + r1(f.x + r.stub[0] * u) + ' ' + r1(f.y + r.stub[1] * u) + 'L' + r1(f.x + r.stub[2] * u) + ' ' + r1(f.y + r.stub[3] * u); r.px = [[r.stub[0], r.stub[1]], [r.stub[2], r.stub[3]]]; }
      else if (geo) { if (!r.d) arcOf(r); r.dd = r.d; r.px = r.pts.map(function (p) { return [X(p[0]), Y(p[1])]; }); }
      else {
        var x1 = A.x, y1 = A.y, x2 = B.x, y2 = B.y, cmx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = hyp(x2 - x1, y2 - y1) || 1, lift = mn(40, len * 0.12);
        var qx = cmx - (y2 - y1) / len * lift, qy = my + (x2 - x1) / len * lift; if (qy > my) { qx = 2 * cmx - qx; qy = 2 * my - qy; }
        r.dd = 'M' + r1(x1) + ' ' + r1(y1) + 'Q' + r1(qx) + ' ' + r1(qy) + ' ' + r1(x2) + ' ' + r1(y2);
        r.px = []; for (var k = 0; k <= 16; k++) { var tt = k / 16; r.px.push([(1 - tt) * (1 - tt) * x1 + 2 * (1 - tt) * tt * qx + tt * tt * x2, (1 - tt) * (1 - tt) * y1 + 2 * (1 - tt) * tt * qy + tt * tt * y2]); }
      }
      dense(r.px, ri, !!r.stub);
    });
    var onLeg = function (b) { for (var i = 0; i < lines.length; i++) { var p = lines[i]; if (p[3] && p[0] > b.x - 2 && p[0] < b.x + b.w + 2 && p[1] > b.y - 2 && p[1] < b.y + b.h + 2) return true; } return false; };
    var crosses = function (b, own, m) { var n = 0; m = m || 0; for (var i = 0; i < lines.length; i++) { var p = lines[i]; if (p[2] !== own && p[0] > b.x - m && p[0] < b.x + b.w + m && p[1] > b.y - m && p[1] < b.y + b.h + m) n++; } return n; };
    var obst = dotBoxes.concat(chipBoxes), hidden = 0, CO = {}, nearHub = function (q) { for (var i = 0; i < hubs.length; i++) if (hyp(q.x - hubs[i][0], q.y - hubs[i][1]) < 80) return hubs[i]; return null; };
    routes.forEach(function (r) { [r.a, r.b].forEach(function (e) { if (e.mk) e.mk.deg = (e.mk.deg || 0) + 1; }); });
    var rank = function (q) { return (q.sel ? 1e6 : 0) + q.prio * 1e3 + (q.tn && q.tn.c.indexOf('crit') > 0 ? 500 : 0) + mn(q.deg || 0, 99); };
    markers.slice().sort(function (a, b) { return rank(b) - rank(a); }).forEach(function (q) {
      q.side = null;
      if (!q.name) return;
      var boxes = [];
      for (var s = 0; s < SIDES.length; s++) {
        var ex = q.big ? 5 : q.grp.some(function (r) { return r.col !== q.col; }) ? 4 : 0, S0 = SIDES[s];
        S0 = [S0[0], S0[1] + (S0[1] > 0 ? ex : S0[1] < 0 ? -ex : 0), S0[2] + (S0[2] < -5 ? -ex : S0[2] > 10 ? ex : 0), S0[3]];
        var bx = q.x + S0[1] - (S0[3] === 1 ? q.nw / 2 : S0[3] === 2 ? q.nw : 0), b = { x: bx, y: q.y + S0[2] - 11, w: q.nw, h: 14 };
        if (inside(b, W, Hs) && free(b, obst, 1) && !onLeg(b)) boxes.push([S0, b, crosses(b, -1, 3)]);
      }
      var pick = boxes.reduce(function (m, x) { return !m || x[2] < m[2] ? x : m; }, null), hb = nearHub(q);
      if (pick && !(hb && pick[2])) { q.side = pick[0]; obst.push(pick[1]); } else (CO[hb ? hubs.indexOf(hb) : 'm' + q.x] = CO[hb ? hubs.indexOf(hb) : 'm' + q.x] || []).push(q);
    });
    /* callouts: no clean side (or in a hub knot) = label in a column + leader; no room = small marker, name on hover */
    Object.keys(CO).forEach(function (k) {
      var C = CO[k].slice().sort(function (a, b) { return a.y - b.y; }), cx = 0, best = null;
      C.forEach(function (q) { cx += q.x / C.length; });
      var col = function (Q, sd, gp, dy) {
        var xs = Q.map(function (q) { return q.x; }), ex = sd < 0 ? mn.apply(null, xs) - 8 - gp : mx.apply(null, xs) + 8 + gp, ys = Q.map(function (q) { return q.y + dy; }), i, sh = 0, cs = 0, out = [];
        for (i = 1; i < ys.length; i++) ys[i] = mx(ys[i], ys[i - 1] + 17);
        ys.forEach(function (y, i) { sh += (y - Q[i].y - dy) / ys.length; });
        sh = mx(mn(sh, ys[0] - 12), ys[ys.length - 1] - Hs + 10);
        var Y = ys.map(function (y) { return y - sh; }), e = ex - sd * 12, n = 0, i2, j, k, t;
        for (i2 = 0; i2 < xs.length * xs.length && n < 40; i2++) for (j = 0, k = i2 % xs.length; j < k; j++) if (cross([xs[j], Q[j].y], [e, Y[j]], [xs[k], Q[k].y], [e, Y[k]])) { t = Y[j]; Y[j] = Y[k]; Y[k] = t; n++; }
        Q.forEach(function (q, i) {
          var y = Y[i], b = { x: sd < 0 ? ex - q.nw : ex, y: y - 7, w: q.nw, h: 14 }, A = [q.x, q.y], B = [ex - sd * 12, y];
          cs += (inside(b, W, Hs) ? 0 : 1e4) + (free(b, obst, 2) ? 0 : 300) + crosses(b, -1, 2) * 8 + hyp(B[0] - q.x, y - q.y) * 0.2;
          markers.forEach(function (m) { if (m !== q && ptSeg(m.x, m.y, A, B) < 8) cs += 60; });
          lines.forEach(function (l) { if (l[2] >= 0 && ptSeg(l[0], l[1], A, B) < 3) cs += 3; });
          obst.forEach(function (o) { if (o.w > 24 && ptSeg(o.x + o.w / 2, o.y + 7, A, B) < 9) cs += 40; });
          out.push({ q: q, b: b, x: ex, y: y, sd: sd });
        });
        return { c: cs, L: out };
      };
      [-1, 1, 0].forEach(function (md) { [28, 48, 72, 100, 136].forEach(function (gp) { [0, -20, 20, -40, 40].forEach(function (dy) {
        var r = { c: 0, L: [] };
        [-1, 1].forEach(function (sd) {
          var Q = C.filter(function (q) { return md ? md === sd : (q.x < cx ? -1 : 1) === sd; });
          if (Q.length) { var o = col(Q, sd, gp, dy); r.c += o.c; r.L = r.L.concat(o.L); }
        });
        if (!best || r.c < best.c) best = r;
      }); }); });
      var LS = [];
      best.L.forEach(function (o) {
        var q = o.q, b = null, k, c0, E = o.x - o.sd * 12;
        for (k = 0; k < 13; k++) { var t = { x: o.b.x, y: o.b.y + (k & 1 ? 1 : -1) * Math.ceil(k / 2) * 17, w: o.b.w, h: 14 }, cc = crosses(t, -1, 2) + k / 9; if (inside(t, W, Hs) && free(t, obst, 2) && !LS.some(function (g) { return cross([q.x, q.y], [E, t.y + 7], g[0], g[1]); }) && (!b || cc < c0)) { b = t; c0 = cc; } }
        if (!b) { q.minor = 1; hidden++; return; }
        o.y = b.y + 7; obst.push(b); LS.push([[q.x, q.y], [E, o.y]]); q.co = { x: o.x - q.x, y: o.y - q.y, sd: o.sd };
        dense([[q.x, q.y], [o.x - o.sd * 12, o.y], [o.x - o.sd * 4, o.y]], -2);
      });
    });
    if (hidden) notes.push('Small markers: hover for the name.');
    var ov = '', dist = '', noDist = 0, TIP = {}, hits = '';
    routes.map(function (r, ri) { r.ri = ri; return r; }).sort(function (a, b) { return (b.km || 0) - (a.km || 0); }).forEach(function (r) {
      if (r.skip) return;
      var A = r.a, B = r.b, d = r.dd, pts = r.stub ? null : r.px;
      var kmT = geo && r.km != null ? h.num(r.km, { dp: 0 }) + ' km' : '';
      var txt = geo ? (r.r.distance === false || r.stub ? '' : (r.r.label ? trunc(String(r.r.label), 200, F11) + ' \u00b7 ' : '') + kmT) : (r.r.label != null ? trunc(String(r.r.label), 140, F11) : '');
      var nm = (A.label || A.id || '') + ' \u2192 ' + (B.label || B.id || ''), ttl = nm + (kmT ? ': ' + kmT : '') + (r.r.label && geo ? ' (' + r.r.label + ')' : '');
      ov += '<path class="k-map-arc' + (r.dash || r.stub ? ' k-map-dash' : '') + (r.stub ? ' k-map-stub' : '') + '"' + (r.r.id != null ? ' id="' + h.esc(r.r.id) + '"' : '') + ' data-ri="' + r.ri + '" style="--c:' + r.col + '" d="' + d + '"/>';
      if (r.px) hits += '<path class="k-map-hitarc" data-ri="' + r.ri + '" d="' + r.px.map(function (p, i, a) { return i ? 'l' + r1((p[0] - a[i - 1][0]) * u) + ' ' + r1((p[1] - a[i - 1][1]) * u) : 'm' + r1(f.x + p[0] * u) + ' ' + r1(f.y + p[1] * u); }).join('') + '"><title>' + h.esc(ttl) + '</title></path>';
      if (txt && pts && W >= 420) {
        var got = null, n = pts.length - 1, w = 0, tries = [txt].concat(geo && r.r.label && kmT ? [kmT] : []), ti, pass, tq, pt, bx, al = 0;
        pts.forEach(function (q, i) { if (i) al += hyp(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]); });
        for (pass = 0; pass < 2 && !got; pass++) for (ti = 0; ti < tries.length && !got; ti++) {
          w = Math.ceil(h.measureText(tries[ti], F11)) + 8; txt = tries[ti];
          if (w > al / (pass ? 1.6 : 2) || (geo && al < 110)) continue;
          for (tq = 0; tq < 20 && !got; tq++) {
            pt = pts[Math.round((0.5 + (tq & 1 ? 1 : -1) * Math.ceil(tq / 2) * 0.04) * n)]; bx = { x: pt[0] - w / 2, y: pt[1] - 8, w: w, h: 14 };
            if (inside(bx, W, Hs) && free(bx, obst, pass ? 1 : 6) && !onLeg(bx) && !crosses(bx, r.ri, pass ? 4 : 10)) { got = pt; obst.push(bx); }
          }
        }
        var lab = function (k, p, w, t) { return '<g class="k-map-' + k + '" data-ri="' + r.ri + '" transform="translate(' + r1(f.x + p[0] * u) + ' ' + r1(f.y + p[1] * u) + ') scale(' + US + ')"><rect class="k-map-dbg" x="' + r1(-w / 2) + '" y="-9" width="' + w + '" height="14" rx="3"/><text text-anchor="middle" y="4">' + h.esc(t); };
        if (got) dist += lab('dist', got, w, txt) + (geo && A.mk && B.mk ? '<tspan display="none"> ' + h.esc(A.mk.all + ' ' + B.mk.all) + '</tspan>' : '') + '</text></g>';
        else { noDist++; TIP[r.ri] = lab('tip', pts[n >> 1], Math.ceil(h.measureText(tries[0], F11)) + 8, tries[0]) + '</text></g>'; }
      }
    });
    if (noDist || (W < 420 && geo && routes.length)) notes.push('Hover a route for its ' + (geo ? 'km.' : 'label.'));
    var sc = ' scale(' + US + ')', pins = '';
    markers.forEach(function (q, i) {
      var s = q.side, co = q.co, k0 = co ? (q.big ? 12 : 8) / (hyp(co.x - co.sd * 12, co.y) || 1) : 0, halo = '', k, sub = q.grp.map(function (r) { return r.p && r.p.sub != null ? r.p.sub : ''; }).filter(Boolean).join(' \u00b7 ');
      for (k = 1; k < q.grp.length && !q.big; k++) if (q.grp[k].col !== q.col) halo = '<circle class="k-map-halo" r="' + (9 + 3 * (k - 1)) + '" style="stroke:' + q.grp[k].col + '"/>' + halo;
      pins += '<g class="k-map-marker' + (q.sel ? ' is-sel' : '') + '"' + (q.id ? ' id="' + h.esc(q.id) + '"' : '') + ' data-i="' + i + '" transform="translate(' + r1(f.x + q.x * u) + ' ' + r1(f.y + q.y * u) + ')' + sc + '" style="--c:' + q.bc + '" tabindex="0" role="' + (c.onSelect ? 'button' : 'img') + '" aria-label="' + h.esc(q.all || q.id || 'place') + '">' +
        '<title>' + h.esc((q.all || q.id) + (sub ? ' \u00b7 ' + sub : '')) + '</title><circle class="k-map-hit" r="' + (q.big ? 14 : 11) + '"/><circle class="k-map-sel" r="' + (q.big ? 14 : 10) + '"/>' + halo + (q.big ? '<circle class="k-map-pin k-map-bub" r="11"/><text class="k-map-cnt" y="4" text-anchor="middle">' + q.grp.length + '</text>' : q.minor ? '<g class="k-map-mini">' + SH[q.sh] + '</g>' : SH[q.sh]) +
        (s ? '<text class="k-map-name" x="' + s[1] + '" y="' + s[2] + '" text-anchor="' + ['start', 'middle', 'end'][s[3]] + '">' + h.esc(q.name) + '</text>' : co ? '<path class="k-map-lead" d="M' + r1((co.x - co.sd * 12) * k0) + ' ' + r1(co.y * k0) + 'L' + r1(co.x - co.sd * 12) + ' ' + r1(co.y) + 'H' + r1(co.x - co.sd * 4) + '"/><text class="k-map-name" x="' + r1(co.x) + '" y="' + r1(co.y + 4) + '" text-anchor="' + (co.sd < 0 ? 'end' : 'start') + '">' + h.esc(q.name) + '</text>' : q.minor && q.name ? '<text class="k-map-name k-map-hov" x="7" y="4">' + h.esc(q.name) + '</text>' : '') + '</g>';
    });
    ov += hits + dist + pins;
    var ttl0 = (c.title ? c.title + ': ' : '') + (geo ? 'map' : 'schematic') + ' of ' + markers.length + ' place' + (markers.length === 1 ? '' : 's');
    var svg;
    // role=group, not img: an img's children are presentational, so focusable markers inside it are nested interactive controls (axe)
    if (geo) svg = basemapEurope({ fit: f, title: ttl0, overlay: ov, width: W, height: Hs }).replace('class="k-basemap"', 'class="k-basemap k-map-svg"').replace('style="--k-u:', 'style="--k-px:' + US + ';--k-u:').replace(' role="img" aria-label="', ' role="group" aria-label="');
    else {
      var gid = h.uid('kmg');
      svg = '<svg class="k-map-svg k-map-schem" viewBox="0 0 ' + W + ' ' + Hs + '" width="' + W + '" height="' + Hs + '" style="aspect-ratio:' + W + '/' + Hs + '" role="group" aria-label="' + h.esc(ttl0) + '"><title>' + h.esc(ttl0) + '</title>' +
        '<defs><pattern id="' + gid + '" width="40" height="40" patternUnits="userSpaceOnUse"><path class="k-map-grid" d="M40 0H0V40"/></pattern></defs><rect width="' + W + '" height="' + Hs + '" class="k-map-bg"/><rect width="' + W + '" height="' + Hs + '" fill="url(#' + gid + ')"/>' + ov + '</svg>';
    }
    wrap.innerHTML = svg; var each = function (s, f) { [].forEach.call(wrap.querySelectorAll(s), f); };
    each('.k-map-hitarc', function (p) {
      var ri = p.getAttribute('data-ri'), sv = p.ownerSVGElement, on = function (v) { var t = sv.querySelector('.k-map-tip'); sv.classList.toggle('is-hot', v); if (t) t.remove(); if (v && TIP[ri]) sv.insertAdjacentHTML('beforeend', TIP[ri]); [].forEach.call(sv.querySelectorAll('[data-ri="' + ri + '"]'), function (x) { x.classList.toggle('is-on', v); }); };
      p.onmouseenter = function () { on(1); }; p.onmouseleave = function () { on(0); };
    });
    if (geo && S >= 1.6) each('path[data-c]', function (p) {
      p.setAttribute('d', p.getAttribute('d').split(/z/i).map(function (sp) {
        var n = (sp.match(/-?\d*\.?\d+/g) || []).map(Number), v = [], i, x = n[0], y = n[1], out;
        if (n.length < 8) return sp;
        v.push([x, y]); for (i = 2; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; v.push([x, y]); }
        if (hyp(v[0][0] - x, v[0][1] - y) < 0.05) v.pop();
        var md = function (a, b) { return r1((a[0] + b[0]) / 2) + ' ' + r1((a[1] + b[1]) / 2); };
        out = 'M' + md(v[0], v[1]);
        for (i = 1; i <= v.length; i++) out += 'Q' + r1(v[i % v.length][0]) + ' ' + r1(v[i % v.length][1]) + ' ' + md(v[i % v.length], v[(i + 1) % v.length]);
        return out + 'z';
      }).join(''));
    });
    if (skipped) notes.push(skipped + ' place' + (skipped > 1 ? 's or routes' : ' or route') + ' not shown (no valid ' + (geo ? 'lat/lon' : 'x/y') + ' or unknown id).');
    var warned = false, call = function (p, g) { if (!c.onSelect) return; try { c.onSelect(p, g); } catch (err) { if (!warned) { warned = true; console.warn('[K.block] map: onSelect threw: ' + String((err && err.message) || err).slice(0, 100)); } } };
    E.forEach(function (e) {
      var tag = c.onSelect ? 'button' : 'div';
      wrap.appendChild(h.el(tag, { class: 'k-map-chip', type: c.onSelect ? 'button' : null, title: e.text + (e.routes.length > 1 ? ' (' + e.routes.length + ' routes)' : ''), style: { left: r1(e.x) + 'px', top: r1(e.y) + 'px', '--c': e.col, 'max-width': mx(120, W - 12) + 'px' }, on: { click: function () { call(e.o, [e.o]); } } }, [
        h.svg('svg', { class: 'k-map-ar', width: 12, height: 12, viewBox: '-6 -6 12 12', 'aria-hidden': 'true', style: { transform: 'rotate(' + e.deg + 'deg)' } }, [h.svg('path', { d: 'M-4.5 0H4.5M1.5-3.5L5 0L1.5 3.5' })]),
        h.line(e.text)]));
    });
    each('.k-map-marker', function (g) {
      var q = markers[+g.getAttribute('data-i')];
      var go = function () { each('.k-map-marker.is-sel', function (x) { x.classList.remove('is-sel'); }); g.classList.add('is-sel'); call(q.grp[0].p, q.grp.map(function (r) { return r.p; })); };
      g.onclick = go;
      g.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } };
    });
    var L = [], seen = {};
    var addL = function (label, col, shape, dash) { var k = label + '|' + col + '|' + shape; if (!seen[k]) { seen[k] = 1; L.push({ label: label, col: col, shape: shape, dash: dash }); } };
    if (c.legend.length) c.legend.forEach(function (l) { var t = tone(h, l); addL(String(l.label), t ? t.c : h.catFor('place'), SH[l.shape] || l.shape === 'line' || l.shape === 'dash' ? l.shape : l.dashed ? 'dash' : 'dot', l.dashed); });
    else {
      P.forEach(function (q) { if (q.tn) addL(q.tn.t, q.col, q.sh); });
      O.forEach(function (q) { if (q.tn) addL(q.tn.t, q.col, 'dot'); });
      routes.forEach(function (r) { if (r.tn) addL(r.tn.t, r.col, r.dash ? 'dash' : 'line'); });
    }
    if (L.length) {
      var ul = h.el('ul', { class: 'k-map-key', 'aria-label': 'Legend' }, L.map(function (l) {
        var li = h.el('li', null, [h.el('span', { class: 'k-map-swh' }), h.line(l.label)]);
        li.firstChild.innerHTML = swatch(l.shape, l.col, l.dash);
        return li;
      }));
      wrap.parentNode.appendChild(ul);
      var nL = L.length, rw, kc;
      if (nL > 3 && ul.scrollHeight > ul.querySelector('li').offsetHeight * 1.5) for (rw = 2; rw <= nL; rw++) {
        kc = Math.ceil(nL / rw);
        if (nL - kc * (rw - 1) === 1 && kc > 1) continue;
        ul.style.gridTemplateColumns = 'repeat(' + kc + ',max-content)'; ul.classList.add('is-grid');
        if (ul.scrollWidth <= ul.clientWidth) break;
        ul.classList.remove('is-grid');
      }
    }
    if (markers.some(function (q) { return q.big; })) notes.push('A circled number counts the places at that spot; \u201c+n more\u201d are the others.');
    if (notes.length) wrap.parentNode.appendChild(h.el('p', { class: 'k-map-note', text: notes.join(' ') }));
  }
});
})();
