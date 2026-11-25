/* @block comments 1.0 -- Comment thread: replies, likes, badges, ratings, sort, composer and "show more".
 * Use for: video and post comments, product reviews, ticket and discussion threads, article replies, support conversations.
 * Pick: Threaded comments or reviews with replies, likes, composer and sort; pick for video, post, product and ticket threads.
 * Load: blocks.css, media.lib.css, comments.css, core.js, media.lib.js, comments.js
 * Call: K.block.comments('#a-comments', {total: 1284, composer: {placeholder: 'Add a comment', submitLabel: 'Post'}, items: [{id: 'c1', author: {name: 'Dev Nair'}, text: 'Great walk-through', time: '2 h', likes: 42, replies: [{id: 'c2', author: {name: 'Marta Silva'}, text: 'Thanks!'}]}]})
 * Config:
 *   items    array, required  [{id?, author, text, time?, likes?, liked?, badge?, edited?, rating?, replies?}], in the given order (never sorted by the block)
 *     author   object, required  {name, src?, key?}; src falls back to initials
 *     time     time    text as given ("2 h"), ISO string, ms or Date; badge  text ("Author", "Pinned"); edited  boolean
 *     likes    number|text  as given, numbers compacted; liked  boolean  start state. Like toggles locally AND calls onLike; a numeric count moves by exactly 1
 *     rating   number  0-5 stars for reviews; the block shows no averages;  replies  array  same shape, behind "View N replies"
 *   total    number|text  printed as given in the heading ("Comments \u00b7 1,284"), never computed;  label  text, default 'Comments'
 *   sort     object  {value, options: [{value, label}]}  native select, calls onSort(value); the app passes the items in the new order
 *   composer object  {placeholder?, submitLabel?, avatar?: {name, src?}}  textarea on top; submit adds a local comment at the top (author = avatar name) and calls onSubmit(text, parentId?)
 *            Reply opens an inline composer ("Replying to Name", Cancel). Ctrl+Enter sends, Escape cancels
 *   maxDepth number, default 2  reply levels; deeper replies are flattened under their level-maxDepth comment with a "Replying to" hint
 *   collapseReplies boolean, default true;  limit  number  top-level comments shown first, "Show more comments" adds that many and calls onMore(shown);  hasMore  boolean  keeps the button
 *   labels   object  texts {like, reply, cancel, hide, view ('View {n} replies'), view1, more, edited, replyingTo, write, sort, now, posted, you, submit}
 *   onLike(item, liked), onReply(item), onSubmit(text, parentId?), onSort(value), onMore(shown)
 *   (common) title, state, emptyText, errorText, frame (default false), headingLevel (the heading is one level lower)
 * States: empty (heading, composer, empty text), loading, error, bad config.
 */
(function () {
  'use strict';
  var K = window.K, M = K && K.media;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] comments: load core.js before comments.js'); return; }
  if (!M) { console.warn('[K.block] comments: load media.lib.js before comments.js'); return; }
  var isA = Array.isArray, ISO = /^\d{4}-\d\d-\d\d[T ]/, warnedCb = {};
  var DEF = { like: 'Like', reply: 'Reply', cancel: 'Cancel', hide: 'Hide replies', view: 'View {n} replies', view1: 'View 1 reply', more: 'Show more comments', edited: '(edited)', replyingTo: 'Replying to', write: 'Add a comment', sort: 'Sort comments', now: 'Just now', posted: 'Comment posted', you: 'You', submit: 'Post' };
  var cb = function (name, fn, a, b) {
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (e) {
      var m = '[K.block] comments: ' + name + ' threw: ' + String((e && e.message) || e).slice(0, 120);
      if (!warnedCb[m]) { warnedCb[m] = 1; console.warn(m); }
    }
  };
  K.block.define('comments', {
    version: '1.0',
    frame: false,
    emptyText: 'No comments yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, author: { type: 'object', required: true }, text: { type: 'text', required: true }, time: { type: 'time' }, likes: { type: 'text' }, liked: { type: 'boolean' },
        badge: { type: 'text' }, edited: { type: 'boolean' }, rating: { type: 'number' }, replies: { type: 'array' } } },
      total: { type: 'text' }, label: { type: 'text', default: 'Comments' }, sort: { type: 'object' }, composer: { type: 'object' }, labels: { type: 'object' },
      maxDepth: { type: 'number', default: 2 }, collapseReplies: { type: 'boolean', default: true }, limit: { type: 'number' }, hasMore: { type: 'boolean' },
      onLike: { type: 'function' }, onReply: { type: 'function' }, onSubmit: { type: 'function' }, onSort: { type: 'function' }, onMore: { type: 'function' }
    },
    render: function (el, c, h) {
      var E = h.el;
      var L = Object.assign({}, DEF, c.labels || {}), maxD = Math.max(1, c.maxDepth | 0 || 2), lim = c.limit > 0 ? c.limit | 0 : 0, cfg = c.composer;
      var S = el._kBlock && el._kCmt ? el._kCmt : (el._kCmt = { top: [], loc: {}, lk: {}, open: {}, dr: {}, n: 0, reply: null, shown: null, sort: null, focus: null, say: '' });
      var act = function (key, fn) { S.focus = key; fn(); h.rerender(); };
      var when = function (it) {
        var v = it.time;
        if (v == null || v === '') return null;
        var ms = it.time$ms != null ? it.time$ms : typeof v === 'number' ? v : typeof v === 'string' && ISO.test(v) ? Date.parse(v) : NaN, ok = isFinite(ms);
        return E('time', { class: 'k-cmt-time k-b-nw', datetime: ok ? new Date(ms).toISOString() : null }, it.time$ms == null && ok ? h.when(new Date(ms)) : String(v));
      };
      // nodes: {it, id, nm, d, kids}; deeper than maxD are flattened under the level-maxD comment
      var norm = function (list, pre, d) {
        return list.map(function (it, i) {
          if (!it || typeof it !== 'object' || isA(it) || !it.author || typeof it.author !== 'object') { h.warn('a reply must be an object with an author, skipped', 'reply'); return null; }
          var id = it.id != null ? String(it.id) : pre + i, nm = it.author.name != null && it.author.name !== '' ? String(it.author.name) : '\u2014';
          return { it: it, id: id, nm: nm, d: d, kids: norm((isA(it.replies) ? it.replies : []).concat(S.loc[id] || []), id + '.', d + 1) };
        }).filter(Boolean);
      };
      var cap = function (n) {
        if (n.d < maxD) { n.kids.forEach(cap); return; }
        var f = [];
        (function g(p) { p.kids.forEach(function (k) { if (p !== n) k.re = p.nm; f.push(k); g(k); }); })(n);
        f.forEach(function (k) { k.kids = []; });
        n.kids = f;
      };
      var form = function (key, n) {
        var uid = h.uid('cmt'), av = cfg.avatar || {}, nm = av.name != null && av.name !== '' ? String(av.name) : L.you, ph = cfg.placeholder != null ? String(cfg.placeholder) : L.write;
        var ta = E('textarea', { class: 'k-cmt-ta', id: uid, rows: 2, placeholder: n ? null : ph, 'aria-label': n ? null : ph, 'data-k': 'ta:' + key });
        var go = E('button', { class: 'k-b-btn k-b-btn-primary k-cmt-go', type: 'submit', text: cfg.submitLabel != null ? cfg.submitLabel : L.submit });
        var fm = E('form', { class: 'k-cmt-form', novalidate: true }, [
          n ? E('label', { class: 'k-cmt-lbl', for: uid, text: L.replyingTo + ' ' + n.nm }) : null, ta,
          E('div', { class: 'k-cmt-fa' }, [n ? E('button', { class: 'k-b-btn', type: 'button', text: L.cancel, on: { click: function () { delete S.dr[key]; act('rp:' + key, function () { S.reply = null; }); } } }) : null, go])]);
        ta.value = S.dr[key] || '';
        go.disabled = !ta.value.trim();
        ta.addEventListener('input', function () { S.dr[key] = ta.value; go.disabled = !ta.value.trim(); });
        ta.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !go.disabled) { e.preventDefault(); fm.requestSubmit(); }
          else if (e.key === 'Escape' && n) { e.stopPropagation(); delete S.dr[key]; act('rp:' + key, function () { S.reply = null; }); }
        });
        fm.addEventListener('submit', function (e) {
          e.preventDefault();
          var t = ta.value.trim();
          if (!t) return;
          var it = { id: 'local-' + (++S.n), author: { name: nm, src: av.src, key: av.key }, text: t, time: L.now };
          delete S.dr[key];
          act(n ? 'rp:' + key : 'ta:top', function () {
            if (n) { (S.loc[n.id] = S.loc[n.id] || []).push(it); S.open[n.id] = true; S.reply = null; } else S.top.unshift(it);
            S.say = L.posted;
          });
          cb('onSubmit', c.onSubmit, t, n ? (n.it.id != null ? n.it.id : n.id) : undefined);
        });
        return E('div', { class: 'k-cmt-comp' + (n ? ' k-cmt-comp-in' : '') }, [M.avatar(h, { name: nm, src: av.src, key: av.key, size: n ? 'sm' : 'md' }), fm]);
      };
      var node = function (n) {
        var it = n.it, a = it.author, id = n.id, lk = S.lk[id], on = lk && lk.from === !!it.liked ? lk.now : !!it.liked, sm = n.d > 1, tx = [];
        var li = E('li', { class: 'k-cmt-i' + (sm ? ' k-cmt-sm' : ''), tabindex: '-1', 'data-k': 'c:' + id });
        var bd = E('div', { class: 'k-cmt-b' }, [
          E('div', { class: 'k-cmt-hd' }, [h.line(n.nm, { class: 'k-cmt-nm' }), it.badge != null && it.badge !== '' ? E('span', { class: 'k-cmt-bdg', text: it.badge }) : null, when(it), it.edited ? E('span', { class: 'k-cmt-ed', text: L.edited }) : null]),
          n.re ? E('p', { class: 'k-cmt-re', text: L.replyingTo + ' ' + n.re }) : null,
          typeof it.rating === 'number' ? E('div', { class: 'k-cmt-rt' }, M.stars(h, it.rating)) : null,
          E('p', { class: 'k-cmt-tx' }, h.rich(it.text))]);
        if (typeof c.onLike === 'function' || it.likes != null || it.liked) {
          var cn = typeof it.likes === 'number' ? M.count(Math.max(0, it.likes + (on === !!it.liked ? 0 : on ? 1 : -1))) : it.likes != null && it.likes !== '' ? M.count(it.likes) : '';
          tx.push(E('button', { class: 'k-cmt-ac' + (on ? ' k-cmt-on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': L.like + (cn ? ' ' + cn : ''), 'data-k': 'lk:' + id,
            on: { click: function () { act('lk:' + id, function () { S.lk[id] = { from: !!it.liked, now: !on }; }); cb('onLike', c.onLike, it, !on); } } },
          [M.icon(h, 'heart', { size: 16 }), E('span', { class: 'k-cmt-n k-b-nw', text: cn })]));
        }
        if (cfg || typeof c.onReply === 'function') {
          var open = S.reply === id;
          tx.push(E('button', { class: 'k-cmt-ac', type: 'button', text: L.reply, 'aria-expanded': cfg ? (open ? 'true' : 'false') : null, 'data-k': 'rp:' + id,
            on: { click: function () { cb('onReply', c.onReply, it); if (cfg) act(open ? 'rp:' + id : 'ta:' + id, function () { S.reply = open ? null : id; }); } } }));
        }
        if (tx.length) bd.appendChild(E('div', { class: 'k-cmt-as' }, tx));
        if (cfg && S.reply === id) bd.appendChild(form(id, n));
        if (n.kids.length) {
          var shown = !c.collapseReplies || S.open[id], rid = h.uid('rep'), cnt = n.kids.length;
          if (c.collapseReplies) bd.appendChild(E('button', { class: 'k-cmt-tg' + (shown ? ' k-cmt-tg-on' : ''), type: 'button', 'aria-expanded': shown ? 'true' : 'false', 'aria-controls': rid, 'data-k': 'tg:' + id,
            text: shown ? L.hide : cnt === 1 ? L.view1 : L.view.replace('{n}', cnt), on: { click: function () { act('tg:' + id, function () { S.open[id] = !shown; }); } } }));
          bd.appendChild(E('ul', { class: 'k-cmt-rep' + (n.d >= maxD && n.d > 1 ? ' k-cmt-flat' : ''), id: rid, hidden: !shown }, n.kids.map(node)));
        }
        li.appendChild(M.avatar(h, { name: n.nm, src: a.src, key: a.key, size: sm ? 'sm' : 'md' }));
        li.appendChild(bd);
        return li;
      };

      var nodes = norm(S.top, '', 1).concat(norm(c.items, 'n', 1));
      nodes.forEach(cap);
      var shownN = lim ? Math.min(nodes.length, Math.max(lim, S.shown || 0) + S.top.length) : nodes.length;
      var hid = h.uid('ch'), lv = Math.min(6, (c.headingLevel | 0 || 2) + 1), sv = S.sort != null ? S.sort : c.sort && c.sort.value;
      var live = E('div', { class: 'k-cmt-live', role: 'status' });
      var top = [E('h' + lv, { class: 'k-cmt-h', id: hid }, c.label + (c.total != null && c.total !== '' ? ' \u00b7 ' + h.num(c.total) : ''))];
      if (c.sort && isA(c.sort.options) && c.sort.options.length) {
        top.push(E('select', { class: 'k-cmt-sort', 'aria-label': L.sort, 'data-k': 'sort', on: { change: function (e) { var v = e.target.value; act('sort', function () { S.sort = v; }); cb('onSort', c.onSort, v); } } },
          c.sort.options.map(function (o) { o = o || {}; return E('option', { value: o.value, selected: String(o.value) === String(sv), text: o.label != null ? o.label : o.value }); })));
      }
      var root = E('div', { class: 'k-cmt-root' }, [E('div', { class: 'k-cmt-top' }, top), cfg ? form('top', null) : null, live]);
      if (nodes.length) {
        root.appendChild(E('ul', { class: 'k-cmt-list', 'aria-labelledby': hid }, nodes.slice(0, shownN).map(node)));
        if (shownN < nodes.length || c.hasMore) {
          root.appendChild(E('button', { class: 'k-b-btn k-cmt-more', type: 'button', text: L.more, 'data-k': 'more', on: { click: function () {
            var next = nodes[shownN] ? 'c:' + nodes[shownN].id : 'more', to = (S.shown || lim) + lim;
            act(next, function () { S.shown = to; });
            cb('onMore', c.onMore, Math.min(nodes.length, to));
          } } }));
        }
      } else root.appendChild(E('p', { class: 'k-cmt-empty', text: c.emptyText != null ? c.emptyText : 'No comments yet' }));
      el.appendChild(root);
      if (S.say) { var msg = S.say, t = setTimeout(function () { live.textContent = msg; }, 60); h.cleanup(function () { clearTimeout(t); }); S.say = ''; }
      if (S.focus) {
        var f = [].filter.call(el.querySelectorAll('[data-k]'), function (x) { return x.getAttribute('data-k') === S.focus; })[0];
        S.focus = null;
        if (f) f.focus();
      }
    }
  });
})();
