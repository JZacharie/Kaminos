/* AI-DLC UI kit chart helpers (MIT-0). Inline SVG, no libraries, colours only through kit tokens.
   chartBar / chartLine / chartDonut / sparkline fill an element (selector or node) with an accessible
   <svg role="img"> (title + desc generated from the numbers) and an HTML legend. Needs seed.js (esc). */
var _chartN = 0;
function _chartEl(t) { return typeof t === 'string' ? document.querySelector(t) : t; }
function _nice(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function _num(v) { return String(Math.round(v * 10) / 10); }
// Tick label text and its width in px (12 px labels, about 6.2 px per character): the left margin is sized from the widest tick, so a label is never clipped.
function _tickTxt(v, unit) { var u = String(unit || '').replace(/^\s+/, ''); return String(Math.round(v * 100) / 100) + (u ? (/^[%\u00b0]/.test(u) ? '' : '\u00a0') + u : ''); }
function _tw(t) { return String(t).length * 6.2 + 4; }
// Round tick values: about n intervals with a step of 1, 2, 5 x 10^k. Returns { lo, hi, ticks } (the range is widened to the ticks unless fixed).
function _ticks(lo, hi, n, fixLo, fixHi) {
  var step = _nice((hi - lo) / n || 1), t = [], a = fixLo ? lo : Math.floor(lo / step) * step, b = fixHi ? hi : Math.ceil(hi / step) * step, v;
  if (b === a) b = a + step;
  for (v = a; v <= b + step * 1e-6; v += step) t.push(Math.round(v / step * 1e6) / 1e6 * step);
  return { lo: a, hi: b, ticks: t };
}
// Width of the chart in px: the width of its figure (so text is 12 px on screen, not scaled), 360 while it is hidden. The chart is drawn again when the figure changes width.
function _cw(el) { var w = el && el.clientWidth ? el.clientWidth : 0; return Math.max(240, Math.min(w || 360, 1200)); }
function _watch(el, redraw) {
  el._kcRedraw = redraw;
  if (el._kcRo || typeof ResizeObserver === 'undefined') return;
  var last = el.clientWidth;
  el._kcRo = new ResizeObserver(function () { var w = el.clientWidth; if (w && Math.abs(w - last) > 6) { last = w; el._kcRedraw(); } else if (w && !last) { last = w; el._kcRedraw(); } });
  el._kcRo.observe(el);
}
function _svg(cls, vb, title, desc, body) {
  var n = ++_chartN;
  return '<svg class="' + cls + '" viewBox="0 0 ' + vb + '" role="img" aria-labelledby="kc-t' + n + ' kc-d' + n + '">' +
    '<title id="kc-t' + n + '">' + esc(title) + '</title><desc id="kc-d' + n + '">' + esc(desc) + '</desc>' + body + '</svg>';
}
function _legend(items) {
  return '<ul class="k-legend">' + items.map(function (it, i) { return '<li class="k-s' + (i % 5 + 1) + '">' + esc(it) + '</li>'; }).join('') + '</ul>';
}
// x axis labels: all of them when they fit; else wrapped on spaces into two lines; else (rotate: true, for bars) slanted so every bar keeps its name, or (lines) every 2nd, 3rd ... one.
// Never overlapping, never cut. x(i) = centre of label i, slot = px per label. y = the axis line. Returns { svg, rows, extra } (extra = height in px the labels need below the axis).
function _xlabels(labels, x, y, slot, rotate) {
  var n = labels.length, widest = labels.reduce(function (m, l) { return Math.max(m, _tw(l)); }, 0), step = 1, rows = 1, rot = false, lines = labels.map(function (l) { return [String(l)]; });
  if (widest > slot - 4) {
    lines = labels.map(function (l) { l = String(l); var parts = l.split(' '), best = [l], cut, k, w = _tw(l); for (k = 1; k < parts.length; k++) { cut = [parts.slice(0, k).join(' '), parts.slice(k).join(' ')]; if (Math.max(_tw(cut[0]), _tw(cut[1])) < w) { best = cut; w = Math.max(_tw(cut[0]), _tw(cut[1])); } } return best; });
    var w2 = lines.reduce(function (m, ln) { return Math.max(m, _tw(ln[0]), _tw(ln[1] || '')); }, 0);
    if (w2 <= slot - 4) rows = 2;
    else { lines = labels.map(function (l) { return [String(l)]; }); if (rotate) rot = true; else step = Math.ceil((widest + 6) / Math.max(slot, 1)); }
  }
  return { rows: rows, extra: rot ? Math.min(Math.round(widest * 0.64) + 24, 120) : rows === 2 ? 44 : 30, svg: labels.map(function (l, i) {
    if (i % step) return '';
    if (rot) return '<text class="k-tick" transform="translate(' + _num(x(i) + 4) + ' ' + (y + 14) + ') rotate(-40)" text-anchor="end">' + esc(l) + '</text>';
    return '<text class="k-tick" x="' + _num(x(i)) + '" y="' + (y + 22) + '" text-anchor="middle">' + esc(lines[i][0]) + '</text>' + (lines[i][1] ? '<text class="k-tick" x="' + _num(x(i)) + '" y="' + (y + 36) + '" text-anchor="middle">' + esc(lines[i][1]) + '</text>' : '');
  }).join('') };
}
// bands: [{ from, to, label?, tone?: warn|ok|bad|info|accent }] shade a value range on the y axis (a tariff band, a comfort range); xbands: [{ from, to, label?, tone? }] shade label indexes (from..to inclusive) on the x axis (peak hours).
function _bands(o, L, R, T, W, H, B, y, xl, n) {
  var out = '', gw = (W - L - R) / n;
  (o.bands || []).forEach(function (b) {
    var y0 = Math.max(T, Math.min(y(Math.max(b.from, b.to)), H - B)), y1 = Math.max(T, Math.min(y(Math.min(b.from, b.to)), H - B));
    out += '<rect class="k-band k-tone-' + (b.tone || 'warn') + '" x="' + L + '" y="' + _num(y0) + '" width="' + (W - L - R) + '" height="' + _num(Math.max(y1 - y0, 0)) + '"/>' + (b.label ? '<text class="k-band-label k-tick-halo" x="' + (W - R - 4) + '" y="' + _num(y0 + 13) + '" text-anchor="end">' + esc(b.label) + '</text>' : '');
  });
  (o.xbands || []).forEach(function (b) {
    var x0 = xl(b.from) - gw / 2, x1 = xl(b.to) + gw / 2;
    out += '<rect class="k-band k-tone-' + (b.tone || 'warn') + '" x="' + _num(Math.max(x0, L)) + '" y="' + T + '" width="' + _num(Math.min(x1, W - R) - Math.max(x0, L)) + '" height="' + (H - B - T) + '"/>' + (b.label ? '<text class="k-band-label k-tick-halo" x="' + _num(Math.max(x0, L) + 4) + '" y="' + (T + 12) + '">' + esc(b.label) + '</text>' : '');
  });
  return out;
}

// chartBar('#sel', { title, desc?, labels: ['W1', ...], series: [{ name, values: [..] }], stacked?: true, unit?: '', bands?, xbands? })
function chartBar(target, o) {
  var el = _chartEl(target); if (!el) return; _watch(el, function () { chartBar(el, o); });
  var S = o.series, n = o.labels.length, W = _cw(el), stacked = o.stacked !== false && S.length > 1;
  var tot = o.labels.map(function (_, i) { return S.reduce(function (s, x) { return s + x.values[i]; }, 0); });
  var top = Math.max.apply(null, stacked ? tot : S.reduce(function (a, x) { return a.concat(x.values); }, [0])), tk = _ticks(0, top, 4, true, false), max = tk.hi;
  var L = Math.ceil(Math.max.apply(null, tk.ticks.map(function (v) { return _tw(_tickTxt(v, o.unit)); }))) + 10, R = 8, T = 10;
  var gw = (W - L - R) / n, xc = function (i) { return L + gw * (i + 0.5); }, xl = _xlabels(o.labels, xc, 0, gw, true), B = xl.extra, H = Math.round(Math.max(170, Math.min(W * 0.55, 300)));
  xl = _xlabels(o.labels, xc, H - B, gw, true);
  var y = function (v) { return T + (H - T - B) * (1 - v / max); };
  var bw = stacked || S.length === 1 ? Math.min(gw * 0.6, 56) : Math.min(gw * 0.8 / S.length, 40), g = _bands(o, L, R, T, W, H, B, y, xc, n);
  tk.ticks.forEach(function (v, k) { g += '<line class="' + (k ? 'k-gridl' : 'k-axis') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + _num(y(v)) + '" y2="' + _num(y(v)) + '"/><text class="k-tick" x="' + (L - 6) + '" y="' + _num(y(v) + 4) + '" text-anchor="end">' + _tickTxt(v, o.unit) + '</text>'; });
  var bars = '';
  o.labels.forEach(function (_, i) {
    var acc = 0;
    S.forEach(function (s, j) {
      var v = s.values[i], x = xc(i) - (stacked || S.length === 1 ? bw : bw * S.length) / 2 + (stacked ? 0 : bw * j), h = (H - T - B) * v / max;
      bars += '<rect class="k-bar k-s' + (j % 5 + 1) + '" x="' + _num(x) + '" y="' + _num(y(stacked ? acc + v : v)) + '" width="' + _num(bw) + '" height="' + _num(Math.max(h, 0)) + '" rx="2"/>';
      acc += v;
    });
  });
  var desc = o.desc || o.title + '. ' + o.labels.map(function (l, i) { return l + ': ' + _num(stacked || S.length === 1 ? tot[i] : S[0].values[i]) + (o.unit || ''); }).join('; ');
  el.innerHTML = _svg('k-bar-chart', W + ' ' + H, o.title, desc, g + bars + xl.svg) + (S.length > 1 ? _legend(S.map(function (s) { return s.name; })) : '');
}

// chartLine('#sel', { title, desc?, labels, series: [{ name, values }], min?, max?, unit?, area?: true, threshold?: { value, label }, bands?, xbands? })
function chartLine(target, o) {
  var el = _chartEl(target); if (!el) return; _watch(el, function () { chartLine(el, o); });
  var S = o.series, n = o.labels.length, W = _cw(el), u = o.unit || '';
  var all = S.reduce(function (a, s) { return a.concat(s.values); }, o.threshold ? [o.threshold.value] : []);
  var lo0 = o.min != null ? o.min : Math.min.apply(null, all), hi0 = o.max != null ? o.max : Math.max.apply(null, all);
  var tk = _ticks(lo0, hi0, 4, o.min != null, o.max != null), lo = tk.lo, hi = tk.hi;
  var L = Math.ceil(Math.max.apply(null, tk.ticks.map(function (v) { return _tw(_tickTxt(v, u)); }))) + 10, R = Math.ceil(_tw(o.labels[n - 1]) / 2) + 2, T = 12;
  var x = function (i) { return L + (W - L - R) * (n > 1 ? i / (n - 1) : 0.5); }, slot = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
  var xl = _xlabels(o.labels, x, 0, slot), B = xl.extra, H = Math.round(Math.max(170, Math.min(W * 0.55, 300)));
  xl = _xlabels(o.labels, x, H - B, slot);
  var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
  var body = _bands(o, L, R, T, W, H, B, y, x, Math.max(n - 1, 1));
  tk.ticks.forEach(function (v, k) { body += '<line class="' + (k ? 'k-gridl' : 'k-axis') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + _num(y(v)) + '" y2="' + _num(y(v)) + '"/><text class="k-tick" x="' + (L - 6) + '" y="' + _num(y(v) + 4) + '" text-anchor="end">' + _tickTxt(v, u) + '</text>'; });
  if (o.threshold) body += '<line class="k-threshold" x1="' + L + '" x2="' + (W - R) + '" y1="' + _num(y(o.threshold.value)) + '" y2="' + _num(y(o.threshold.value)) + '"/><text class="k-tick k-tick-halo" x="' + (W - R) + '" y="' + _num(y(o.threshold.value) - 5) + '" text-anchor="end">' + esc(o.threshold.label || '') + '</text>';
  S.forEach(function (s, j) {
    var pts = s.values.map(function (v, i) { return _num(x(i)) + ' ' + _num(y(v)); });
    if (o.area !== false && j === 0) body += '<path class="k-area k-s1" d="M' + pts[0] + ' L' + pts.join(' L') + ' L' + _num(x(n - 1)) + ' ' + _num(y(lo)) + ' L' + _num(x(0)) + ' ' + _num(y(lo)) + 'Z"/>';
    body += '<path class="k-line k-s' + (j % 5 + 1) + '" d="M' + pts.join(' L') + '"/><circle class="k-pt k-s' + (j % 5 + 1) + '" cx="' + _num(x(n - 1)) + '" cy="' + _num(y(s.values[n - 1])) + '" r="4"/>';
  });
  body += xl.svg;
  var first = S[0].values, desc = o.desc || o.title + '. ' + S[0].name + ' from ' + _num(first[0]) + u + ' to ' + _num(first[n - 1]) + u + ', minimum ' + _num(Math.min.apply(null, first)) + u + ', maximum ' + _num(Math.max.apply(null, first)) + u + (o.threshold ? '; limit ' + _num(o.threshold.value) + u : '') + '.';
  el.innerHTML = _svg('k-line-chart', W + ' ' + H, o.title, desc, body) + (S.length > 1 ? _legend(S.map(function (s) { return s.name; })) : '');
}

// chartDonut('#sel', { title, desc?, items: [{ label, value }], center?: '24', centerLabel?: 'shipments' })
function chartDonut(target, o) {
  var r = 56, C = 2 * Math.PI * r, total = o.items.reduce(function (s, it) { return s + it.value; }, 0), acc = 0, segs = '';
  o.items.forEach(function (it, i) {
    var len = C * it.value / total;
    segs += '<circle class="k-donut-seg k-s' + (i % 5 + 1) + '" cx="80" cy="80" r="' + r + '" stroke-dasharray="' + _num(Math.max(len - 2, 0)) + ' ' + _num(C - Math.max(len - 2, 0)) + '" stroke-dashoffset="' + _num(-acc) + '" transform="rotate(-90 80 80)"/>';
    acc += len;
  });
  var mid = '<text class="k-donut-num" x="80" y="82" text-anchor="middle">' + esc(o.center != null ? o.center : total) + '</text>' + (o.centerLabel ? '<text class="k-tick" x="80" y="100" text-anchor="middle">' + esc(o.centerLabel) + '</text>' : '');
  var desc = o.desc || o.title + '. ' + o.items.map(function (it) { return it.label + ': ' + it.value; }).join('; ');
  _chartEl(target).innerHTML = _svg('k-donut', '160 160', o.title, desc, segs + mid) + _legend(o.items.map(function (it) { return it.label + ' ' + it.value; }));
}

// sparkline('#sel', { title, values: [..] })
function sparkline(target, o) {
  var W = 120, H = 32, v = o.values, lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), n = v.length;
  var x = function (i) { return 3 + (W - 6) * i / Math.max(n - 1, 1); }, y = function (a) { return 3 + (H - 6) * (1 - (a - lo) / ((hi - lo) || 1)); };
  var pts = v.map(function (a, i) { return _num(x(i)) + ' ' + _num(y(a)); });
  _chartEl(target).innerHTML = _svg('k-spark', W + ' ' + H, o.title, o.desc || o.title + ': from ' + _num(v[0]) + ' to ' + _num(v[n - 1]) + ', range ' + _num(lo) + ' to ' + _num(hi) + '.',
    '<path class="k-line k-s1" d="M' + pts.join(' L') + '"/><circle class="k-pt k-s1" cx="' + _num(x(n - 1)) + '" cy="' + _num(y(v[n - 1])) + '" r="3"/>');
}
