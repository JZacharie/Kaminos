/* AI-DLC UI blocks core 1.4 (MIT-0). K.block registry, safe mount, declarative mount, shared helpers, K.theme. No network, only global: K. */
(function () {
'use strict';
var K = (window.K = window.K || {}), d = document, root = d.documentElement, isA = Array.isArray;
var defs = {}, warned = {}, uidN = 0, RESERVED = { define: 1, h: 1, list: 1, mount: 1, warnings: 1, palette: 1 };
// console.warn only (console.error counts as a JS error in the scorer), once per block+message (or per key); an element x gets data-k-block-error (the gate reads it)
var warn = function (name, msg, x) { var el = x && x.nodeType ? x : null, k = name + '|' + (typeof x === 'string' ? x : msg); if (el) el.setAttribute('data-k-block-error', msg.slice(0, 300)); if (!warned[k]) { warned[k] = 1; console.warn('[K.block] ' + name + ': ' + msg); } };
var isD = function (v) { return Object.prototype.toString.call(v) === '[object Date]'; };
var str = function (v) { return v == null ? '' : String(v); };

/* ---------- helpers (K.block.h) ---------- */
var H = {}, nf = {}, mc = {}, cv;
H.esc = function (s) { return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var build = function (ns, tag, a, kids) {
 var e = ns ? d.createElementNS(ns, tag) : d.createElement(tag);
 for (var k in a || {}) {
  var v = a[k];
  if (v == null || v === false) continue;
  if (k === 'text') e.textContent = v;
  else if (k === 'style' && typeof v === 'object') for (var p in v) e.style.setProperty(p, v[p]);
  else if (k === 'on') for (var ev in v) e.addEventListener(ev, v[ev]);
  else e.setAttribute(k, v === true ? '' : v);
 }
 [].concat(kids == null ? [] : kids).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'object' ? c : d.createTextNode(c)); });
 return e;
};
H.el = function (tag, a, kids) { return build(null, tag, a, kids); };
H.svg = function (tag, a, kids) { return build('http://www.w3.org/2000/svg', tag, a, kids); };
// one line ending in an ellipsis: k-b-line is the clip box, the text sits in an inner span
H.line = function (text, a) { a = a || {}; a.class = 'k-b-line' + (a.class ? ' ' + a.class : ''); if (a.title == null) a.title = str(text); return H.el('span', a, H.el('span', { text: text })); };
// nowrap(text): nodes where times, time ranges, ids, codes and amounts never break ("21:15-22:40", "AL-320", "EUR 95", "102 kW");
// a text without spaces is one nowrap span. rich(text, {max}): every word holding a digit, colon, slash or hyphen stays whole
// ("Hapag-Lloyd", "door 23", "38.1 kWh"); a kept word longer than max (18) ends in an ellipsis inside its box. Both return arrays for H.el kids.
var NW = /\b\d{1,2}:\d{2}(?:\s?[-\u2013]\s?\d{1,2}:\d{2})?|\b[A-Z][A-Z0-9]*-\d[A-Za-z0-9-]*|\b[A-Z][A-Z0-9]+-[A-Z0-9][A-Za-z0-9-]{2,}|\b(?:EUR|GBP|USD|\u20ac|\u00a3|\$)\s?\d[\d.,]*|\b\d[\d.,]*\s(?:kWh|kW|km\/h|km|min|h|kg|t|%)(?![\w])/g;
H.nowrap = function (text) {
 var s = str(text), out = [], last = 0, m;
 if (s && !/\s/.test(s)) return [H.el('span', { class: 'k-b-nw', text: s })];
 NW.lastIndex = 0;
 while ((m = NW.exec(s))) { if (m.index > last) out.push(s.slice(last, m.index)); out.push(H.el('span', { class: 'k-b-nw', text: m[0] })); last = m.index + m[0].length; }
 if (last < s.length) out.push(s.slice(last));
 return out;
};
H.rich = function (text, o) {
 var out = [], max = (o && o.max) || 18;
 str(text).replace(/([^\s,;.])[ \t]+(?=\d[\d.,]*(?:[ \t]|$))/g, '$1\u00a0').replace(/(\d)[ \t]+(?=(?:%|k?Wh?|km|m|h|min|kg|t|s|ms|kW|kWh)(?:[ \t\u00a0,.;)]|$))/g, '$1\u00a0').split(/([ \t\n]+)/).forEach(function (t) {
  if (!t) return;
  if (/^[ \t\n]/.test(t) || !/[\d:\/\u2010-\u2015-]/.test(t)) out.push(t);
  else out.push(H.el('span', { class: 'k-b-nw' + (t.length > max ? ' k-b-tok-x' : ''), title: t.length > max ? t : null }, [H.el('span', { text: t })]));
 });
 return out;
};
H.lang = function () { return root.lang || 'en-GB'; };
H.num = function (v, o) {
 o = o || {};
 if (v == null || v === '' || isNaN(+v)) return str(v);
 var key = H.lang() + (o.dp == null ? '' : o.dp) + (o.compact ? 'c' : ''), dp = o.dp;
 var s = (nf[key] || (nf[key] = new Intl.NumberFormat(H.lang(), { minimumFractionDigits: dp == null ? 0 : dp, maximumFractionDigits: dp == null ? 2 : dp, notation: o.compact ? 'compact' : 'standard' }))).format(+v);
 if (o.sign && +v > 0) s = '+' + s;
 return o.unit ? s + (/^[%\u00b0]/.test(o.unit) ? '' : '\u00a0') + o.unit : s;
};
var dt = function (v, opt) {
 if (v == null || v === '') return '';
 if (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v)) return opt.hour && v.length === 4 ? '0' + v : v;
 var x = isD(v) ? v : new Date(typeof v === 'number' ? v : String(v));
 return isNaN(x) ? String(v) : x.toLocaleString(H.lang(), opt);
};
var HM = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, DM = { day: 'numeric', month: 'short' };
H.time = function (v) { return dt(v, HM); };
H.date = function (v, o) { return dt(v, o && o.weekday ? { weekday: 'short', day: 'numeric', month: 'short' } : DM); };
H.datetime = function (v) { return dt(v, { day: 'numeric', month: 'short', hour: HM.hour, minute: HM.minute, hourCycle: 'h23' }); };
// when(v): a valid Date as text: the clock time ("14:30") on the page's day, else day and time ("12 Nov, 14:30"). Invalid Date: an em dash. Anything else: String(v).
H.when = function (v) { return isD(v) ? (isNaN(v) ? '\u2014' : v.toDateString() === new Date().toDateString() ? H.time(v) : H.datetime(v)) : str(v); };
H.measureText = function (text, font) {
 font = font || '12px system-ui';
 var k = font + '\u0001' + text;
 if (mc[k] != null) return mc[k];
 try { cv = cv || d.createElement('canvas').getContext('2d'); cv.font = font; mc[k] = cv.measureText(String(text)).width; } catch (e) { mc[k] = 0; }
 if (!mc[k] && text) mc[k] = String(text).length * (+(/(\d+(?:\.\d+)?)px/.exec(font) || [0, 12])[1]) * 0.6;
 return mc[k];
};
H.font = function (el, fallback) { try { var s = getComputedStyle(el); return s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily; } catch (e) { return fallback || '12px system-ui'; } };
var hit = function (a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; };
// fitLabels(labels [{x,y,text,w?,h?,anchor,priority?,font?}], obstacles [{x,y,w,h}], {bounds, offsets}): by priority, clamp into bounds, try each offset, else hidden=true
H.fitLabels = function (labels, boxes, o) {
 o = o || {};
 var placed = (boxes || []).slice(), B = o.bounds, offs = o.offsets || [[0, 0], [0, -14], [0, 14], [8, 0], [-8, 0]];
 labels.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) { return (b.l.priority || 0) - (a.l.priority || 0) || a.i - b.i; }).forEach(function (it) {
  var l = it.l, w = l.w || H.measureText(l.text, l.font) + 2, h = l.h || 14, an = l.anchor || 'start', sh = an === 'middle' ? w / 2 : an === 'end' ? w : 0;
  l.hidden = true;
  for (var j = 0; j < offs.length; j++) {
   var x = l.x + offs[j][0] - sh, y = l.y + offs[j][1] - h * 0.75;
   if (B) { x = Math.max(B.x, Math.min(x, B.x + B.w - w)); y = Math.max(B.y, Math.min(y, B.y + B.h - h)); }
   var box = { x: x, y: y, w: w, h: h };
   if (placed.some(function (p) { return hit(box, p); })) continue;
   placed.push(box);
   l.box = box; l.hidden = false; l.x = x + sh; l.y = y + h * 0.75;
   break;
  }
 });
 return labels;
};
// niceTicks(min, max, n, {integer}): about n nice steps covering [min,max]
H.niceTicks = function (min, max, n, o) {
 n = n || 5;
 if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
 if (min === max) { max = min + 1; if (min > 0) min = 0; }
 var raw = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, t = [];
 var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
 if (o && o.integer) step = Math.max(1, Math.round(step));
 // the last tick is always >= max (20..86 by 20 -> 20..100), so the top value never sits above the axis
 for (var v = Math.floor(min / step + 1e-9) * step; t.length < 50; v += step) { var tv = +(Math.round(v / step) * step).toFixed(10); t.push(tv); if (tv >= max - step * 1e-9) break; }
 t.step = step; t.min = t[0]; t.max = t[t.length - 1];
 return t;
};
// thin(labels, px, {gap, font}): booleans, which labels fit on an axis of px width
H.thin = function (labels, px, o) {
 o = o || {};
 var n = labels.length;
 if (!n) return [];
 var w = Math.max.apply(null, labels.map(function (l) { return H.measureText(l && l.text != null ? l.text : l, o.font || '11px system-ui'); })) + (o.gap == null ? 8 : o.gap);
 var every = Math.max(1, Math.ceil(n * w / Math.max(px, 1))), keep = labels.map(function (l, i) { return i % every === 0; });
 if (n > 1 && (n - 1) % every && (n - 1) % every >= every / 2) keep[n - 1] = true;
 return keep;
};
// padFit(root): a fit spec (see h.fit) that grows the CSS variable --k-fill-pad (px, 0..max) on root; rows use it as extra padding above and below
H.padFit = function (root, max) { return { base: 0, max: max == null ? 24 : max, set: function (n) { root.style.setProperty('--k-fill-pad', n + 'px'); } }; };
// fade(node): while node scrolls vertically and more content is below, data-k-fade shows a fade at its bottom edge
H.fade = function (node) {
 var up = function () { node.toggleAttribute('data-k-fade', node.scrollHeight - node.clientHeight - node.scrollTop > 2); };
 node.addEventListener('scroll', up, { passive: true });
 if (typeof ResizeObserver !== 'undefined') new ResizeObserver(up).observe(node);
 up();
 setTimeout(up, 0);
};
H.uid = function (p) { return (p || 'k') + '-' + (++uidN).toString(36); };
var ST = {};
[['ok', 'ok good success ready done on|time delivered approved complete completed arrived resolved confirmed available charged passed'],
 ['warn', 'warn warning risk at|risk medium delayed pending late paused degraded waiting tight'],
 ['crit', 'crit critical bad error danger high blocked fault missing failed cancelled canceled hold on|hold overdue offline rejected breach'],
 ['info', 'info low in|progress active live will|be|ready scheduled planned charging in|transit en|route boarding']].forEach(function (g) {
 g[1].split(' ').forEach(function (w) { ST[w.replace(/\|/g, ' ')] = g[0]; });
});
H.statusKind = function (k) { return ST[str(k).toLowerCase().trim().replace(/[\s_-]+/g, ' ')] || 'neutral'; };
H.status = function (k) { return 'k-s-' + H.statusKind(k); };
H.cat = function (i) { return 'var(--k-cat-' + ((Math.abs(i | 0) % 8) + 1) + ')'; };
// catFor(key): the colour of a category depends on the KEY only, never on render order. Order of precedence: a slot given with
// K.block.palette({'Stage A': 0, ...}) or palette(['Stage A', ...]) or a block's colorKeys: [...] (position = slot), else a fixed hash of the key (FNV-1a, 8 slots).
// The hash can give two keys one slot; list the keys you compare side by side in K.block.palette / colorKeys to keep them apart.
var catMap = Object.create(null);
var catHash = function (s) { var x = 294116; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
// force: palette() always sets; colorKeys only fills keys that have no slot yet (a conflicting slot is kept and warned once)
var setPalette = function (spec, force) {
 var put = function (k, i) {
  k = String(k); i = (+i | 0) < 0 ? 0 : +i | 0;
  if (catMap[k] != null && catMap[k] !== i % 8 && !force) { warn('palette', 'key "' + k + '" already has slot ' + catMap[k] + ', ignoring slot ' + i); return; }
  catMap[k] = i % 8;
 };
 if (isA(spec)) spec.forEach(function (k, i) { put(k, i); });
 else if (spec && typeof spec === 'object') Object.keys(spec).forEach(function (k) { put(k, spec[k]); });
};
H.catFor = function (key) { key = str(key); return H.cat(catMap[key] != null ? catMap[key] : catHash(key) % 8); };
H.token = function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); };
var state = function (kind, el, title, detail, compact) {
 el.textContent = '';
 return el.appendChild(H.el('div', { class: 'k-block-state k-block-' + kind + (compact ? ' k-block-compact' : ''), role: kind === 'error' ? 'alert' : 'status' }, [
  kind === 'loading' ? H.el('span', { class: 'k-b-spin', 'aria-hidden': 'true' }) : null,
  H.el('p', { class: 'k-block-state-t', text: title }), detail ? H.el('p', { class: 'k-block-state-d', text: detail }) : null]));
};
// o = {compact: true} draws a one-row state (toolbars, switches, blocks under 320 px wide)
H.empty = function (el, title, detail, o) { return state('empty', el, title || 'Nothing to show yet', detail, o && o.compact); };
H.loading = function (el, title, o) { return state('loading', el, title || 'Loading\u2026', null, o && o.compact); };
H.error = function (el, title, detail, o) { return state('error', el, title, detail, o && o.compact); };

/* ---------- schema ---------- */
var typeOk = function (t, v) {
 if (t === 'any') return true;
 if (t === 'text' || t === 'time') return typeof v === 'string' || (typeof v === 'number' && isFinite(v));
 if (t === 'array') return isA(v);
 if (t === 'object') return v !== null && typeof v === 'object' && !isA(v);
 if (t === 'number') return typeof v === 'number' && isFinite(v);
 return typeof v === t;
};
// text and time fields take a Date (formatted by H.when; a time field also keeps the instant as <field>$ms). Inside array items (soft), a wrong type or enum value in an
// OPTIONAL field is not an error: the field shows an em dash (text) or is dropped (other types) and errs.notes gets the path (core warns once). Required fields, top-level fields and structure stay hard errors.
var check = function (schema, cfg, path, errs, soft) {
 var out = {};
 for (var k in cfg) out[k] = cfg[k];
 for (var f in schema || {}) {
  var s = schema[f], v = cfg[f], p = path + f, t = s.type || 'any', bad = '';
  if (v != null && (t === 'text' || t === 'time') && isD(v)) {
   if (isNaN(v)) errs.notes.push(p + ' is an invalid Date, shown as "\u2014"'); else if (t === 'time') out[f + '$ms'] = +v;
   out[f] = H.when(v);
   continue;
  }
  if (v == null) {
   if (s.required) errs.push(p + ' is required');
   else if (s.default !== undefined) out[f] = s.default && typeof s.default === 'object' ? JSON.parse(JSON.stringify(s.default)) : s.default;
   continue;
  }
  if (!typeOk(t, v)) bad = p + ' must be ' + (t === 'text' || t === 'time' ? 'a string or number' : (/^[aeio]/.test(t) ? 'an ' : 'a ') + t) + ', got ' + (isA(v) ? 'array' : typeof v);
  else if (s.enum && s.enum.indexOf(v) < 0) bad = p + ' must be one of ' + s.enum.join(', ');
  if (bad) {
   if (soft && !s.required) { errs.notes.push(bad + (t === 'text' || t === 'time' ? '; shown as "\u2014"' : '; ignored')); out[f] = t === 'text' || t === 'time' ? '\u2014' : s.default; if (out[f] === undefined) delete out[f]; } else errs.push(bad);
  } else if (s.of && isA(v)) out[f] = v.map(function (it, i) { if (typeOk('object', it)) return check(s.of, it, p + '[' + i + '].', errs, true); errs.push(p + '[' + i + '] must be an object'); return it; });
 }
 return out;
};
var COMMON = { title: { type: 'text' }, subtitle: { type: 'text' }, state: { type: 'string', enum: ['ready', 'loading', 'empty', 'error'], default: 'ready' },
 emptyText: { type: 'text' }, errorText: { type: 'text' }, frame: { type: 'boolean' }, fill: { type: 'any' }, headingLevel: { type: 'number', default: 2 }, colorKeys: { type: 'array' }, actions: { type: 'array' }, compact: { type: 'boolean' } };

/* ---------- poison text guard ---------- */
// Text a block shows that holds the word undefined, NaN, null or [object Object] is a sign of broken app glue. It stays visible; its element gets data-k-suspect and the console one
// warning ("[K.block] suspect text ..."). A gate counts [data-k-suspect], .k-block-error and [data-k-soft]. Config error cards are skipped.
var POISON = /(?:^|[^\w$.])(?:undefined|NaN|null)(?![\w$])|\[object Object\]/;
var suspect = function (el, name) {
 var w = d.createTreeWalker(el, 4), n, p, t;
 while ((n = w.nextNode())) {
  t = n.nodeValue;
  if (!t || t.length < 3 || !POISON.test(t) || !(p = n.parentElement) || p.closest('.k-block-error') || p.hasAttribute('data-k-suspect')) continue;
  p.setAttribute('data-k-suspect', '');
  var q = (p.textContent || t).trim().replace(/\s+/g, ' ').slice(0, 60), k = 'suspect|' + name + '|' + q;
  if (!warned[k]) { warned[k] = 1; console.warn('[K.block] suspect text in ' + name + ': "' + q + '" (broken app data?)'); }
 }
};

/* ---------- registry ---------- */
var noop = { el: null, ok: false, update: function () {}, destroy: function () {} }, live = [];
// a measuring block (resize: true) inside a hidden route has no box: its render waits until the element gets a width
var hidden = function (el) { return !el.getClientRects().length || !el.clientWidth; };
// fill (row-height fill): a block in a k-grid row stretches to the row height. fill: true grows its content to use the space, 'scroll' keeps the row height
// from the other cards and scrolls the body inside with a fade, false opts out of a k-row-fill grid. Only blocks that declare `fill: true` in K.block.define take part.
var inRowFill = function (el) {
 var p = el.parentElement, rf = function (n) { return !!n && n.classList.contains('k-row-fill'); };
 return rf(p) || (!!p && p.children.length === 1 && rf(p.parentElement));
};
var fillMode = function (c, el) {
 var f = c.fill;
 if (f === 'scroll') return 'scroll';
 if (f === false) return '';
 return f === true || f === 'grow' || inRowFill(el) ? 'grow' : '';
};
var mount = function (name, target, cfg) {
 var def = defs[name], el = typeof target === 'string' ? d.querySelector(target) : target;
 if (!def || !el || !el.nodeType) { var ok = el && el.nodeType && el; if (ok) ok.setAttribute('data-k-block', name); warn(name, def ? 'element not found: ' + str(target) : 'unknown block', ok); return noop; }
 if (el._kBlock) el._kBlock.destroy();
 var cur = cfg, cleanups = [], h = Object.create(H), handle, rec = { el: el, w: -1, pending: false, draw: null, fit: null, stop: false, busy: false, lastH: 0, ft: 0 };
 h.cleanup = function (fn) { cleanups.push(fn); };
 h.warn = function (msg, key) { warn(name, msg, key); };
 h.resizeObserver = function (node, fn, ms) {
  if (typeof ResizeObserver === 'undefined') return;
  var t, w0 = node.clientWidth, ro = new ResizeObserver(function () {
   clearTimeout(t);
   t = setTimeout(function () { var w = node.clientWidth; if (Math.abs(w - w0) >= 2) { w0 = w; fn(w); } }, ms == null ? 80 : ms);
  });
  ro.observe(node);
  cleanups.push(function () { clearTimeout(t); ro.disconnect(); });
 };

 h.rerender = function () { draw(); };
 // h.fit(spec | [spec]): spec = {base, max, set(n)}; set(n) lays the block out at step n. In fill mode core finds the largest n per spec (in order) that keeps the block no
 // taller than its row (the height the other cards set), then keeps it. Steps must grow the block monotonically. h.fitStop(): stop fitting (the user expanded something).
 h.fit = function (spec) { rec.fit = [].concat(spec); };
 h.fitStop = function () { rec.stop = true; };

 var runFit = function () {
  var specs = rec.fit;
  if (!specs || rec.stop || rec.busy || !el.isConnected || !el.offsetHeight) return;
  rec.busy = true;
  el.classList.add('k-b-fitting'); // no transitions while measuring: under prefers-reduced-motion kit.css gives every property a 0.01 ms transition and a synchronous read would see the old value
  try {
   specs.forEach(function (s) { s.set(s.base | 0); });
   var R = el.offsetHeight;
   specs.forEach(function (s) {
    var lo = s.base | 0, hi = Math.max(lo, s.max | 0);
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; s.set(mid); if (el.offsetHeight <= R + 1) lo = mid; else hi = mid - 1; }
    s.set(lo);
   });
  } catch (e) { warn(name, 'fill failed: ' + String((e && e.message) || e).slice(0, 120)); }
  rec.lastH = el.offsetHeight;
  el.classList.remove('k-b-fitting');
  rec.busy = false;
 };
 var reset = function () { while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* ignore */ } } };
 var draw = function () {
  reset();
  el.textContent = '';
  el.removeAttribute('data-k-block-error');
  el.setAttribute('data-k-block', name);
  el.classList.add('k-b', 'k-b-' + name);
  el.classList.remove('k-b-fill', 'k-b-fill-scroll', 'k-b-own-scroll', 'k-b-nofill'); el.removeAttribute('data-k-fill'); el.removeAttribute('data-k-fade'); el.removeAttribute('data-k-soft');
  rec.fit = null; rec.stop = false; rec.busy = false;
  var body = el, fm = '';
  try {
   var errs = [], c0 = cur;
   errs.notes = [];
   if (!typeOk('object', c0)) { errs.push('config must be an object'); c0 = {}; }
   var c = check(def.schema, check(COMMON, c0, '', errs), '', errs), framed = c.frame != null ? c.frame : def.frame !== false, acts = c.actions || [];
   if (c.fill != null && c.fill !== true && c.fill !== false && c.fill !== 'grow' && c.fill !== 'scroll') errs.push('fill must be true, false or "scroll"');
   if (errs.notes.length && !errs.length) {
    el.setAttribute('data-k-soft', errs.notes.length);
    errs.notes.forEach(function (n) { warn(name, n + ' (the rest of the block is shown)', n.replace(/\[\d+\]/g, '[]')); });
   }
   fm = def.fill && !errs.length ? fillMode(c, el) : '';
   h.fill = fm;
   if (c.fill === false) el.classList.add('k-b-nofill');
   if (c.fill && !def.fill && !errs.length) warn(name, 'fill is not supported by this block, ignored');
   el.classList.toggle('k-b-card', !!framed);
   rec.pending = !errs.length && !!def.resize && c.state === 'ready' && hidden(el);
   if (rec.pending) { h.resizeObserver(el, draw, 0); return; }
   rec.w = el.clientWidth;
   if (framed && (c.title || c.subtitle || acts.length)) {
    var lvl = Math.min(6, Math.max(2, c.headingLevel | 0));
    el.appendChild(H.el('header', { class: 'k-b-head' }, [
     H.el('div', { class: 'k-b-titles' }, [c.title != null ? H.el('h' + lvl, { class: 'k-b-title', title: str(c.title) }, H.nowrap(c.title)) : null,
      c.subtitle != null ? H.el('p', { class: 'k-b-sub', title: str(c.subtitle) }, H.nowrap(c.subtitle)) : null]),
     acts.length ? H.el('div', { class: 'k-b-actions' }, acts.map(function (a) {
      a = a || {};
      return H.el(a.href ? 'a' : 'button', { class: 'k-b-btn' + (a.kind === 'primary' ? ' k-b-btn-primary' : ''), href: a.href, type: a.href ? null : 'button', id: a.id, text: a.label, on: a.onClick ? { click: a.onClick } : null });
     })) : null]));
    body = el.appendChild(H.el('div', { class: 'k-b-body' }));
   }
   if (fm) { el.classList.add('k-b-fill'); if (fm === 'scroll') el.classList.add('k-b-fill-scroll'); el.setAttribute('data-k-fill', fm); body.classList.add('k-b-fill-body'); }
   // compact states: asked for (cfg.compact or def.compact), or automatic when the block is under 320 px wide
   var so = { compact: c.compact != null ? c.compact : !!def.compact || (el.clientWidth > 0 && el.clientWidth < 320) };
   if (errs.length) { var m = errs.slice(0, 3).join('; ') + (errs.length > 3 ? ' (+' + (errs.length - 3) + ' more)' : ''); warn(name, 'bad config: ' + m, el); H.error(body, 'This ' + name + ' block cannot be shown', 'Config: ' + m); return; }
   if (isA(c.colorKeys)) setPalette(c.colorKeys, false);
   if (c.state === 'loading') { H.loading(body, null, so); return; }
   if (c.state === 'error') { H.error(body, c.errorText || 'Could not load this data', null, so); return; }
   if (c.state === 'empty' || (def.empty && def.empty(c))) { H.empty(body, c.emptyText || def.emptyText, null, so); return; }
   def.render(body, c, h);
   suspect(el, name);
   if (typeof MutationObserver !== 'undefined') { var mo = new MutationObserver(function () { clearTimeout(rec.st); rec.st = setTimeout(function () { suspect(el, name); }, 60); }); mo.observe(el, { childList: true, subtree: true, characterData: true }); cleanups.push(function () { clearTimeout(rec.st); mo.disconnect(); }); }
   if (def.resize) h.resizeObserver(el, draw);
   else if (fm === 'grow' && rec.fit) h.resizeObserver(el, runFit);
   if (fm === 'scroll' && !body.classList.contains('k-b-own-scroll')) {
    body.setAttribute('tabindex', '0'); body.setAttribute('role', 'region'); body.setAttribute('aria-label', (c.title != null ? str(c.title) : name) + ' (scrollable)');
    h.fade(body);
   }
   if (fm === 'grow' && rec.fit) {
    runFit();
    if (typeof ResizeObserver !== 'undefined') {
     var ro = new ResizeObserver(function () {
      if (rec.busy || rec.stop) return;
      clearTimeout(rec.ft);
      rec.ft = setTimeout(function () { if (Math.abs(el.offsetHeight - rec.lastH) >= 2) runFit(); }, 40);
     });
     ro.observe(el);
     cleanups.push(function () { clearTimeout(rec.ft); ro.disconnect(); });
    }
   }
  } catch (e) {
   var msg = String((e && e.message) || e).slice(0, 160);
   warn(name, 'render failed: ' + msg, el);
   try { H.error(body, 'This ' + name + ' block failed to render', msg); } catch (e2) { /* ignore */ }
  }
 };
 rec.draw = draw; rec.resize = !!def.resize;
 var onTheme = function () { if (def.theme) draw(); };
 d.addEventListener('k-theme', onTheme);
 live.push(rec);
 draw();
 handle = {
  el: el, name: name, ok: true,
  get cfg() { return cur; },
  update: function (next) { cur = typeOk('object', cur) && typeOk('object', next) ? Object.assign({}, cur, next) : next; draw(); return handle; },
  destroy: function () { reset(); d.removeEventListener('k-theme', onTheme); live = live.filter(function (r) { return r !== rec; }); el.textContent = ''; el.classList.remove('k-b', 'k-b-' + name, 'k-b-card'); el.removeAttribute('data-k-block'); el._kBlock = null; }
 };
 el._kBlock = handle;
 return handle;
};
// route change (hashchange, kit:route): after the router has shown the new section, draw blocks that were waiting or changed width
var onRoute = function () {
 setTimeout(function () {
  live.forEach(function (r) { if (r.resize && r.el.isConnected && !hidden(r.el) && (r.pending || Math.abs(r.el.clientWidth - r.w) >= 2)) r.draw(); });
 }, 0);
};
window.addEventListener('hashchange', onRoute);
window.addEventListener('kit:route', onRoute);

/* ---------- declarative mounting ---------- */
// <div data-k-block="table" data-k-cfg="shipments"></div> + window.UI_BLOCKS = {shipments: {...} | function (CANON, el) {return {...}}}
var mountAll = function (scope) {
 scope = scope && scope.querySelectorAll ? scope : d;
 var list = [].slice.call(scope.querySelectorAll('[data-k-block][data-k-cfg]')), out = [];
 if (scope.matches && scope.matches('[data-k-block][data-k-cfg]')) list.unshift(scope);
 list.forEach(function (el) {
  var name = el.getAttribute('data-k-block'), key = el.getAttribute('data-k-cfg'), src = window.UI_BLOCKS || {};
  if (el._kBlock && el._kKey === key) return;
  el._kKey = key;
  var bad = function (why) {
   warn(name, why, el);
   el.classList.add('k-b', 'k-b-card');
   H.error(el, 'This ' + name + ' block cannot be shown', why);
  };
  if (!defs[name]) return bad('unknown block "' + name + '": load ' + name + '.js (blocks: ' + Object.keys(defs).join(', ') + ')');
  if (!Object.prototype.hasOwnProperty.call(src, key)) return bad('no config "' + key + '" in window.UI_BLOCKS');
  var cfg = src[key];
  if (typeof cfg === 'function') { try { cfg = cfg(window.CANON, el); } catch (e) { return bad('UI_BLOCKS.' + key + '() failed: ' + String((e && e.message) || e).slice(0, 120)); } }
  out.push(mount(name, el, cfg));
 });
 return out;
};
var block = (K.block = K.block || {});
block.h = H;
block.palette = function (spec) { setPalette(spec, true); };
block.list = function () { return Object.keys(defs).map(function (n) { return { name: n, version: defs[n].version || '1', schema: defs[n].schema || {} }; }); };
// K.block.mount(root?) mounts every [data-k-block][data-k-cfg] once; K.block.mount(name, el, cfg) is the old imperative form
block.mount = function (a, b, c) { return typeof a === 'string' && arguments.length > 1 ? mount(a, b, c) : mountAll(a); };
block.define = function (name, def) {
 if (!/^[a-z][a-z0-9]*$/.test(name) || RESERVED[name] || !def || typeof def.render !== 'function') { warn(String(name), 'invalid definition'); return; }
 defs[name] = def;
 block[name] = function (el, cfg) { return mount(name, el, cfg); };
};
if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { mountAll(); });
else setTimeout(mountAll, 0);

/* ---------- theme ---------- */
var THEMES = ['ops', 'control', 'warm'], ACCENTS = ['blue', 'green', 'teal', 'gold', 'indigo', 'violet', 'rose', 'orange'];
K.theme = {
 list: THEMES.slice(),
 accents: ACCENTS.slice(),
 // accent(): current preset or '' (the theme's own accent); accent(name) sets data-k-accent (and data-accent, which kit.css reads); accent('') or accent(null) goes back to the theme's own
 accent: function (a) {
  if (arguments.length) {
   if (a && ACCENTS.indexOf(a) < 0) { warn('theme', 'unknown accent ' + a); return root.getAttribute('data-k-accent') || ''; }
   if (a) { root.setAttribute('data-k-accent', a); root.setAttribute('data-accent', a); } else { root.removeAttribute('data-k-accent'); root.removeAttribute('data-accent'); }
   d.dispatchEvent(new Event('k-theme'));
  }
  return root.getAttribute('data-k-accent') || '';
 },
 get: function () { return root.getAttribute('data-k-theme') || 'ops'; },
 set: function (t) {
  if (THEMES.indexOf(t) < 0) { warn('theme', 'unknown theme ' + t); return; }
  root.setAttribute('data-k-theme', t);
  d.dispatchEvent(new Event('k-theme'));
 }
};
})();
