/* @block posts 1.0 -- Post feed: photo, video, text and blog cards with author, media, counts and like / comment / share / save.
 * Use for: social and community feeds, photo grids, short-video cards, creator pages, blog or news cards with engagement.
 * Pick: Feed or grid of post cards (author, media, text, like/comment/share/save); pick for social, photo, video and blog feeds.
 * Load: blocks.css, media.lib.css, posts.css, core.js, media.lib.js, posts.js
 * Call: K.block.posts('#a-posts', {items: [{id: 'p1', author: {name: 'Marta Silva', handle: '@marta'}, time: '2 h', text: 'Sunrise at the pier #harbour', media: {glyph: '\u2600', ratio: '4/5'}, likes: 1280}]})
 * Config:
 *   items    array, required  [{id?, author, time?, text?, media?, location?, tags?, likes?, comments?, shares?, views?, liked?, saved?, href?, menu?}]
 *     author   object, required  {name, handle?, src?, key?, verified?}; src (data URI or file) falls back to initials
 *     time     time    text as given ("2 h"), ISO string, ms or Date
 *     text     text    cut at `clamp` lines + "more"; #tags and @mentions are accent text, not links
 *     media    object  {src?, glyph?, key?, ratio?, alt?, count?, duration?}; ratio 1/1|4/5|16/9; no src = tint + glyph; count > 1 = "1/3" badge + dots; duration = seconds or text
 *     likes, comments, shares, views  number|text  as given, numbers compacted (1.2K)
 *     liked, saved  boolean  start state; href  media link; menu  [{label, onClick?(item)}] "more" button; location  text; tags  [string]
 *   layout   'feed'|'grid', default 'feed'  feed: one card per post, max 36 rem, centred; grid: media-first cards
 *   clamp    number, default 3;  labels  object  texts {like, comment, share, save, more, less, menu, verified, open, views, posts}
 *   onLike(item, liked), onSave(item, saved)  toggle locally AND call; a numeric like count moves by exactly 1 from the given value, a text count never changes
 *   onComment(item), onShare(item), onOpen(item) (media), onAuthor(item) (author becomes a button)
 *   (common) title (list name), state, emptyText, errorText, frame (default false)
 * States: empty, loading, error, bad config. Action labels show from 360 px card width, icons under. Escape closes the menu.
 */
(function () {
  'use strict';
  var K = window.K, M = K && K.media;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] posts: load core.js before posts.js'); return; }
  if (!M) { console.warn('[K.block] posts: load media.lib.js before posts.js'); return; }
  var isA = Array.isArray, ISO = /^\d{4}-\d\d-\d\d[T ]/, warnedCb = {};
  var DEF = { like: 'Like', comment: 'Comment', share: 'Share', save: 'Save', more: 'more', less: 'less', menu: 'More actions', verified: 'Verified', open: 'Open post', views: 'views', posts: 'Posts' };
  var cb = function (name, fn, a, b) {
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (e) {
      var m = '[K.block] posts: ' + name + ' threw: ' + String((e && e.message) || e).slice(0, 120);
      if (!warnedCb[m]) { warnedCb[m] = 1; console.warn(m); }
    }
  };
  K.block.define('posts', {
    version: '1.0',
    frame: false,
    resize: true,
    emptyText: 'No posts yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, author: { type: 'object', required: true }, time: { type: 'time' }, text: { type: 'text' }, media: { type: 'object' }, location: { type: 'text' }, tags: { type: 'array' },
        likes: { type: 'text' }, comments: { type: 'text' }, shares: { type: 'text' }, views: { type: 'text' }, liked: { type: 'boolean' }, saved: { type: 'boolean' }, href: { type: 'text' }, menu: { type: 'array' } } },
      layout: { type: 'string', enum: ['feed', 'grid'], default: 'feed' }, clamp: { type: 'number', default: 3 }, labels: { type: 'object' },
      onLike: { type: 'function' }, onSave: { type: 'function' }, onComment: { type: 'function' }, onShare: { type: 'function' }, onOpen: { type: 'function' }, onAuthor: { type: 'function' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var E = h.el;
      var L = Object.assign({}, DEF, c.labels || {}), grid = c.layout === 'grid', measure = [];
      var S = el._kBlock && el._kPst ? el._kPst : (el._kPst = {});
      var cnt = function (v) { return v == null || v === '' ? '' : M.count(v); };
      var st = function (it, id) {
        var s = S[id], l = !!it.liked, v = !!it.saved;
        return s && s.l0 === l && s.s0 === v ? s : (S[id] = { l0: l, s0: v, liked: l, saved: v, open: false });
      };
      var rich = function (t) {
        var out = [];
        String(t).split(/((?<![\p{L}\p{N}_])[#@][\p{L}\p{N}_]+)/u).forEach(function (p, i) {
          if (!p) return;
          if (i % 2) out.push(E('span', { class: 'k-pst-hl', text: p })); else h.rich(p).forEach(function (x) { out.push(x); });
        });
        return out;
      };
      var when = function (it) {
        var v = it.time;
        if (v == null || v === '') return null;
        var ms = it.time$ms != null ? it.time$ms : typeof v === 'number' || ISO.test(v) ? +new Date(v) : NaN, ok = isFinite(ms);
        return E('time', { class: 'k-pst-time k-b-nw', datetime: ok ? new Date(ms).toISOString() : null }, it.time$ms == null && ok ? h.when(new Date(ms)) : String(v));
      };

      var header = function (it, nm) {
        var a = it.author, who = [M.avatar(h, { name: nm, src: a.src, key: a.key, size: 'md' }), E('span', { class: 'k-pst-who' }, [
          E('span', { class: 'k-pst-name' }, [h.line(nm), a.verified ? E('span', { class: 'k-pst-ver', role: 'img', 'aria-label': L.verified, title: L.verified }, M.icon(h, 'check', { size: 10 })) : null]),
          E('span', { class: 'k-pst-sub' }, [a.handle ? h.line(a.handle, { class: 'k-pst-handle' }) : null, a.handle && it.time != null && it.time !== '' ? E('span', { class: 'k-pst-sep', 'aria-hidden': 'true', text: '\u00b7' }) : null, when(it)])])];
        var left = typeof c.onAuthor === 'function'
          ? E('button', { class: 'k-pst-author', type: 'button', 'aria-label': nm, on: { click: function () { cb('onAuthor', c.onAuthor, it); } } }, who)
          : E('div', { class: 'k-pst-author' }, who);
        return E('div', { class: 'k-pst-head' }, [left, menu(it)]);
      };
      var cur = null, menu = function (it) {
        if (!isA(it.menu) || !it.menu.length) return null;
        var id = h.uid('pm'), ul = E('ul', { class: 'k-pst-menu', id: id, hidden: true });
        var btn = E('button', { class: 'k-pst-ic', type: 'button', 'aria-label': L.menu, 'aria-expanded': 'false', 'aria-controls': id }, M.icon(h, 'more'));
        var wrap = E('div', { class: 'k-pst-menuw' }, [btn, ul]);
        var close = function (f) { ul.hidden = true; btn.setAttribute('aria-expanded', 'false'); wrap.closest('.k-pst-card').classList.remove('k-pst-mo'); cur = null; if (f === true) btn.focus(); };
        close.w = wrap;
        it.menu.forEach(function (a) {
          a = a && typeof a === 'object' ? a : {};
          ul.appendChild(E('li', null, E('button', { class: 'k-pst-mi', type: 'button', text: a.label != null ? a.label : '\u2014', on: { click: function () { close(true); cb('menu', a.onClick, it); } } })));
        });
        btn.addEventListener('click', function () {
          var was = !ul.hidden;
          if (cur) cur();
          if (was) return;
          ul.hidden = false; btn.setAttribute('aria-expanded', 'true'); wrap.closest('.k-pst-card').classList.add('k-pst-mo'); cur = close;
          ul.querySelector('button').focus();
        });
        wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur === close) { e.stopPropagation(); close(true); } });
        return wrap;
      };

      var media = function (it, nm, i, id) {
        var m = it.media;
        if (!m || typeof m !== 'object') return null;
        var n = m.count > 1 ? Math.min(99, Math.floor(m.count)) : 0, ratio = /^(1\/1|4\/5|16\/9)$/.test(m.ratio) ? m.ratio : '1/1';
        var cv = M.cover(h, { title: nm, src: m.src, alt: '', key: m.key != null ? m.key : id, ratio: ratio, glyph: m.glyph, badge: n ? '1/' + n : null, duration: m.duration });
        cv.insertBefore(E('span', { class: 'k-pst-ph', 'aria-hidden': 'true' }), cv.firstChild);
        if (m.alt) { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', String(m.alt)); }
        if (!m.glyph) { var g = cv.querySelector('.k-m-glyph'); g.textContent = ''; g.appendChild(M.icon(h, m.duration != null && m.duration !== '' ? 'play' : 'image', { size: 40 })); }
        var wrap = it.href ? E('a', { class: 'k-pst-media', href: it.href }) : typeof c.onOpen === 'function' ? E('button', { class: 'k-pst-media', type: 'button' }) : E('div', { class: 'k-pst-media' });
        if (wrap.tagName !== 'DIV') {
          wrap.setAttribute('aria-label', L.open + (m.alt ? ': ' + m.alt : ''));
          wrap.addEventListener('click', function () { cb('onOpen', c.onOpen, it); });
        }
        wrap.appendChild(cv);
        if (!n) return wrap;
        var dots = E('div', { class: 'k-pst-dots', 'aria-hidden': 'true' });
        for (var k = 0; k < Math.min(n, 8); k++) dots.appendChild(E('i', { class: k ? null : 'k-on' }));
        return [wrap, dots];
      };

      var actions = function (it, s) {
        var row = E('div', { class: 'k-pst-acts' });
        var mk = function (kind, icon, val, toggle, cbName, key) {
          var n = E('span', { class: 'k-pst-n k-b-nw' }), b = E('button', { class: 'k-pst-act k-pst-' + kind, type: 'button' }, [M.icon(h, icon, { size: 18 }), E('span', { class: 'k-pst-lb', text: L[kind] }), n]);
          var paint = function () {
            var on = toggle && s[key], t = kind === 'like' && typeof val === 'number' ? M.count(Math.max(0, val + (s.liked === s.l0 ? 0 : s.liked ? 1 : -1))) : cnt(val);
            n.textContent = t;
            b.setAttribute('aria-label', L[kind] + (t ? ' ' + t : ''));
            if (toggle) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('k-pst-on', !!on); }
          };
          b.addEventListener('click', function () {
            if (toggle) { s[key] = !s[key]; paint(); cb(cbName, c[cbName], it, s[key]); } else cb(cbName, c[cbName], it);
          });
          paint();
          row.appendChild(b);
        };
        mk('like', 'heart', it.likes, true, 'onLike', 'liked');
        mk('comment', 'comment', it.comments, false, 'onComment');
        mk('share', 'share', it.shares, false, 'onShare');
        mk('save', 'bookmark', null, true, 'onSave', 'saved');
        return row;
      };

      var body = function (it, s, hasMedia) {
        var kids = [], tags = isA(it.tags) ? it.tags.filter(function (t) { return t != null && t !== ''; }) : [];
        if (it.text != null && it.text !== '') {
          var id = h.uid('pt'), p = E('p', { class: 'k-pst-text' + (hasMedia || grid ? '' : ' k-pst-big') + (s.open ? ' k-pst-open' : ''), id: id }, E('span', null, rich(it.text)));
          var more = E('button', { class: 'k-pst-more', type: 'button', 'aria-controls': id, 'aria-expanded': s.open ? 'true' : 'false', text: s.open ? L.less : L.more, hidden: !s.open });
          more.addEventListener('click', function () { s.open = !s.open; p.classList.toggle('k-pst-open', s.open); more.setAttribute('aria-expanded', s.open ? 'true' : 'false'); more.textContent = s.open ? L.less : L.more; });
          measure.push(function () { if (s.open || p.scrollHeight > p.clientHeight + 1) more.hidden = false; });
          kids.push(p, more);
        }
        if (tags.length) kids.push(E('p', { class: 'k-pst-tags' }, tags.map(function (t) { t = String(t); return E('span', { class: 'k-pst-hl k-b-nw k-b-tok-x', text: t.charAt(0) === '#' ? t : '#' + t }); })));
        var vw = cnt(it.views), lc = it.location != null && it.location !== '';
        if (vw || lc) kids.push(E('div', { class: 'k-pst-meta' }, [vw ? E('span', { class: 'k-pst-views k-b-nw', text: vw + ' ' + L.views }) : null, lc ? h.line(it.location, { class: 'k-pst-loc' }) : null]));
        return kids.length ? E('div', { class: 'k-pst-body' }, kids) : null;
      };

      var list = E('ul', { class: 'k-pst-list k-pst-' + (grid ? 'grid' : 'feed'), 'aria-label': c.title != null ? String(c.title) : L.posts, style: { '--k-pst-clamp': Math.max(1, c.clamp | 0 || 3) } });
      c.items.forEach(function (it, i) {
        var a = it.author, nm = a.name != null && a.name !== '' ? String(a.name) : '\u2014', id = it.id != null ? String(it.id) : '#' + i, s = st(it, id);
        var md = media(it, nm, i, id), hd = header(it, nm), bd = body(it, s, !!md), ac = actions(it, s);
        var parts = grid ? [md, hd, bd, ac] : md ? [hd, md, ac, bd] : [hd, bd, ac];
        var card = E('article', { class: 'k-pst-card' });
        parts.forEach(function (x) { [].concat(x).forEach(function (y) { if (y) card.appendChild(y); }); });
        list.appendChild(E('li', null, card));
      });
      el.appendChild(list);
      var off = function (e) { if (cur && !cur.w.contains(e.target)) cur(); };
      document.addEventListener('click', off);
      h.cleanup(function () { document.removeEventListener('click', off); });
      measure.forEach(function (f) { f(); });
    }
  });
})();
