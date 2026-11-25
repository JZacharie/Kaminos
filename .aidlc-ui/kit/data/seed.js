/* AI-DLC UI kit data helpers (MIT-0). Deterministic: the same seed always gives the same rows.
   ui-build inlines this file (and charts.js) in front of src/data.js. Do not load it from anywhere else. */
var TODAY = new Date(Date.UTC(2026, 10, 4, 9, 0, 0)); // fixed "today" (2026-11-04 09:00 UTC); change it per prototype if the story needs another date

// Mulberry32 PRNG. const rnd = seedRandom(42); rnd() returns a float in [0, 1).
function seedRandom(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// pick(rnd, ['a', 'b'])  ->  one element
function pick(rnd, list) { return list[Math.floor(rnd() * list.length)]; }
// weighted(rnd, [['On time', 6], ['Delayed', 2]])  ->  one value, chosen by weight
function weighted(rnd, pairs) {
  var total = pairs.reduce(function (s, p) { return s + p[1]; }, 0), x = rnd() * total;
  for (var i = 0; i < pairs.length; i++) { x -= pairs[i][1]; if (x < 0) return pairs[i][0]; }
  return pairs[pairs.length - 1][0];
}
// range(rnd, 3, 12)  ->  integer between 3 and 12 inclusive
function range(rnd, min, max) { return min + Math.floor(rnd() * (max - min + 1)); }
// dateBack(3, 5)  ->  Date 3 days and 5 hours before TODAY. Negative values give a future date (ETA).
function dateBack(days, hours) { return new Date(TODAY.getTime() - days * 864e5 - (hours || 0) * 36e5); }
// pad(7)  ->  "07";  pad(7, 4)  ->  "0007"
function pad(n, width) { return String(n).padStart(width || 2, '0'); }
// fmtDate(d)  ->  "2026-11-04";  fmtTime(d)  ->  "09:00" (UTC); fmtDay(d) -> "4 Nov"
function fmtDate(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function fmtTime(d) { return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
function fmtDay(d) { return d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; }
// fmtNum(12400)  ->  "12,400" (fixed locale so output never depends on the machine)
function fmtNum(n, digits) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 }); }
// esc(text)  ->  HTML-escaped text. Use it for every value put into a template string.
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
// fill('#shipments-body', rows, function (r) { return '<tr>...</tr>'; })  ->  replaces the children of the element
function fill(selector, items, tpl) {
  var el = document.querySelector(selector);
  if (el) el.innerHTML = items.map(tpl).join('');
  return el;
}
// text('#a-kpi-delayed .k-kpi-value', '7')  ->  sets textContent
function text(selector, value) {
  var el = document.querySelector(selector);
  if (el) el.textContent = value;
  return el;
}
