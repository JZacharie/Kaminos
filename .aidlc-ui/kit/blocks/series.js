/* @block series 1.0 -- Time series: lines, steps and areas with value bands, time windows and threshold lines. Axis text is always 11 px and never clipped.
 * Use for: on-time % by day, temperature + humidity with the allowed range (SpudTrack); wind gusts with the hold limit (Stagehand);
 *   a state-of-charge curve, depot load against its kW limit with tariff windows on the lanes time axis (EV Fleet).
 * Pick: Values over time as lines, steps or areas with threshold lines, value bands and time windows; tickEvery for regular date ticks.
 * Load: blocks.css, core.js, series.css, series.js
 * Call: K.block.series('#a-ontime', {x: ['2026-10-22', '2026-10-23'], series: [{name: 'On time', values: [94, 92], unit: '%'}]})
 * Config:
 *   x          array, required  one per point: ISO dates/date-times ("2026-10-22", "2026-11-04T09:30" -> "22 Oct" / "09:30"), "HH:MM" or any label
 *   series     array, required  [{name, values[], cat?, primary?, role?, area?, step?, dashed?, unit?, dp?, axis?}]
 *     name, values  text, array  values aligned with x; null = gap
 *     cat      number|string    colour key; the one colour you pick. Without it: the PRIMARY series (the one with primary:true, else the first without a role) is drawn in the theme accent,
 *                               a series with role 'baseline'|'compare' (the comparison line: last week, plan, forecast) in a muted neutral, any other in a stable categorical colour per name
 *     primary  boolean          this is the series the chart is about (accent colour); default: the first series
 *     role     'baseline'|'compare'  muted neutral line that never competes with the accent
 *     area, step, dashed  boolean  fill under the line (axis then includes 0) / step-after (load per 30 min) / dashed (plan, forecast)
 *     unit, dp string, number   unit shown once at the top of its axis and in the tooltip; decimals in the tooltip
 *     axis     'left'|'right'   right = second scale (humidity beside temperature)
 *   bands      [{from, to, label?, tone?, axis?}]       value ranges across the plot (allowed range, safe zone)
 *   xbands     [{start, end, label?, tone?}]            time windows full height, start/end = x values; label in a strip above the plot
 *   thresholds [{value, label?, tone?, axis?}]          limit lines; labels move away from data and each other, else go to the legend
 *   tone       ok|warn|crit|info|neutral (aliases as in status); default warn for thresholds, neutral for bands.
 *   A warn/crit threshold is a limit the data must stay under (dir:'max', default; 'min' or a label starting "Min" = lower limit, no highlight): the part of a line above it is
 *   redrawn in the alert colour and the points above it are filled. Use tone ok/info for targets and reference lines (no highlight).
 *     With two value axes (a series with axis:'right' beside left-axis series) a threshold/band takes the colour of the first series on ITS axis and tone is ignored, so
 *     'Max 65 % RH' is the humidity colour, not the temperature one; a label that lacks the axis unit gets it appended ("Max 65" -> "Max 65 (% RH)").
 *   yMin, yMax, y2Min, y2Max, unit, y2Unit, integer     scales; unit = left axis unit if no series has one
 *   height     number, default 240   total px height; text never scales with width
 *   timeAxis   {start:"17:00", end:"08:00"}  x are "HH:MM" placed by clock time (midnight wraps); aligns with lanes. Ticks sit on whole clock hours (every hour, or every 2/3/6 h when
 *              they would touch) plus the start; a tick closer than 3/4 of a step to the start is left out. The end is always labelled when it fits; a labelled window edge or the last point of a curve with no label beside it gets one (its own time, else the nearest whole hour). An xband that wraps the axis end is drawn in both parts, the larger part carries the label.
 *   tickEvery  number            x labels on a plain (date) axis: every N points counted back from the last one (2 = every other day), regular; N grows until the labels fit
 *   yTitle     text              replaces the unit above the left axis: "Occupancy, %" (the unit alone floats; the title says what the axis is)
 *   A threshold whose value is not a tick (92 between 90 and 92.5) is named on its axis in the threshold's tone; the tick labels next to it make room.
 *   zones      'stack'          with two value axes: the left axis gets the upper band of the plot, the right axis the lower band, each scaled to its own data (lines never cross)
 *   plotLeft   number            minimum left gutter in px so the plot lines up with another block (80 beside lanes)
 *   plotRight  number            right gutter in px (default 12, 17 on a clock axis so its last label sits centred; exact when there is no right axis) so the plot ends where another block's plot ends (lanes: measure and tune, 0-12)
 *   legend     boolean           default: shown for 2+ series
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no numbers), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] series: load core.js before series.js'); return; }
  var ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/;
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var mins = function (v) { var m = /(?:^|[T ])(\d{1,2}):(\d{2})/.exec(String(v)); return m ? +m[1] * 60 + +m[2] : NaN; };
  var hhmm = function (m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return p2((m / 60) | 0) + ':' + p2(m % 60); };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var hit = function (a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; };
  var decs = function (s) { var t = String(+(+s).toFixed(6)).split('.')[1]; return t ? t.length : 0; };

  K.block.define('series', {
    version: '1.0', resize: true, emptyText: 'No data for this period',
    schema: {
      x: { type: 'array', required: true },
      series: { type: 'array', required: true, of: {
        name: { type: 'text', required: true }, values: { type: 'array', required: true }, cat: { type: 'any' }, primary: { type: 'boolean' }, role: { type: 'string', enum: ['baseline', 'compare'] }, area: { type: 'boolean' },
        step: { type: 'boolean' }, dashed: { type: 'boolean' }, unit: { type: 'text' }, dp: { type: 'number' }, axis: { type: 'string', enum: ['left', 'right'] } } },
      bands: { type: 'array', of: { from: { type: 'number', required: true }, to: { type: 'number', required: true }, label: { type: 'text' }, tone: { type: 'string' }, axis: { type: 'string', enum: ['left', 'right'] } } },
      xbands: { type: 'array', of: { start: { type: 'time', required: true }, end: { type: 'time', required: true }, label: { type: 'text' }, tone: { type: 'string' } } },
      thresholds: { type: 'array', of: { value: { type: 'number', required: true }, label: { type: 'text' }, tone: { type: 'string' }, dir: { type: 'string', enum: ['max', 'min'] }, axis: { type: 'string', enum: ['left', 'right'] } } },
      yMin: { type: 'number' }, yMax: { type: 'number' }, y2Min: { type: 'number' }, y2Max: { type: 'number' }, unit: { type: 'text' }, y2Unit: { type: 'text' },
      integer: { type: 'boolean' }, height: { type: 'number', default: 240 }, timeAxis: { type: 'object' }, plotLeft: { type: 'number' }, plotRight: { type: 'number' }, legend: { type: 'boolean' }, zones: { type: 'string', enum: ['stack'] }, tickEvery: { type: 'number' }, yTitle: { type: 'text' }
    },
    empty: function (c) {
      return !c.x.length || !c.series.some(function (s) { return Array.isArray(s.values) && s.values.some(function (v) { return v !== null && v !== '' && isFinite(+v); }); });
    },
    render: function (el, c, h) {
      var cw = (function () { try { var q = getComputedStyle(el); return el.clientWidth - (parseFloat(q.paddingLeft) || 0) - (parseFloat(q.paddingRight) || 0); } catch (e) { return el.clientWidth; } })(), W = Math.max(280, cw || 640), /* content width: a card without a title pads the block element itself */ HT = clamp(c.height | 0 || 240, 140, 640), n = c.x.length;
      var FF = (function () { try { return getComputedStyle(el).fontFamily; } catch (e) { return 'system-ui'; } })() || 'system-ui', TF = '11px ' + FF;
      var tw = function (t) { return h.measureText(String(t), TF); };
      /* ---- x labels ---- */
      var iso = c.x.map(function (v) { return ISO.exec(String(v)); });
      var allIso = iso.every(function (m) { return m; }), withT = allIso && iso.every(function (m) { return m[4] != null; });
      var timeOnly = withT && (Date.UTC(+iso[n - 1][1], iso[n - 1][2] - 1, iso[n - 1][3]) - Date.UTC(+iso[0][1], iso[0][2] - 1, iso[0][3])) <= 86400000;
      var fx = function (i, full) {
        var m = iso[i], v = c.x[i];
        if (!m) return String(v);
        var d = new Date(+m[1], m[2] - 1, +m[3]), t = m[4] != null ? p2(+m[4]) + ':' + m[5] : '';
        return full ? h.date(d, { weekday: true }) + (t ? ' ' + t : '') : !t ? h.date(d) : timeOnly ? t : h.date(d) + ' ' + t;
      };
      var tm = null;
      if (c.timeAxis && !isNaN(mins(c.timeAxis.start)) && !isNaN(mins(c.timeAxis.end)) && c.x.every(function (v) { return !isNaN(mins(v)); })) {
        var s0 = mins(c.timeAxis.start), e0 = mins(c.timeAxis.end);
        tm = { s: s0, span: ((e0 - s0 + 1440) % 1440) || 1440 };
      }
      /* ---- series ---- */
      var used = {}, prim = -1;
      c.series.forEach(function (s, i) { if (prim < 0 && s.primary === true) prim = i; });
      if (prim < 0) c.series.forEach(function (s, i) { if (prim < 0 && !s.role) prim = i; });
      var S = c.series.map(function (s, i) {
        var vals = [], k, v;
        for (k = 0; k < n; k++) { v = s.values[k]; v = v === null || v === undefined || v === '' ? NaN : +v; vals.push(isFinite(v) ? v : NaN); }
        var given = s.cat != null && s.cat !== '', col;
        if (given) col = typeof s.cat === 'number' ? h.cat(s.cat) : h.catFor(s.cat);
        else if (s.role === 'baseline' || s.role === 'compare') col = 'var(--k-neutral)'; /* the comparison line is muted: never a second saturated hue beside the accent */
        else if (i === prim) col = 'var(--k-accent)';
        else col = h.catFor(s.name);
        if (!(s.role && !given) && !(i === prim && !given)) { if (used[col]) col = h.cat(i); used[col] = 1; } /* categorical colours never repeat; accent and neutral may */
        return { s: s, name: String(s.name), vals: vals, col: col, ax: s.axis === 'right' ? 'r' : 'l' };
      });
      var hasL = S.some(function (a) { return a.ax === 'l'; });
      var side = function (o) { return o.axis === 'right' || !hasL ? 'r' : 'l'; };
      var unitOf = function (sd) {
        var u = sd === 'l' ? c.unit : c.y2Unit;
        S.forEach(function (a) { if (u == null && a.ax === sd && a.s.unit != null) u = a.s.unit; });
        return u == null ? '' : String(u);
      };
      var uL = hasL ? unitOf('l') : '', uR = S.some(function (a) { return a.ax === 'r'; }) ? unitOf('r') : '', tL = hasL && c.yTitle != null && c.yTitle !== '' ? String(c.yTitle) : uL; /* tL = the text above the left axis: its title, else the unit */
      /* ---- frame geometry ---- */
      var xb = c.xbands || [], hasXLab = xb.some(function (b) { return b.label != null && b.label !== ''; });
      var T = (tL || uR ? 24 : 10) + (hasXLab ? 18 : 0), B = 26, ph = Math.max(60, HT - T - B);
      var tn0 = clamp(Math.round(ph / 46), 3, 6), stack = c.zones === 'stack' && S.some(function (a) { return a.ax === 'r'; }) && hasL;
      var gp = stack ? 22 / ph : 0, zone = { l: [0.45 * (1 - gp) + gp, 1], r: [0, 0.45 * (1 - gp)] };
      var axis = function (sd) {
        var tn = stack ? clamp(Math.round(ph * (zone[sd][1] - zone[sd][0]) / 46), 2, 4) : tn0;
        var arr = S.filter(function (a) { return a.ax === sd; });
        if (!arr.length) return null;
        var thr = (c.thresholds || []).filter(function (t) { return side(t) === sd; }), bnd = (c.bands || []).filter(function (b) { return side(b) === sd; });
        var vs = [];
        arr.forEach(function (a) { a.vals.forEach(function (v) { if (!isNaN(v)) vs.push(v); }); });
        thr.forEach(function (t) { vs.push(t.value); });
        bnd.forEach(function (b) { vs.push(b.from, b.to); });
        var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), fMin = sd === 'l' ? c.yMin : c.y2Min, fMax = sd === 'l' ? c.yMax : c.y2Max;
        if (arr.some(function (a) { return a.s.area; })) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
        if (fMin != null) lo = fMin;
        if (fMax != null) hi = fMax;
        var dmax = -Infinity;
        arr.forEach(function (a) { a.vals.forEach(function (v) { if (!isNaN(v) && v > dmax) dmax = v; }); });
        if (fMax != null && dmax > fMax) { hi = dmax; fMax = null; } /* data is never drawn past the plot: an explicit max below the data is ignored */
        if (hi === lo && fMin == null && fMax == null) { var pad = Math.abs(lo) * 0.1 || 1; lo -= pad; hi += pad; }
        if (hi <= lo) hi = lo + 1;
        var t = h.niceTicks(lo, hi, tn, { integer: c.integer }), dlo = fMin != null ? fMin : t.min, dhi = fMax != null ? fMax : t.max;
        var step = t.step, ts = [].slice.call(t);
        if (fMax == null) {
          if (isFinite(dmax) && dmax > ts[ts.length - 1] - step * 0.06 && !(arr.some(function (a) { return a.s.area; }) && dmax <= 0)) ts.push(+(ts[ts.length - 1] + step).toFixed(10)); /* headroom: the top of the data never sits on the plot edge */
          dhi = ts[ts.length - 1];
        }
        var ticks = ts.filter(function (v) { return v >= dlo - 1e-9 && v <= dhi + 1e-9; });
        /* an explicit max that leaves data above the last labelled tick (62 above 50 with max 70): run the axis to the next tick so the peak is readable */
        if (fMax != null && isFinite(dmax) && ticks.length && dmax > ticks[ticks.length - 1] + step * 0.05 && ts[ts.length - 1] > dhi) { dhi = ts[ts.length - 1]; ticks = ts.filter(function (v) { return v >= dlo - 1e-9 && v <= dhi + 1e-9; }); }
        var dp = decs(step);
        return { z: stack ? zone[sd] : [0, 1], ticks: ticks, lo: dlo, hi: dhi, dp: dp, labels: ticks.map(function (v) { return h.num(v, { dp: dp }); }) };
      };
      var AL = hasL ? axis('l') : null, AR = axis('r');
      var wide = function (A) { return A ? Math.max.apply(null, A.labels.map(tw)) + 12 : 0; };
      var L = Math.max(c.plotLeft || 0, AL ? wide(AL) : 10), R = AR ? Math.max(wide(AR), c.plotRight || 0) : c.plotRight != null ? Math.max(0, c.plotRight) : tm ? 17 : 12; /* a clock axis: room for its closing label to sit centred under the end */
      var pl = L, pw = Math.max(80, W - L - R), pr = pl + pw, pb = T + ph;
      var Y = function (v, A) { return pb - (A.z[0] + (v - A.lo) / (A.hi - A.lo) * (A.z[1] - A.z[0])) * ph; };
      /* ---- x positions ---- */
      var X = [], k, inset = tm || n < 2 ? 0 : clamp(pw / (n * 2), 4, 14); /* first/last points (dots, x labels) stay clear of the plot edge */
      for (k = 0; k < n; k++) X.push(tm ? pl + clamp(((mins(c.x[k]) - tm.s + 1440) % 1440) / tm.span, 0, 1) * pw : n === 1 ? pl + pw / 2 : pl + inset + k * (pw - 2 * inset) / (n - 1));
      var svg = h.svg('svg', { class: 'k-ser', width: W, height: HT, viewBox: '0 0 ' + W + ' ' + HT, role: 'img',
        'aria-label': (c.title != null ? c.title + ': ' : 'Chart: ') + S.map(function (a) { return a.name; }).join(', ') + ', ' + n + ' points' });
      var cid = h.uid('kser'), g = function (cls) { return svg.appendChild(h.svg('g', { class: cls })); };
      svg.appendChild(h.svg('defs', {}, h.svg('clipPath', { id: cid }, h.svg('rect', { x: pl - 8, y: T - 7, width: pw + 16, height: ph + 14 }))));
      var tone = function (t, d) { return h.statusKind(t || d); };
      /* two value axes: a limit or band takes the colour of the first series on its own axis (never another axis' colour); tone is then ignored */
      var dual = !!(AL && AR);
      var owner = function (o) {
        if (!dual) return null;
        var sd = side(o), a = S.filter(function (q) { return q.ax === sd; })[0];
        return a ? { '--k-s': a.col, '--k-s-t': 'color-mix(in srgb,' + a.col + ' 55%,var(--k-text))' } : null;
      };
      var withUnit = function (o, lab) {
        var u = dual ? (side(o) === 'l' ? uL : uR) : '';
        return u && String(lab).indexOf(u) < 0 ? lab + ' (' + u + ')' : lab;
      };
      var legendX = [];
      /* ---- x windows (strip labels, ellipsis when the window is narrow) ---- */
      var findX = function (v) {
        var s = String(v), i = c.x.indexOf(v);
        if (i < 0) for (var j = 0; j < n; j++) if (String(c.x[j]) === s || fx(j) === s) { i = j; break; }
        return i;
      };
      var gx = g('k-ser-xb'), stripBoxes = [], strip = hasXLab ? 18 : 0;
      xb.forEach(function (b) {
        var segs = [], k0 = tm ? ((mins(b.start) - tm.s + 1440) % 1440) : -1, k1 = tm ? ((mins(b.end) - tm.s + 1440) % 1440) : -1;
        if (tm) {
          if (isNaN(k0) || isNaN(k1)) return;
          if (k1 === 0 && k0 > 0) k1 = tm.span;
          if (k1 >= k0) segs.push([k0, k1]); else { segs.push([0, k1]); segs.push([k0, tm.span]); }
          segs = segs.map(function (s) { return [pl + clamp(s[0] / tm.span, 0, 1) * pw, pl + clamp(s[1] / tm.span, 0, 1) * pw]; }).filter(function (s) { return s[1] - s[0] > 0.5; }).sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); }); /* a window that wraps the axis end is drawn in both parts; the larger one is labelled */
        } else {
          var i0 = findX(b.start), i1 = findX(b.end);
          if (i0 < 0 || i1 < 0) return;
          var half = n > 1 && i0 === i1 ? pw / (n - 1) / 2 : 0, a = X[Math.min(i0, i1)], z = X[Math.max(i0, i1)];
          segs.push([Math.max(pl, Math.min(i0, i1) === 0 ? pl : a - half), Math.min(pr, Math.max(i0, i1) === n - 1 ? pr : z + half)]);
        }
        var kind = tone(b.tone, 'neutral'), first = true;
        segs.forEach(function (s) {
          gx.appendChild(h.svg('rect', { class: 'k-ser-band k-s-' + kind, x: r1(s[0]), y: T - strip, width: r1(s[1] - s[0]), height: ph + strip }, b.label ? h.svg('title', {}, b.label) : null));
          if (!b.label) return;
          var lab = String(b.label), room = s[1] - s[0] - 8, txt = lab;
          if (tw(txt) > room) txt = ''; /* a window label that does not fit whole goes to the legend, never ellipsised */
          if (txt && first) { var tb = { x: s[0] + 4, y: T - strip, w: tw(txt), h: 14 }; if (!stripBoxes.some(function (q) { return hit(tb, q); })) { stripBoxes.push(tb); gx.appendChild(h.svg('text', { class: 'k-ser-blab k-s-' + kind, x: r1(s[0] + 4), y: T - 6 }, [h.svg('title', {}, lab), txt])); first = false; return; } }
          if (first) legendX.push({ kind: kind, text: lab });
          first = false;
        });
      });
      /* ---- value bands, grid ---- */
      var gb = g('k-ser-bands');
      (c.bands || []).forEach(function (b) {
        var A = side(b) === 'l' ? AL : AR; if (!A) return;
        var y0 = clamp(Y(Math.max(b.from, b.to), A), T, pb), y1 = clamp(Y(Math.min(b.from, b.to), A), T, pb);
        gb.appendChild(h.svg('rect', { class: 'k-ser-band k-s-' + tone(b.tone, 'neutral'), style: owner(b) || undefined, x: pl, y: r1(y0), width: pw, height: r1(Math.max(0, y1 - y0)) }, b.label ? h.svg('title', {}, b.label) : null));
      });
      var gg = g('k-ser-grid'), gt = g('k-ser-ticks'), P = AL || AR;
      (stack ? [AL, AR] : [P]).forEach(function (A) { A.ticks.forEach(function (v) { var y = r1(Y(v, A)); gg.appendChild(h.svg('line', { class: 'k-b-grid', x1: pl, x2: pr, y1: y, y2: y })); }); if (stack) gg.appendChild(h.svg('line', { class: 'k-ser-base', x1: pl, x2: pr, y1: r1(Y(A.lo, A)), y2: r1(Y(A.lo, A)) })); });
      [[AL, 'end', pl - 8, tL], [AR, 'start', pr + 8, uR]].forEach(function (q) {
        var A = q[0]; if (!A) return;
        /* a threshold that is not a tick is named on its axis ("92" between 90 and 92.5); the tick labels within 13 px of it make room */
        var thv = (c.thresholds || []).filter(function (t) { return A === (side(t) === 'l' ? AL : AR) && isFinite(+t.value) && +t.value > A.lo + 1e-9 && +t.value < A.hi - 1e-9 && Y(+t.value, A) > T + 12 && A.ticks.every(function (v) { return Math.abs(v - t.value) > 1e-9; }); }).sort(function (a, b) { return a.value - b.value; }).filter(function (t, i, all) { return !all.slice(0, i).some(function (u) { return Math.abs(Y(+u.value, A) - Y(+t.value, A)) < 13; }); }); /* labels of limits closer than 13 px: the lowest keeps it */
        A.ticks.forEach(function (v, i) { if (!thv.some(function (t) { return Math.abs(Y(+t.value, A) - Y(v, A)) < 13; })) gt.appendChild(h.svg('text', { class: 'k-b-tick', x: q[2], y: r1(Y(v, A) + 3.5), 'text-anchor': q[1] }, A.labels[i])); });
        thv.forEach(function (t) { gt.appendChild(h.svg('text', { class: 'k-b-tick k-ser-thv k-s-' + tone(t.tone, 'warn'), x: q[2], y: r1(Y(+t.value, A) + 3.5), 'text-anchor': q[1] }, h.num(+t.value, { dp: Math.max(A.dp, decs(t.value)) }))); });
        if (q[3]) {
          var long = tw(q[3]) > (q[1] === 'end' ? L : R) - 6;
          gt.appendChild(h.svg('text', { class: 'k-b-tick k-ser-unit', x: long ? (q[1] === 'end' ? 2 : W - 2) : q[2], y: stack && A === AR ? r1(Y(A.hi, A) - 12) : 12, 'text-anchor': long ? (q[1] === 'end' ? 'start' : 'end') : q[1] }, q[3]));
        }
      });
      /* ---- x ticks ---- */
      var xt = [], gap = 16;
      if (tm) {
        var wlab = tw('00:00') + gap, steps = [15, 30, 60, 120, 180, 360, 720, 1440], st = 1440;
        for (k = 0; k < steps.length; k++) if (steps[k] / tm.span * pw >= wlab) { st = steps[k]; break; }
        var sp = st / tm.span * pw * 0.75, put2 = function (m, ev) { xt.push({ x: pl + m / tm.span * pw, text: hhmm(tm.s + m), m: m, ev: ev }); };
        put2(0); /* the start is always labelled; whole clock hours follow, but none closer than 3/4 of a step to it */
        for (var m = (st - tm.s % st) % st || st; m <= tm.span + 1e-6; m += st) if (m / tm.span * pw >= sp && !(m >= tm.span - 1e-6 && hhmm(tm.s + m) === xt[0].text)) put2(m); /* a full-day axis ends on the label it starts with: that tick is left out, so the last hour before it keeps its own */
        /* the domain end is always labelled when its label fits clear of the last tick (not only when it is 3/4 of a step away) */
        if (xt[xt.length - 1].m < tm.span - 1e-6 && hhmm(tm.s + tm.span) !== xt[0].text && (tm.span - xt[xt.length - 1].m) / tm.span * pw >= wlab - gap + 10) put2(tm.span);
        /* events (window edges, the last point of a curve) keep a label next to them: the event time itself, else the nearest whole hour, when it fits clear of the other labels */
        var evs = [], ex = function (v) { var d = mins(v); return isNaN(d) ? NaN : (d - tm.s + 1440) % 1440; };
        xb.forEach(function (b) { if (b.label == null || b.label === '') return; var a0 = ex(b.start), a1 = ex(b.end); if (!isNaN(a0)) evs.push(a0); if (!isNaN(a1)) evs.push(a1 === 0 ? tm.span : a1); });
        for (k = n - 1; k >= 0; k--) if (S.some(function (a) { return a.vals[k] === a.vals[k]; })) { evs.push(ex(c.x[k])); break; }
        var pxm = function (m) { return m / tm.span * pw; }, lbox = function (x, text) { /* where a tick label ends up: centred, pushed in at the svg edges */
          var w = tw(text), x0 = x - w / 2;
          if (x0 < 2) x0 = Math.max(2, x); else if (x + w / 2 > W - 2) x0 = Math.min(W - 2, x) - w;
          return [x0, x0 + w];
        }, fits = function (m, g) {
          var cb = lbox(pl + pxm(m), hhmm(tm.s + m));
          return xt.every(function (t) { var e = lbox(t.x, t.text); return cb[0] >= e[1] + g || cb[1] <= e[0] - g; });
        };
        evs.sort(function (a, b) { return a - b; }).forEach(function (m) {
          if (isNaN(m) || m < 0 || m > tm.span || xt.some(function (t) { return Math.abs(pxm(m) - (t.x - pl)) <= 26; })) return;
          var hr = Math.round((tm.s + m) / 60) * 60 - tm.s, cand = [[m, 8], [Math.floor((tm.s + m) / 60) * 60 - tm.s, 8], [Math.ceil((tm.s + m) / 60) * 60 - tm.s, 8]].sort(function (a, b) { return Math.abs(a[0] - m) - Math.abs(b[0] - m); });
          for (var q = 0; q < cand.length; q++) if (cand[q][0] > 0 && cand[q][0] < tm.span && fits(cand[q][0], cand[q][1])) { put2(cand[q][0], true); return; }
        });
        xt.sort(function (a, b) { return a.x - b.x; });
      } else {
        var keep = h.thin(c.x.map(function (v, i) { return fx(i); }), pw, { gap: gap, font: TF });
        if (c.tickEvery >= 1) { /* regular ticks: every N points counted back from the last one; N grows (still regular) until the labels clear each other */
          var ev = Math.floor(c.tickEvery), lab = Math.max.apply(null, c.x.map(function (v, i) { return tw(fx(i)); })) + gap, per = n > 1 ? pw / (n - 1) : pw;
          while (ev * per < lab && ev < n) ev++;
          keep = c.x.map(function (v, i) { return (n - 1 - i) % ev === 0; });
        }
        for (k = 0; k < n; k++) if (keep[k]) xt.push({ x: X[k], text: fx(k) });
      }
      var boxes = xt.map(function (t, i) {
        var w = tw(t.text), an = 'middle', x0 = t.x - w / 2;
        if (x0 < 2) { an = 'start'; x0 = Math.max(2, t.x); } else if (t.x + w / 2 > W - 2) { an = 'end'; x0 = Math.min(W - 2, t.x) - w; }
        if (i === 0 && x0 < pl - L + 2) { an = 'start'; x0 = pl; }
        return { t: t, an: an, b: { x: x0, y: 0, w: w, h: 12 } };
      });
      var shown = [], clear = function (o, q) { return o.b.x >= q.b.x + q.b.w + (o.t.ev || q.t.ev ? 7 : 14); };
      boxes.forEach(function (o, i) {
        var prev = shown[shown.length - 1];
        if (prev && !clear(o, prev)) { if (i === boxes.length - 1) shown.pop(); else return; if (shown.length && !clear(o, shown[shown.length - 1])) return; } /* the last label wins over the one before it */
        shown.push(o);
      });
      var gxl = g('k-ser-xt');
      shown.forEach(function (o) {
        var ax = o.an === 'start' ? o.b.x : o.an === 'end' ? o.b.x + o.b.w : o.t.x;
        gxl.appendChild(h.svg('line', { class: 'k-b-grid', x1: r1(o.t.x), x2: r1(o.t.x), y1: pb, y2: pb + 4 }));
        gxl.appendChild(h.svg('text', { class: 'k-b-tick', x: r1(ax), y: pb + 17, 'text-anchor': o.an }, o.t.text));
      });
      gg.appendChild(h.svg('line', { class: 'k-ser-base', x1: pl, x2: pr, y1: pb, y2: pb }));
      /* ---- series geometry ---- */
      var xEnd = pr, polys = [];
      var gs = g('k-ser-data'), overUsed = false, overLims = [];
      /* limits that data must stay under (tone warn/crit, not 'min'): the part of a line above one is redrawn in the alert colour and its points are filled */
      var lims = (c.thresholds || []).map(function (t) {
        var k = tone(t.tone, 'warn'), minDir = t.dir === 'min' || (t.dir !== 'max' && /^\s*(min\b|minimum|at least|floor|lower)/i.test(String(t.label || '')));
        return { t: t, kind: dual || k === 'crit' ? 'crit' : k, on: (k === 'warn' || k === 'crit') && !minDir };
      }).filter(function (q) { return q.on; }).sort(function (a, b) { return a.t.value - b.t.value; });
      gs.setAttribute('clip-path', 'url(#' + cid + ')');
      S.forEach(function (a) {
        var A = a.ax === 'l' ? AL : AR, segs = [], cur = null, i;
        for (i = 0; i < n; i++) { if (isNaN(a.vals[i])) { cur = null; continue; } if (!cur) segs.push(cur = []); cur.push([i, X[i], Y(a.vals[i], A)]); }
        var base = Y(clamp(0, A.lo, A.hi), A), st = a.s.step, col = { '--sw': a.col };
        segs.forEach(function (sg) {
          var v = [];
          sg.forEach(function (p, j) {
            if (st && j) v.push([p[1], sg[j - 1][2]]);
            v.push([p[1], p[2]]);
          });
          if (st && tm && sg[sg.length - 1][0] === n - 1 && xEnd > sg[sg.length - 1][1]) v.push([xEnd, sg[sg.length - 1][2]]);
          var d = v.map(function (p, j) { return (j ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1]); }).join('');
          polys.push(v);
          if (a.s.area && v.length > 1) gs.appendChild(h.svg('path', { class: 'k-ser-area', style: col, d: d + 'L' + r1(v[v.length - 1][0]) + ' ' + r1(base) + 'L' + r1(v[0][0]) + ' ' + r1(base) + 'Z' }));
          if (v.length > 1) gs.appendChild(h.svg('path', { class: 'k-ser-line' + (a.s.dashed ? ' k-ser-dash' : ''), style: col, d: d }));
          if (v.length > 1) lims.forEach(function (q) {
            if (side(q.t) !== a.ax || !(Math.max.apply(null, sg.map(function (p) { return a.vals[p[0]]; })) > q.t.value)) return;
            overUsed = true; if (overLims.indexOf(q) < 0) overLims.push(q);
            var yl = Y(q.t.value, A), oid = h.uid('kover');
            svg.firstChild.appendChild(h.svg('clipPath', { id: oid }, h.svg('rect', { x: pl - 8, y: T - 7, width: pw + 16, height: Math.max(0, yl - (T - 7)) })));
            gs.appendChild(h.svg('path', { class: 'k-ser-line k-ser-over k-s-' + q.kind + (a.s.dashed ? ' k-ser-dash' : ''), 'clip-path': 'url(#' + oid + ')', d: d }));
          });
          if (sg.length === 1 || (sg.length <= 40 && n <= 40 && !st)) sg.forEach(function (p) {
            var br = lims.filter(function (q) { return side(q.t) === a.ax && a.vals[p[0]] > q.t.value; }).pop();
            gs.appendChild(h.svg('circle', { class: 'k-ser-dot' + (br ? ' k-ser-over-dot k-s-' + br.kind : ''), style: col, cx: r1(p[1]), cy: r1(p[2]), r: sg.length === 1 ? 4 : br ? 3.5 : 3 }));
          });
        });
      });
      /* ---- thresholds and labels (moved away from data and from each other) ---- */
      var gl = g('k-ser-thr'), ph13 = 13, placed = stripBoxes.slice(), samples = [];
      polys.forEach(function (v) {
        for (var j = 0; j < v.length; j++) {
          samples.push(v[j]);
          if (j) { var dx = v[j][0] - v[j - 1][0], dy = v[j][1] - v[j - 1][1], ns = Math.min(60, Math.floor(Math.max(Math.abs(dx), Math.abs(dy)) / 4)); for (var q = 1; q < ns; q++) samples.push([v[j - 1][0] + dx * q / ns, v[j - 1][1] + dy * q / ns]); }
        }
      });
      var free = function (b, m) {
        m = m || 0;
        if (b.x < pl + 2 || b.x + b.w > pr - 2 || b.y < T + 1 || b.y + b.h > pb - 1) return false;
        if (placed.some(function (p) { return hit(b, p); })) return false;
        for (var j = 0; j < samples.length; j++) if (samples[j][0] > b.x - 3 - m && samples[j][0] < b.x + b.w + 3 + m && samples[j][1] > b.y - 2 - m && samples[j][1] < b.y + b.h + 2 + m) return false;
        return true;
      };
      var put = function (text, y0, rows, cls, kind, sty) {
        var w = tw(text) + 2, xs = [pr - 6 - w, pl + 6, pl + pw * 0.5 - w / 2, pl + pw * 0.25 - w / 2, pl + pw * 0.75 - w / 2, pl + pw * 0.35 - w / 2, pl + pw * 0.65 - w / 2];
        /* first pass keeps 7 px clear of the data, second pass accepts a tight fit */
        for (var m = 7; m >= 0; m -= 7) for (var a = 0; a < rows.length; a++) for (var b = 0; b < xs.length; b++) {
          var bx = { x: xs[b], y: y0 + rows[a], w: w, h: ph13 };
          if (free(bx, m)) { placed.push(bx); gl.appendChild(h.svg('text', { class: cls + ' k-s-' + kind, style: sty || undefined, x: r1(bx.x), y: r1(bx.y + 10) }, text)); return true; }
        }
        return false;
      };
      (c.thresholds || []).forEach(function (t) {
        var A = side(t) === 'l' ? AL : AR; if (A && t.value >= A.lo && t.value <= A.hi) placed.push({ x: pl, y: Y(t.value, A) - 2, w: pw, h: 4 });
      });
      (c.thresholds || []).forEach(function (t) {
        var A = side(t) === 'l' ? AL : AR; if (!A || t.value < A.lo || t.value > A.hi) return;
        var y = r1(Y(t.value, A)), own = owner(t), kind = own ? 'neutral' : tone(t.tone, 'warn'), lab = t.label != null && t.label !== '' ? withUnit(t, String(t.label)) : '';
        gl.appendChild(h.svg('line', { class: 'k-ser-limit k-s-' + kind, style: own || undefined, x1: pl, x2: pr, y1: y, y2: y }, h.svg('title', {}, lab || String(t.value))));
        if (lab && !put(lab, y, [-15, 2, -30, 17, -45, 32], 'k-ser-tlab k-b-halo', kind, own)) legendX.push({ kind: kind, style: own, text: lab, line: true });
      });
      (c.bands || []).forEach(function (b) {
        var A = side(b) === 'l' ? AL : AR; if (!A || b.label == null || b.label === '') return;
        var yt = clamp(Y(Math.max(b.from, b.to), A), T, pb), yb2 = clamp(Y(Math.min(b.from, b.to), A), T, pb), own = owner(b), kind = own ? 'neutral' : tone(b.tone, 'neutral'), lab = withUnit(b, String(b.label));
        if (yb2 - yt < ph13 + 2 || !put(lab, yt, [(yb2 - yt) - ph13 - 3, 3, (yb2 - yt) / 2 - 6], 'k-ser-blab2', kind, own)) legendX.push({ kind: kind, style: own, text: lab });
      });
      /* ---- hover: one strip per x with a native tooltip ---- */
      var gh = g('k-ser-hit');
      for (k = 0; k < n; k++) {
        var xa = k ? (X[k - 1] + X[k]) / 2 : pl, xz = k < n - 1 ? (X[k] + X[k + 1]) / 2 : pr;
        if (xz <= xa) continue;
        var lines = [fx(k, true)];
        S.forEach(function (a) { if (!isNaN(a.vals[k])) lines.push(a.name + ': ' + h.num(a.vals[k], { dp: a.s.dp, unit: a.s.unit })); });
        gh.appendChild(h.svg('g', {}, [h.svg('line', { class: 'k-ser-guide', x1: r1(X[k]), x2: r1(X[k]), y1: T, y2: pb }),
          h.svg('rect', { x: r1(xa), y: T, width: r1(xz - xa), height: ph, fill: 'transparent' }, h.svg('title', {}, lines.join('\n')))]));
      }
      el.appendChild(svg);
      /* ---- legend: line colours; limits and windows only when their in-plot label could not be placed ---- */
      var units = {};
      S.forEach(function (a) { units[a.s.unit == null ? '' : a.s.unit] = 1; });
      var multiU = Object.keys(units).length > 1, items = [];
      if (c.legend != null ? c.legend : S.length > 1 || overUsed) S.forEach(function (a) {
        items.push(h.el('span', { title: a.name }, [h.el('i', { class: 'k-b-sw-line' + (a.s.dashed ? ' k-ser-sw-dash' : ''), style: { '--sw': a.col } }), a.name + (multiU && a.s.unit ? ' (' + a.s.unit + ')' : '')]));
      });
      /* one entry per limit the data crosses, in the limit's own words: "Above month peak 110 kW" */
      overLims.sort(function (a, b) { return a.t.value - b.t.value; }).forEach(function (q) {
        var lab = q.t.label != null && String(q.t.label).trim() !== '' ? withUnit(q.t, String(q.t.label).trim()) : '';
        var txt = !lab ? 'Above limit' : /^above\b/i.test(lab) ? lab : 'Above ' + (/^[A-Z][a-z]/.test(lab) ? lab.charAt(0).toLowerCase() + lab.slice(1) : lab);
        items.push(h.el('span', { class: 'k-s-' + q.kind, title: txt }, [h.el('i', { class: 'k-b-sw-line', style: { '--sw': 'var(--k-s)' } }), txt]));
      });
      legendX.forEach(function (o) {
        items.push(h.el('span', { class: 'k-s-' + o.kind, style: o.style || undefined }, [h.el('i', { class: o.line ? 'k-b-sw-line k-ser-sw-lim' : 'k-ser-sw-band', style: { '--sw': 'var(--k-s)' } }), o.text]));
      });
      if (items.length) el.appendChild(h.el('div', { class: 'k-b-legend k-ser-legend' }, items));
    }
  });
})();
