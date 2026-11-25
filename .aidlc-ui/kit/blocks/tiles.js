/* @block tiles 1.0 -- Media tiles: a responsive grid or a scrolling rail of cover cards (albums, videos, products, photos, stories, listings).
 * Use for: music shelves (albums, playlists, artists), video cards (duration, channel, views), shop product cards (price, rating, add to cart), photo grids, story strips, "Recommended" rails with "See all".
 * Pick: Cover cards in a grid or horizontal rail: albums, videos, products, photos, stories; whole tile opens, hover action.
 * Load: blocks.css, media.lib.css, tiles.css, core.js, media.lib.js, tiles.js
 * Call: K.block.tiles('#a-shelf', {title: 'Made for you', layout: 'rail', items: [{id: 'al1', title: 'Night Drive', sub: 'Marta Silva', actions: [{id: 'play', label: 'Play', icon: 'play'}]}], onSelect: function (item) {}, onAction: function (item, actionId) {}})
 * Config:
 *   items       array, required  [{id?, title, sub?, cover?, badge?, duration?, price?, oldPrice?, rating?, ratingCount?, meta?, byline?, progress?, ring?, href?, selected?, actions?}]
 *     title     text, required   2 lines (see lines); the accessible name of the tile
 *     sub, meta text            muted lines (artist; "1.2M views \u00b7 3 days ago")
 *     cover     object           {src?, alt?, glyph?, key?}: src = data URI or app file; without it or when it fails: tint + initials (glyph instead)
 *     badge     text             chip on the cover ("New", "-20%"); duration  number|text  chip bottom right (seconds -> "3:45")
 *     price, oldPrice  text      shown as given, never computed; oldPrice struck through
 *     rating    number           0..5 stars; ratingCount  text|number  "(1.2K)"
 *     byline    object           {name, src?}: small avatar + name (channel, seller)
 *     progress  number           0..100 bar on the cover; ring  'unseen'|'seen'  ring round the cover (story)
 *     href      string           the tile is a link; selected  boolean  accent ring + aria-current
 *     actions   array            [{id?, label, icon?}]: with icon = round button on the cover, shown on hover and focus (always on touch); without = text button beside the price
 *   layout      'grid'|'rail', default 'grid'  rail = one row: scroll-snap, edge fade, arrow buttons, tab stop with label
 *   shape       'square'|'wide'|'portrait'|'round', default 'square'  cover ratio 1:1, 16:9, 3:4; round = circle, centred title (artists, stories)
 *   minWidth    number, default 160   smallest tile width in px; lines  1|2, default 2  title lines
 *   caption     boolean, default true  false = covers only (photo grid); arrows  boolean, default true  rail buttons
 *   selectable  'single'|'none', default 'single'  tiles without href are buttons that mark themselves selected
 *   onSelect    function(item)       tile pressed (not for href tiles); onAction  function(item, actionId)  tile action pressed
 *   (common)    title, subtitle, actions (e.g. "See all"), state, emptyText, frame, headingLevel
 * States: empty, loading, error, bad config; selected; cover missing or failed (tint + initials).
 * Keyboard: Tab through tiles and actions (hover action shows on focus); the rail is a tab stop, arrow keys scroll it.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] tiles: load core.js before tiles.js'); return; }
  if (!K.media) { console.warn('[K.block] tiles: load media.lib.js before tiles.js'); return; }
  var M = K.media, warnedCb = {};
  var cb = function (name, fn, a, b) {
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (e) {
      var m = name + ' threw: ' + String((e && e.message) || e).slice(0, 120);
      if (!warnedCb[m]) { warnedCb[m] = 1; console.warn('[K.block] tiles: ' + m); }
    }
  };
  var RATIO = { wide: '16/9', portrait: '3/4' };
  var obj = function (v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  var has = function (v) { return v != null && v !== ''; };
  var safe = function (u) { return typeof u === 'string' && u && !/^\s*javascript:/i.test(u) ? u : null; };
  K.block.define('tiles', {
    version: '1.0', frame: true, resize: true, emptyText: 'Nothing to show yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, title: { type: 'text', required: true }, sub: { type: 'text' }, cover: { type: 'object' }, badge: { type: 'text' }, duration: { type: 'text' },
        price: { type: 'text' }, oldPrice: { type: 'text' }, rating: { type: 'number' }, ratingCount: { type: 'text' }, meta: { type: 'text' }, byline: { type: 'object' },
        progress: { type: 'number' }, ring: { type: 'string', enum: ['unseen', 'seen'] }, href: { type: 'string' }, selected: { type: 'boolean' }, actions: { type: 'array' } } },
      layout: { type: 'string', enum: ['grid', 'rail'], default: 'grid' },
      shape: { type: 'string', enum: ['square', 'wide', 'portrait', 'round'], default: 'square' },
      minWidth: { type: 'number', default: 160 },
      lines: { type: 'number', default: 2 },
      caption: { type: 'boolean', default: true },
      selectable: { type: 'string', enum: ['single', 'none'], default: 'single' },
      arrows: { type: 'boolean', default: true },
      onSelect: { type: 'function' }, onAction: { type: 'function' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var items = c.items, bare = !c.caption, rail = c.layout === 'rail', one = c.lines === 1;
      var keyOf = function (it, i) { return it.id != null ? String(it.id) : 'i' + i; };
      var init = '';
      items.some(function (it, i) { return it.selected && (init = keyOf(it, i)); });
      var st = el._kTl;
      if (!st || st.init !== init) st = el._kTl = { init: init, sel: init, x: 0 };
      var min = Math.max(72, Math.min(640, +c.minWidth || 160));
      var ul = h.el('ul', { class: 'k-tl-list', style: { '--k-tl-min': min + 'px' } });
      if (!rail) {
        var w = el.clientWidth || 720, gap = bare ? 4 : 12, cols = Math.max(1, Math.floor((w + gap) / (min + gap)));
        if (cols < 2 && c.shape !== 'wide' && w >= 200) cols = 2;
        ul.style.setProperty('grid-template-columns', 'repeat(' + cols + ',minmax(0,1fr))');
      }
      var guards = [];

      items.forEach(function (it, i) {
        var k = keyOf(it, i), cv = obj(it.cover), by = obj(it.byline), href = safe(it.href), link = !!href, btn = !link && c.selectable === 'single';
        var acts = (Array.isArray(it.actions) ? it.actions : []).filter(function (a) { return a && typeof a === 'object' && has(a.label); });
        var aid = function (a) { return a.id != null ? String(a.id) : String(a.label); };
        var cover = M.cover(h, { title: it.title, src: safe(cv.src), alt: '', key: cv.key, glyph: cv.glyph, ratio: RATIO[c.shape] || '1/1', duration: it.duration });
        if (it.ring) cover.classList.add('k-m-ring', 'k-m-ring-' + it.ring);
        if (typeof it.progress === 'number' && isFinite(it.progress)) {
          var p = Math.max(0, Math.min(100, it.progress));
          cover.appendChild(h.el('span', { class: 'k-tl-prog', role: 'progressbar', 'aria-label': 'Progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p }, h.el('span', { style: { width: p + '%' } })));
        }
        var ov = acts.filter(function (a) { return a.icon; }), foot = acts.filter(function (a) { return !a.icon; });
        var media = h.el('div', { class: 'k-tl-media' }, [bare ? null : cover, has(it.badge) ? h.line(it.badge, { class: 'k-m-badge' }) : null, ov.length ? h.el('div', { class: 'k-tl-ov' + (has(it.duration) ? ' k-tl-ov-l' : '') }, ov.map(function (a) {
          return h.el('button', { class: 'k-tl-ib', type: 'button', title: String(a.label), 'aria-label': a.label + ': ' + it.title, 'data-act': aid(a), on: { click: function () { cb('onAction', c.onAction, it, aid(a)); } } }, [M.icon(h, a.icon, { size: 18 })]);
        })) : null]);

        var ttl = h.el('span', { class: 'k-tl-t' + (one ? ' k-tl-one' : ''), title: String(it.title) }, h.el('span', null, h.nowrap(it.title)));
        guards.push(ttl);
        var new_ = it.ring === 'unseen' ? h.el('span', { class: 'k-tl-sr', text: ' (new)' }) : null;
        var main = h.el(link ? 'a' : btn ? 'button' : 'div', { class: 'k-tl-main', href: href, type: btn ? 'button' : null,
          'aria-current': (it.selected && link) || (btn && k === st.sel) ? 'true' : null, 'aria-label': bare && (link || btn) ? String(cv.alt != null && cv.alt !== '' ? cv.alt : it.title) : null, title: bare ? String(it.title) : null }, bare ? cover : [ttl, new_]);
        if (btn) main.addEventListener('click', function () { st.sel = k; mark(); cb('onSelect', c.onSelect, it); });

        var price = has(it.price) || has(it.oldPrice);
        var body = bare ? null : h.el('div', { class: 'k-tl-body' }, [
          main,
          has(it.sub) ? h.line(it.sub, { class: 'k-tl-s' }) : null,
          has(by.name) ? h.el('div', { class: 'k-tl-by' }, [M.avatar(h, { name: by.name, src: safe(by.src), size: 'sm' }), h.line(by.name)]) : null,
          has(it.meta) ? h.line(it.meta, { class: 'k-tl-s' }) : null,
          typeof it.rating === 'number' ? h.el('div', { class: 'k-tl-r' }, M.stars(h, it.rating, { count: it.ratingCount })) : null,
          price || foot.length ? h.el('div', { class: 'k-tl-f' }, [price ? h.el('span', { class: 'k-tl-p' }, [
              has(it.price) ? h.el('span', { class: 'k-tl-pv k-b-nw', text: String(it.price) }) : null,
              has(it.oldPrice) ? h.el('s', { class: 'k-tl-po k-b-nw' }, [h.el('span', { class: 'k-tl-sr', text: 'Was ' }), String(it.oldPrice)]) : null]) : null].concat(foot.map(function (a) {
              return h.el('button', { class: 'k-b-btn k-tl-fb', type: 'button', 'aria-label': a.label + ': ' + it.title, 'data-act': aid(a), on: { click: function () { cb('onAction', c.onAction, it, aid(a)); } } }, [a.label]);
            }))) : null]);

        ul.appendChild(h.el('li', { class: 'k-tl-item', id: it.id != null ? String(it.id) : null, 'data-k': k, 'data-selected': k === st.sel ? 'true' : 'false' },
          [h.el('div', { class: 'k-tl-card' }, bare ? [main, ov.length || has(it.badge) ? media : null] : [media, body])]));
      });

      var mark = function () {
        [].forEach.call(ul.children, function (li) {
          var on = li.getAttribute('data-k') === st.sel, m = li.querySelector('.k-tl-main');
          li.setAttribute('data-selected', on ? 'true' : 'false');
          if (m && m.tagName === 'BUTTON') { if (on) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current'); }
        });
      };

      ul.className += ' k-tl-' + c.shape + (bare ? ' k-tl-bare' : '') + (rail ? ' k-tl-rl' : ' k-tl-grid');
      if (!rail) { el.appendChild(ul); } else {
        var track = h.el('div', { class: 'k-tl-track', role: 'region', tabindex: '0', 'aria-label': (c.title != null ? String(c.title) : 'Items') + ' (scrollable)' }, ul);
        var wrap = h.el('div', { class: 'k-tl-rail' }, [track]);
        var edge = function () {
          var m = track.scrollWidth - track.clientWidth;
          st.x = track.scrollLeft;
          wrap.setAttribute('data-l', st.x > 2 ? '1' : '0'); wrap.setAttribute('data-r', st.x < m - 2 ? '1' : '0');
        };
        if (c.arrows) [-1, 1].forEach(function (d) {
          wrap.appendChild(h.el('button', { class: 'k-tl-arr k-tl-arr-' + (d < 0 ? 'l' : 'r'), type: 'button', 'aria-label': d < 0 ? 'Scroll left' : 'Scroll right', title: d < 0 ? 'Scroll left' : 'Scroll right',
            on: { click: function () { track.scrollBy({ left: d * Math.max(120, track.clientWidth * 0.8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } } }, [M.icon(h, d < 0 ? 'prev' : 'next', { size: 16 })]));
        });
        track.addEventListener('scroll', edge, { passive: true });
        el.appendChild(wrap);
        track.scrollLeft = st.x;
        edge();
      }
      guards.forEach(function (g) { if (g.scrollWidth > g.clientWidth + 1) g.classList.add('k-tl-one'); });
    }
  });
})();
