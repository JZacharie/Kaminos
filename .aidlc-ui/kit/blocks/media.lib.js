/* AI-DLC UI blocks media helpers 1.0 -- shared by the consumer-style blocks (tiles, rows, player, chat, posts, comments, profile, calendar).
 * Not a block: no K.block.define, not in BLOCKS.md. ui-build inlines it (and media.lib.css) after core.js when one of those blocks is used.
 * Every helper takes the block's `h` first and returns a DOM node. No network: `src` is only used when the app gives one (data URI or its own file);
 * without `src`, or when the image fails, a cover or avatar is drawn from the title: a category-coloured tint with initials or a glyph.
 *   K.media.icon(h, name, {size})            name: play pause prev next shuffle repeat volume mute heart comment share bookmark send more plus minus check close cart star search image pin link calendar mail chevl chevr
 *   K.media.avatar(h, {name, src, key, size:'sm'|'md'|'lg'|'xl', ring:'unseen'|'seen'|'', status:'online'|'away'|'busy'|'offline'})
 *   K.media.cover(h, {title, src, alt, key, ratio:'1/1'|'16/9'|'4/5'|'3/4'|'2/1', glyph, badge, duration})
 *   K.media.stars(h, value, {max, count})    value 0..max (default 5); the label reads "4.5 out of 5"
 *   K.media.count(n) -> "1.2K" for numbers (strings are shown as given);  K.media.clock(seconds) -> "3:45" or "1:02:03"
 */
(function () {
  'use strict';
  var K = window.K = window.K || {};
  var M = K.media = K.media || {};
  var P = {
    play: 'M8 5v14l11-7z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', prev: 'M7 5h2v14H7zM20 5v14L10 12z', next: 'M15 5h2v14h-2zM4 5v14l10-7z',
    shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5', repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
    volume: 'M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13', mute: 'M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
    heart: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z', comment: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
    share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14', bookmark: 'M6 3h12v18l-6-4-6 4z', send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
    pin: 'M12 21c-4-4-7-7.4-7-11.5a7 7 0 0 1 14 0c0 4.1-3 7.5-7 11.5zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', mail: 'M3 5h18v14H3zM3 7l9 7 9-7', chevl: 'M15 5l-7 7 7 7', chevr: 'M9 5l7 7-7 7',
    more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12.5l4.5 4.5L19 7.5', close: 'M6 6l12 12M18 6 6 18',
    cart: 'M3 4h2l2.4 11h11l2-8H6M9 20h.01M17 20h.01', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01'
  };
  var FILLED = { play: 1, pause: 1, prev: 1, next: 1, star: 1 };
  var COMPACT;
  M.icon = function (h, name, o) {
    var s = (o && o.size) || 20, fill = !!FILLED[name];
    return h.svg('svg', { class: 'k-m-ic', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': 'true', focusable: 'false', fill: fill ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': fill ? '1.5' : '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h.svg('path', { d: P[name] || P.image })]);
  };
  M.initials = function (name) {
    var w = String(name == null ? '' : name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return ((w[0].charAt(0)) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  };
  var tint = function (h, key, n) { var c = h.catFor(key == null || key === '' ? 'x' : key); return 'linear-gradient(135deg,color-mix(in srgb,' + c + ' ' + n + '%,var(--k-surface)),color-mix(in srgb,' + c + ' ' + Math.round(n / 2.4) + '%,var(--k-surface-2)))'; };
  var img = function (h, src, alt, cls, fb) {
    var im = h.el('img', { class: cls, src: src, alt: alt || '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    im.addEventListener('error', function () { im.style.display = 'none'; fb.classList.add('k-m-nofig'); });
    return im;
  };
  M.avatar = function (h, o) {
    o = o || {};
    var name = o.name == null ? '' : String(o.name), size = /^(sm|md|lg|xl)$/.test(o.size) ? o.size : 'md';
    var a = h.el('span', { class: 'k-m-av k-m-av-' + size + (o.ring ? ' k-m-ring k-m-ring-' + (o.ring === 'seen' ? 'seen' : 'unseen') : ''), style: { background: tint(h, o.key != null ? o.key : name, 30) }, 'aria-hidden': 'true' });
    a.appendChild(h.el('span', { class: 'k-m-ini', text: M.initials(name) }));
    if (o.src) a.appendChild(img(h, o.src, '', 'k-m-img', a));
    if (o.status) a.appendChild(h.el('span', { class: 'k-m-st k-m-st-' + (/^(online|away|busy)$/.test(o.status) ? o.status : 'offline'), title: String(o.status) }));
    return a;
  };
  M.cover = function (h, o) {
    o = o || {};
    var ratio = /^(1\/1|16\/9|4\/5|3\/4|2\/1)$/.test(o.ratio) ? o.ratio : '1/1', title = o.title == null ? '' : String(o.title);
    var c = h.el('span', { class: 'k-m-cover', style: { 'aspect-ratio': ratio, background: tint(h, o.key != null ? o.key : title, 34) } });
    c.appendChild(o.glyph ? h.el('span', { class: 'k-m-glyph', 'aria-hidden': 'true', text: o.glyph }) : h.el('span', { class: 'k-m-glyph k-m-glyph-t', 'aria-hidden': 'true', text: M.initials(title) }));
    if (o.src) c.appendChild(img(h, o.src, o.alt != null ? o.alt : title, 'k-m-img', c));
    if (o.badge != null && o.badge !== '') c.appendChild(h.el('span', { class: 'k-m-badge', text: o.badge }));
    if (o.duration != null && o.duration !== '') c.appendChild(h.el('span', { class: 'k-m-dur k-b-nw', text: typeof o.duration === 'number' ? M.clock(o.duration) : o.duration }));
    return c;
  };
  M.stars = function (h, value, o) {
    o = o || {};
    var max = o.max > 0 ? o.max : 5, v = Math.max(0, Math.min(max, +value || 0)), label = h.num(v, { dp: v % 1 ? 1 : 0 }) + ' out of ' + max, id = h.uid('kst');
    var row = function (cls, clip) { var g = h.svg('g', { class: cls, 'clip-path': clip || null }); for (var i = 0; i < max; i++) g.appendChild(h.svg('path', { d: P.star, transform: 'translate(' + i * 16 + ' 0) scale(.6667)' })); return g; };
    var bar = h.el('span', { class: 'k-m-stars', role: 'img', 'aria-label': label, title: label }, [h.svg('svg', { viewBox: '0 0 ' + max * 16 + ' 16', width: max * 14, height: 14, 'aria-hidden': 'true', focusable: 'false' }, [
      h.svg('clipPath', { id: id }, [h.svg('rect', { width: v * 16, height: 16 })]), row('k-m-st-bg'), row('k-m-st-fg', 'url(#' + id + ')')])]);
    return o.count != null && o.count !== '' ? h.el('span', { class: 'k-m-rate' }, [bar, h.el('span', { class: 'k-m-rate-n k-b-nw', text: '(' + M.count(o.count) + ')' })]) : bar;
  };
  M.count = function (n) {
    if (typeof n !== 'number' || !isFinite(n)) return n == null ? '' : String(n);
    if (Math.abs(n) < 1000) return String(n);
    try { COMPACT = COMPACT || new Intl.NumberFormat(document.documentElement.lang || undefined, { notation: 'compact', maximumFractionDigits: 1 }); return COMPACT.format(n); } catch (e) { return String(n); }
  };
  M.clock = function (s) {
    s = Math.max(0, Math.round(+s || 0));
    var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60, p = function (x) { return (x < 10 ? '0' : '') + x; };
    return hh ? hh + ':' + p(mm) + ':' + p(ss) : mm + ':' + p(ss);
  };
})();
