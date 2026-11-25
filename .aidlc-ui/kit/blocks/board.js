/* @block board 1.0 -- Status board: cards or compact rows, grouped by depot, stage or hour; each card is as tall as its content.
 * Use for: van cards by depot; "Stages right now" rows; hourly weather strip.
 * Pick: Cards or rows of items with a status, grouped (vehicles by depot, stages right now, hourly strip).
 * Load: blocks.css, core.js, board.css, board.js
 * Call: K.block.board('#a-vans', {groups: [{title: 'Trafford', items: [{title: 'BW-01', status: 'Ready', fields: [{label: 'Departs', value: '06:30'}]}]}]})
 * Config:
 *   groups    array             [{title?, subtitle?, items[]}] (depots, days); or items[] alone for one untitled group
 *   items     array             [{id?, title, subtitle?, status?, tone?, hero?, fields?, progress?, href?, selected?}]
 *     hero    {value, unit?, caption?, tone?}  big number under the title (cards only): value large, unit small beside it, caption muted beneath (may wrap)
 *     status  text              pill; Ready -> ok, At risk -> warn; tone overrides
 *     fields  array             [{label, value, tone?, strong?}] rows; a label most cards have keeps its slot (dash); the label is never cut: a long value wraps (2 lines) or sits under the label
 *     progress {value, max=100, label?, text?, target?, tone?}  bar; text as given; target = tick; the label keeps its full width, a long text wraps to more lines at the right
 *   layout    'cards'|'rows', default 'cards'  rows: columns = field labels (3 under 720 px); a progress label all rows share is the column header, not repeated
 *   minCard   number, default 260  wanted card width in px;  columns  number  most cards per row, default: the size of the biggest group up to 4 (3 wards per block = 3 columns, no empty quarter);  compact  boolean  strip cards
 *             A column count is used when its cards stay at 90 % of minCard or more (2 x 260 fits 526 px); otherwise fewer columns, one column fills the width. Never overflows.
 *             A short last row (11 cards in 2 columns, 7 in 4) is shared out: its cards span the full width, so none sits beside an empty half row.
 *   pill      'right'|'below', default 'below'  rows only: 'right' makes the status its own column at the right end, level with the title (2-line rows)
 *   sort      'severity'|'none', default 'none'  severity: exceptions first inside each group
 *   summary   'exceptions'|'all'|'none', default 'exceptions'  group header counts warn/crit statuses ('all': the rest, muted)
 *   fill      true|'scroll'    (common) in a row of cards: grow the cards' padding so the block ends with the row (no void under it)
 *   limit     number, default 60   items shown first, "Show more" adds as many;  onSelect  function(item)  cards are buttons
 *   (common)  title, subtitle, actions, state, emptyText, frame, headingLevel;  states: empty, loading, error, bad config
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] board: load core.js before board.js'); return; }
  var TONES = ['ok', 'warn', 'crit', 'info', 'neutral'], has = function (v) { return v != null && v !== ''; };
  var groupsOf = function (c) {
    var ok = function (x) { return x && typeof x === 'object'; }, g = (c.groups || []).filter(function (x) { return ok(x) && Array.isArray(x.items); });
    return c.items && c.items.length ? g.concat([{ items: c.items.filter(ok) }]) : g;
  };
  K.block.define('board', {
    fill: true,
    version: '1.0',
    frame: true,
    resize: true,
    emptyText: 'Nothing to show',
    schema: {
      pill: { type: 'string', enum: ['right', 'below'], default: 'below' },
      groups: { type: 'array', of: { title: { type: 'text' }, subtitle: { type: 'text' }, items: { type: 'array', required: true } } },
      items: { type: 'array' },
      layout: { type: 'string', enum: ['cards', 'rows'], default: 'cards' },
      minCard: { type: 'number', default: 260 }, columns: { type: 'number' },
      compact: { type: 'boolean', default: false }, sort: { type: 'string', enum: ['severity', 'none'], default: 'none' }, summary: { type: 'string', enum: ['exceptions', 'all', 'none'], default: 'exceptions' }, limit: { type: 'number', default: 60 }, onSelect: { type: 'function' }
    },
    empty: function (c) { return !groupsOf(c).some(function (g) { return g.items.length; }); },
    render: function (el, c, h) {
      var w = el.clientWidth || 800, rows = c.layout === 'rows', lvl = Math.min(6, Math.max(2, c.headingLevel | 0) + 1), step = Math.max(1, c.limit | 0), cap = step, shown = 0, more = null;
      var kindOf = function (o, word) { return TONES.indexOf(o.tone) >= 0 ? o.tone : has(word) ? h.statusKind(word) : ''; };
      var pill = function (word, k) { return h.el('span', { class: 'k-b-pill k-s-' + (k || 'neutral'), title: String(word) }, [h.el('span', { text: word })]); };
      var fieldsOf = function (it) { return (it.fields || []).filter(function (f) { return f && f.label != null; }); };
      var val = function (f, tag) {
        return h.el(tag || 'dd', { class: 'k-board-v' + (TONES.indexOf(f.tone) >= 0 ? ' k-s-' + f.tone + ' k-board-vt' : '') + (f.strong ? ' k-board-strong' : ''), title: has(f.value) ? f.value : null },
          has(f.value) ? h.rich(f.value) : [h.el('span', { class: 'k-b-faint', text: '\u2014' })]);
      };
      var dl = function (fs, cls) {
        return h.el('dl', { class: 'k-board-f' + (cls || '') }, fs.map(function (x) {
          return h.el('div', { class: 'k-board-r' + (String(has(x.value) ? x.value : '').length > 28 ? ' k-board-rl' : '') }, [h.el('dt', { text: String(x.label) }), val(x)]);
        }));
      };
      var bar = function (p, k, bare) {
        var max = p.max > 0 ? +p.max : 100, n = +p.value || 0, v = Math.max(0, Math.min(max, n)), t = has(p.text) ? String(p.text) : max === 100 ? h.num(n) + '\u00a0%' : h.num(n) + ' / ' + h.num(max);
        return h.el('div', { class: 'k-board-p' }, [
          h.el('div', { class: 'k-board-pt' }, [has(p.label) && !bare ? h.line(p.label, { class: 'k-board-pl' }) : h.el('span'), h.el('span', { class: 'k-board-px', text: t })]),
          h.el('div', { class: 'k-board-bar k-s-' + (kindOf(p) || k || 'info'), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': max, 'aria-valuenow': v, 'aria-label': p.label || t }, [
            h.el('i', { style: { width: v / max * 100 + '%' } }), p.target >= 0 ? h.el('b', { style: { left: Math.min(max, +p.target) / max * 100 + '%' }, title: 'target ' + p.target }) : null])]);
      };
      var open = function (it, cls, kids, k) {
        var tag = it.href ? 'a' : c.onSelect ? 'button' : 'div';
        var n = h.el(tag, { class: cls + (k ? ' k-s-' + k : ''), href: it.href, type: tag === 'button' ? 'button' : null, id: has(it.id) ? it.id : null, 'aria-current': it.selected ? 'true' : null }, kids);
        if (tag === 'button') n.addEventListener('click', function () {
          [].forEach.call(el.querySelectorAll('[aria-current]'), function (x) { x.removeAttribute('aria-current'); });
          n.setAttribute('aria-current', 'true');
          try { c.onSelect(it); } catch (e) { console.warn('[K.block] board: onSelect failed: ' + e); }
        });
        return n;
      };
      var head = function (it, k) { return [h.line(it.title, { class: 'k-board-title' }), has(it.subtitle) ? h.line(it.subtitle, { class: 'k-board-sub' }) : null, has(it.status) ? pill(it.status, k) : null]; };
      var slotsOf = function (items) {
        var n = {}, order = [];
        items.forEach(function (it) { fieldsOf(it).map(function (f) { return String(f.label); }).filter(function (l, i, a) { return a.indexOf(l) === i; }).forEach(function (l) { n[l] = (n[l] || 0) + 1; if (n[l] === 1) order.push(l); }); });
        return items.length > 1 ? order.filter(function (l) { return n[l] * 2 >= items.length; }) : [];
      };
      var aligned = function (it, slots) {
        var f = fieldsOf(it), by = {};
        f.forEach(function (x) { if (!by[x.label]) by[x.label] = x; });
        return slots.map(function (l) { return by[l] || { label: l }; }).concat(f.filter(function (x) { return slots.indexOf(String(x.label)) < 0 || by[x.label] !== x; }));
      };
      var card = function (it, slots) {
        var k = kindOf(it, it.status), f = aligned(it, slots || []), hd = head(it, k);
        var hr = it.hero && typeof it.hero === 'object' && has(it.hero.value) ? it.hero : null;
        return open(it, 'k-board-card' + (c.compact ? ' k-board-compact' : ''), [h.el('span', { class: 'k-board-head' }, [hd[0], hd[2]]), hd[1],
          hr ? h.el('div', { class: 'k-board-hero' + (TONES.indexOf(hr.tone) >= 0 ? ' k-s-' + hr.tone : '') }, [h.el('span', { class: 'k-board-hv', text: String(hr.value) }), has(hr.unit) ? h.el('span', { class: 'k-board-hu', text: String(hr.unit) }) : null, has(hr.caption) ? h.el('span', { class: 'k-board-hc', text: String(hr.caption) }) : null]) : null,
          f.length ? dl(f) : null,
          it.progress && typeof it.progress === 'object' ? bar(it.progress, k) : null], k);
      };
      var plan = function (items) {
        var labels = [], hasP = items.some(function (it) { return it.progress; }), room = w < 400 ? 0 : (w < 720 ? 3 : 5) - 1 - (hasP ? 1 : 0);
        items.forEach(function (it) { fieldsOf(it).forEach(function (f) { if (labels.indexOf(String(f.label)) < 0) labels.push(String(f.label)); }); });
        var pill = c.pill === 'right' && w >= 400 && items.some(function (it) { return has(it.status); }), ff = '600 12px ' + getComputedStyle(el).fontFamily;
        var pls = items.filter(function (it) { return it.progress && has(it.progress.label); }).map(function (it) { return String(it.progress.label); }), same = pls.length > 0 && pls.every(function (l) { return l === pls[0]; });
        return { cols: labels.slice(0, Math.max(0, room)), hasP: hasP && w >= 400, pLabel: same && hasP && w >= 400 ? pls[0] : '', stacked: w < 400, pill: pill, pw: pill ? Math.ceil(Math.min(w * 0.3, Math.max.apply(null, items.map(function (it) { return has(it.status) ? h.measureText(String(it.status), ff) : 0; })) + 34)) : 0 };
      };
      var row = function (it, rc) {
        var k = kindOf(it, it.status), by = {}, f = fieldsOf(it);
        f.forEach(function (x) { if (!by[x.label]) by[x.label] = x; });
        var rest = f.filter(function (x) { return rc.cols.indexOf(String(x.label)) < 0; });
        var hd = head(it, k);
        return open(it, 'k-board-row', [h.el('span', { class: 'k-board-first' }, rc.pill ? hd.slice(0, 2) : hd)].concat(
          rc.cols.map(function (l) { return val(by[l] || {}, 'span'); }), rc.hasP ? [it.progress ? bar(it.progress, k, !!rc.pLabel) : h.el('span')] : [], rc.pill ? [h.el('span', { class: 'k-board-pc' }, [hd[2]])] : [], rest.length ? [dl(rest, ' k-board-rest')] : []), k);
      };
      var root = el.appendChild(h.el('div', { class: 'k-board' }));
      var big = Math.max.apply(null, [0].concat(groupsOf(c).map(function (g) { return g.items.length; }))), cmax = c.columns > 0 ? c.columns | 0 : big > 1 ? Math.min(4, big) : 4;   /* columns not set: no more columns than the biggest group has cards, so no empty quarter */
      var cols = Math.max(1, Math.min(cmax, Math.floor((w + 12) / (Math.max(96, c.minCard * 0.9) + 12))));
      var rank = function (k) { return k === 'crit' ? 0 : k === 'warn' ? 1 : k === 'info' ? 2 : k === 'ok' ? 3 : 4; };
      var gs = groupsOf(c).map(function (g) {
        var items = g.items.map(function (it) { return has(it.title) ? it : { title: has(it.id) ? it.id : 'Untitled' }; });
        if (c.sort === 'severity') items = items.slice().sort(function (a, b) { return rank(kindOf(a, a.status)) - rank(kindOf(b, b.status)); });
        return { g: g, items: items, pos: 0, rc: rows ? plan(items) : null, slots: rows ? null : slotsOf(items), box: null };
      });
      var exceptions = function (items) {
        var n = {}, o = [];
        if (c.summary !== 'none') items.forEach(function (it) {
          var k = kindOf(it, it.status), w = String(it.status);
          if (has(it.status) && (k === 'warn' || k === 'crit' || c.summary === 'all')) { if (!n[w]) { n[w] = { k: k || 'neutral', n: 0 }; o.push(w); } n[w].n++; }
        });
        return o.sort(function (a, b) { return rank(n[a].k) - rank(n[b].k); }).map(function (w) {
          return h.el('span', { class: 'k-board-ex k-s-' + n[w].k }, [h.el('i', { class: 'k-b-dot k-s-' + n[w].k }), h.line(n[w].n + '\u00a0' + w)]);
        });
      };
      var begin = function (p) {
        var g = p.g, rc = p.rc;
        p.box = root.appendChild(h.el('section', { class: 'k-board-g' }));
        if (has(g.title) || has(g.subtitle)) p.box.appendChild(h.el('header', { class: 'k-board-gh' }, [h.el('h' + lvl, { class: 'k-board-gt' }, [h.line(has(g.title) ? g.title : '')]),
          h.el('span', { class: 'k-b-faint k-b-num', text: String(p.items.length) })].concat(exceptions(p.items), [has(g.subtitle) ? h.line(g.subtitle, { class: 'k-board-gs' }) : null])));
        p.body = p.box.appendChild(h.el('div', { class: rows ? 'k-board-rows' : 'k-board-grid', style: rows ? null : { '--k-board-cols': p.items.length > cols ? Math.ceil(p.items.length / Math.ceil(p.items.length / cols)) : cols } }));
        if (!rc) return;
        p.body.style.setProperty('--k-board-tpl', rc.stacked ? 'minmax(0,1fr)' : 'minmax(8rem,1.3fr)' + rc.cols.map(function () { return ' minmax(0,1.6fr)'; }).join('') + (rc.hasP ? ' minmax(7rem,1fr)' : '') + (rc.pill ? ' ' + rc.pw + 'px' : ''));
        if (!rc.stacked && (rc.cols.length || rc.hasP)) p.body.appendChild(h.el('div', { class: 'k-board-hd', 'aria-hidden': 'true' }, [h.el('span')].concat(rc.cols.map(function (l) { return h.line(l); }), rc.hasP ? [rc.pLabel ? h.line(rc.pLabel) : h.el('span')] : [], rc.pill ? [h.el('span')] : [])));
      };
      /* a fully shown card grid whose last row is short: the cards of that row share the whole width, so no card sits beside an empty half row */
      var balance = function (p) {
        if (rows || !p.body || p.pos < p.items.length) return;
        var cn = +p.body.style.getPropertyValue('--k-board-cols'), kids = [].filter.call(p.body.children, function (x) { return x.classList.contains('k-board-card'); }), n = kids.length, r = cn > 1 ? n % cn : 0;
        if (!r || n <= cn) return;
        var base = Math.floor(cn / r), extra = cn % r;
        kids.slice(n - r).forEach(function (x, i) { x.style.gridColumn = 'span ' + (base + (i >= r - extra ? 1 : 0)); });
      };
      /* a field whose value would need more than two lines beside its label, or breaks a word, puts the value under the label */
      var stackLong = function () {
        if (!el.clientWidth) return;
        [].forEach.call(root.querySelectorAll('.k-board-r:not(.k-board-rl)'), function (r) {
          var dd = r.lastChild, lh = parseFloat(getComputedStyle(dd).lineHeight) || 18;
          var hh = dd.getBoundingClientRect().height;
          if (hh > lh * 2.2 || dd.scrollWidth > dd.clientWidth + 1 || (hh > lh * 1.5 && dd.clientWidth < r.clientWidth * 0.5)) r.classList.add('k-board-rl');
        });
      };
      var fill = function () {
        gs.forEach(function (p) {
          while (p.pos < p.items.length && shown < cap) { if (!p.box) begin(p); p.body.appendChild(p.rc ? row(p.items[p.pos++], p.rc) : card(p.items[p.pos++], p.slots)); shown++; }
        });
        gs.forEach(balance);
        stackLong();
        if (more) { more.remove(); more = null; }
        var left = gs.reduce(function (n, p) { return n + p.items.length - p.pos; }, 0);
        if (left > 0) el.appendChild(more = h.el('button', { class: 'k-b-btn k-board-more', type: 'button', text: 'Show more (' + left + ' left)', on: { click: function () { h.fitStop(); cap += step; fill(); } } }));
      };
      fill();
      if (h.fill === 'grow') h.fit(h.padFit(root, 28));
    }
  });
})();
