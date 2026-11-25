/* @block rows 1.0 -- Rich rows: cover, avatar or number, two text lines, figures at the right and inline controls (like, switch, stepper, button).
 * Use for: playlists and track lists (numbered, now playing, like), inbox (avatar, last message, time, unread), contacts, notifications, search results, cart lines (price, quantity, remove), settings rows (switch).
 * Pick: Rows with a lead (cover, avatar, number), text and trailing controls: tracks, inbox, cart lines, settings.
 * Load: blocks.css, media.lib.css, rows.css, core.js, media.lib.js, rows.js
 * Call: K.block.rows('#a-queue', {numbered: true, items: [{id: 't1', title: 'Night Drive', sub: 'Marta Silva', meta: 'Harbour Lights', duration: 225, trailing: [{kind: 'like'}]}], onChange: function (item, kind, value) {}})
 * Config:
 *   items       array, required  [{id?, title, sub?, meta?, lead?, value?, duration?, time?, unread?, badge?, status?, playing?, selected?, href?, disabled?, trailing?}], 
 *     title     text, required   one line (ellipsis + title); sub  text  muted second line; meta  text  muted column (album), hidden under 30rem
 *     lead      object           {type: 'cover'|'avatar'|'index'|'icon'|'none', src?, glyph?, key?, status?}: src = data URI or app file (failed = tint + initials); avatar status online|away|busy|offline; glyph = icon name (cart, check...) or text
 *     value     text|number      bold figure as given ("\u20ac49.00"), never computed; duration  number|text  seconds -> "3:45"; time  time  "09:41", "Yesterday"
 *     unread    number           count pill; badge  text  chip; status  text  pill through status words (Delivered, Failed, Pending)
 *     playing   boolean          now-playing bars + accent title; selected  boolean  accent row, aria-current; disabled  boolean  greyed; href  string  row is a link
 *     trailing  array            {kind:'like'|'play'|'switch', value?} | {kind:'stepper', value, min?, max?} | {kind:'button', id, label, icon?} | {kind:'text', text} | {kind:'chevron'}
 *   numbered    boolean, default false  index column 1..n; dividers  boolean, default true; density  'comfortable'|'compact'
 *   selectable  'single'|'none', default 'none'  single: rows without href are buttons that mark themselves selected
 *   fill        true|'scroll'|false  row-height fill, see DESIGN.md
 *   onSelect(item); onChange(item, 'like'|'switch'|'stepper', value) with the value already shown; onAction(item, id) for play and button
 *   (common)    title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty, loading, error, bad config; selected, playing, disabled rows.
 * Keyboard: Tab through rows and controls; Up/Down/Home/End move between rows.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.media) { console.warn('[K.block] rows: load core.js and media.lib.js first'); return; }
  var M = K.media, warned = {};
  var cb = function (name, fn, a, b, c) {
    if (typeof fn !== 'function') return;
    try { fn(a, b, c); } catch (e) {
      var m = name + ' threw: ' + String((e && e.message) || e).slice(0, 120);
      if (!warned[m]) { warned[m] = 1; console.warn('[K.block] rows: ' + m); }
    }
  };
  var has = function (v) { return v != null && v !== ''; };
  var ICONS = /^[a-z]{3,8}$/;
  K.block.define('rows', {
    version: '1.0', frame: true, fill: true, emptyText: 'Nothing to show yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, title: { type: 'text', required: true }, sub: { type: 'text' }, meta: { type: 'text' }, lead: { type: 'object' }, value: { type: 'text' },
        duration: { type: 'text' }, badge: { type: 'text' }, unread: { type: 'number' }, time: { type: 'time' }, status: { type: 'text' }, playing: { type: 'boolean' },
        selected: { type: 'boolean' }, href: { type: 'string' }, disabled: { type: 'boolean' }, trailing: { type: 'array' } } },
      numbered: { type: 'boolean', default: false },
      dividers: { type: 'boolean', default: true },
      density: { type: 'string', enum: ['comfortable', 'compact'], default: 'comfortable' },
      selectable: { type: 'string', enum: ['single', 'none'], default: 'none' },
      onSelect: { type: 'function' }, onChange: { type: 'function' }, onAction: { type: 'function' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var items = c.items, keyOf = function (it, i) { return it.id != null ? String(it.id) : 'i' + i; };
      var sig = JSON.stringify(items.map(function (it) { return [it.selected, it.playing, (it.trailing || []).map(function (t) { return t && [t.kind, t.value]; })]; }));
      var st = el._kRows;
      if (!st || st.sig !== sig) { 
        st = el._kRows = { sig: sig, sel: null, play: null, v: {} };
        items.forEach(function (it, i) {
          var k = keyOf(it, i);
          if (it.selected && st.sel == null) st.sel = k;
          if (it.playing && st.play == null) st.play = k;
          (it.trailing || []).forEach(function (t, j) { if (t && t.value != null) st.v[k + ':' + j] = t.value; });
        });
      }
      var single = c.selectable === 'single', ul = h.el('ul', { class: 'k-rows k-rows-' + c.density + (c.dividers ? ' k-rows-div' : '') }), rows = [];
      var paint = function () {
        rows.forEach(function (r) {
          var on = r.k === st.sel, pl = r.k === st.play, cur = r.main.tagName !== 'DIV' ? r.main : r.li;
          r.li.setAttribute('data-selected', on ? 'true' : 'false');
          r.li.setAttribute('data-playing', pl ? 'true' : 'false');
          if (on) cur.setAttribute('aria-current', 'true'); else cur.removeAttribute('aria-current');
          r.eq.hidden = r.sr.hidden = !pl;
          if (r.num) r.num.hidden = pl;
          if (r.pb) { r.pb.setAttribute('aria-label', (pl ? 'Playing: ' : 'Play: ') + r.it.title); r.pb.firstChild.replaceWith(M.icon(h, pl ? 'pause' : 'play', { size: 18 })); }
        });
      };
      var dd, ib = function (cls, label, icon, size, extra) {
        return h.el('button', Object.assign({ class: cls, type: 'button', title: label, 'aria-label': label, disabled: dd }, extra), M.icon(h, icon, { size: size }));
      };
      items.forEach(function (it, i) {
        var k = keyOf(it, i), ld = it.lead || {}, name = String(it.title), dis = !!it.disabled, link = typeof it.href === 'string' && it.href && !/^\s*javascript:/i.test(it.href) && !dis;
        var btn = !link && single && !dis, r = { k: k, it: it }, lead = null, d = dd = dis || null;
        if (ld.type === 'cover') lead = h.el('span', { class: 'k-rows-cv' }, M.cover(h, { title: name, src: ld.src, alt: '', key: ld.key, glyph: ld.glyph }));
        else if (ld.type === 'avatar') lead = M.avatar(h, { name: name, src: ld.src, key: ld.key, status: ld.status });
        else if (ld.type === 'icon' || ld.type === 'index') lead = h.el('span', { class: ld.type === 'index' ? 'k-rows-n' : 'k-rows-ic', 'aria-hidden': 'true' }, ICONS.test(ld.glyph) ? M.icon(h, ld.glyph, { size: 18 }) : has(ld.glyph) ? String(ld.glyph) : null);
        r.eq = h.el('span', { class: 'k-rows-eq', 'aria-hidden': 'true', hidden: true }, [h.el('i'), h.el('i'), h.el('i')]);
        r.sr = h.el('span', { class: 'k-rows-sr', text: ' (now playing)' });
        if (c.numbered) { r.num = h.el('span', { text: i + 1 }); r.ix = h.el('span', { class: 'k-rows-n' }, [r.num, r.eq]); }
        var main = r.main = h.el(link ? 'a' : btn ? 'button' : 'div', { class: 'k-rows-main', href: link ? it.href : null, type: btn ? 'button' : null, 'aria-disabled': dis ? 'true' : null }, h.line(name, { class: 'k-rows-t' }));
        if (btn) main.addEventListener('click', function () { st.sel = k; paint(); cb('onSelect', c.onSelect, it); });

        var tr = (Array.isArray(it.trailing) ? it.trailing : []).map(function (t, j) {
          t = t || {};
          var vk = k + ':' + j, kind = t.kind, fire = function (v) { cb('onChange', c.onChange, it, kind, v); };
          if (kind === 'like' || kind === 'switch') {
            var tg = kind === 'like', b = tg ? ib('k-rows-ib k-rows-like', 'Like: ' + name, 'heart', 18, { 'aria-pressed': st.v[vk] ? 'true' : 'false' })
              : h.el('button', { class: 'k-rows-sw', type: 'button', role: 'switch', disabled: d, 'aria-checked': st.v[vk] ? 'true' : 'false', 'aria-label': name }, h.el('span'));
            b.addEventListener('click', function () { st.v[vk] = !st.v[vk]; b.setAttribute(tg ? 'aria-pressed' : 'aria-checked', st.v[vk] ? 'true' : 'false'); fire(!!st.v[vk]); });
            return b;
          }
          if (kind === 'play') {
            r.pb = ib('k-rows-ib', 'Play: ' + name, 'play', 18);
            r.pb.addEventListener('click', function () { st.play = st.play === k ? null : k; paint(); cb('onAction', c.onAction, it, 'play'); });
            return r.pb;
          }
          if (kind === 'stepper') {
            var lo = typeof t.min === 'number' ? t.min : 0, hi = typeof t.max === 'number' ? t.max : 99, num = h.el('span', { class: 'k-rows-q k-b-num', 'aria-live': 'polite' });
            var m1 = ib('k-rows-ib', 'Decrease quantity: ' + name, 'minus', 16), p1 = ib('k-rows-ib', 'Increase quantity: ' + name, 'plus', 16);
            var set = function (n, go) { st.v[vk] = n; num.textContent = n; m1.disabled = dis || n <= lo; p1.disabled = dis || n >= hi; if (go) fire(n); };
            m1.addEventListener('click', function () { set(Math.max(lo, (+st.v[vk] || 0) - 1), 1); });
            p1.addEventListener('click', function () { set(Math.min(hi, (+st.v[vk] || 0) + 1), 1); });
            set(+st.v[vk] || lo, 0);
            return h.el('span', { class: 'k-rows-st', role: 'group', 'aria-label': 'Quantity: ' + name }, [m1, num, p1]);
          }
          if (kind === 'button' && has(t.label)) {
            var id = t.id != null ? String(t.id) : String(t.label);
            var bt = t.icon ? ib('k-rows-ib', t.label + ': ' + name, t.icon, 18) : h.el('button', { class: 'k-b-btn', type: 'button', disabled: d, 'aria-label': t.label + ': ' + name }, String(t.label));
            bt.addEventListener('click', function () { cb('onAction', c.onAction, it, id); });
            return bt;
          }
          if (kind === 'text' && has(t.text)) return h.el('span', { class: 'k-rows-tx k-b-nw', text: String(t.text) });
          return kind === 'chevron' ? h.el('span', { class: 'k-rows-chev', 'aria-hidden': 'true' }) : null;
        });
        var cell = function (cls, v) { return has(v) ? h.el('span', { class: cls + ' k-b-nw', text: String(v) }) : null; };
        r.li = h.el('li', { class: 'k-rows-row', id: it.id != null ? String(it.id) : null, 'data-disabled': dis ? 'true' : null }, [
          r.ix, lead,
          h.el('div', { class: 'k-rows-text' }, [h.el('div', { class: 'k-rows-tl' }, [c.numbered ? null : r.eq, main, r.sr]), has(it.sub) ? h.line(it.sub, { class: 'k-rows-s' }) : null]),
          has(it.meta) ? h.line(it.meta, { class: 'k-rows-m' }) : null,
          has(it.status) ? h.el('span', { class: 'k-b-pill k-s-' + h.statusKind(it.status), text: String(it.status) }) : null,
          cell('k-rows-bd', it.badge), cell('k-rows-v', typeof it.value === 'number' ? h.num(it.value) : it.value),
          cell('k-rows-d', typeof it.duration === 'number' ? M.clock(it.duration) : it.duration), cell('k-rows-d', has(it.time) ? h.when(it.time) : null),
          typeof it.unread === 'number' && it.unread > 0 ? h.el('span', { class: 'k-rows-un k-b-num', 'aria-label': it.unread + ' unread', text: M.count(it.unread) }) : null,
          tr.length ? h.el('div', { class: 'k-rows-tr' }, tr) : null]);
        rows.push(r);
        ul.appendChild(r.li);
      });
      ul.addEventListener('keydown', function (e) {
        var l = rows.map(function (r) { return r.main; }).filter(function (m) { return m.tagName !== 'DIV' && m.getAttribute('aria-disabled') !== 'true'; }), i = l.indexOf(document.activeElement);
        var to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: l.length - 1 }[e.key];
        if (i < 0 || to == null) return;
        e.preventDefault(); l[Math.max(0, Math.min(l.length - 1, to))].focus();
      });
      paint();
      el.appendChild(ul);
      if (h.fill === 'grow') h.fit(h.padFit(ul, 28));
    }
  });
})();
