/* @block table 1.0 -- Data table: ids and times never wrap, columns by priority, scrolls inside its card with a sticky first column, sort, search, filters, pager, hour grids.
 * Use for: SpudTrack shipments and alerts, EV Fleet vans and sessions, Stagehand crew list, rider items, arrivals, the crew-by-hour grid.
 * Pick: Any list of records: ids never wrap, sort, search, filters, pager, sticky first column, row link.
 * Load: blocks.css, core.js, filterbar.css, filterbar.js (only for search and filters), table.css, table.js
 * Call: K.block.table('#a-shipments', {noun: 'shipments', columns: [{key: 'id', label: 'Shipment', type: 'id'}, {key: 'status', type: 'status'}], rows: D.shipments, rowHref: function (r) { return '#/shipments/' + r.id; }})
 * Config:
 *   columns    array, required  [{key, label?, type?, priority?, unit?, dp?, width?, align?, sortable?, sortKey?, format?, cat?, minWidth?, maxWidth?}]
 *     key      string, required  field name in each row
 *     label    text              header ("Need"); defaults to the key; never wraps (the column is measured to fit it)
 *     type     id|text|num|time|date|datetime|status|badge|cell  default text. id: one unit, never cut. text: one line, ellipsis + title. num: right aligned, tabular.
 *                time: "HH:MM" or ISO. date/datetime: ISO. status: pill, colour from the word (Delayed, Ready, High...). badge: neutral tag (cat:true adds a category dot).
 *                cell: narrow grid cell for hour grids, shrinks from `width` (default 44) to `minWidth` (default 30) before the table scrolls, and its header drops to `short` (default "HH" for "HH:00") when the label no longer fits; the value is true, a short label or {label, status?, cat?, flag?, title?}
 *     priority number, default 1 for the first column, 3 for the rest  1-2 are never hidden; when the table is too narrow the highest numbers go first
 *     unit     text              shown muted in the header ("kWh", "%"); cells then hold the plain number
 *     dp       number            decimals of a num column; format(row) -> string|number overrides the displayed text
 *     width    number            fixed px width; sortable boolean (default true, false for cell); sortKey names another field to sort by (etaIso for eta)
 *     minWidth, maxWidth number  px limits for the measured width (text defaults to max 300)
 *   rows       array, required  plain objects; the block never changes them. Missing values show a dash.
 *   rowKey     string           field that identifies a row (default "id"); the row element gets id "<idPrefix><slug>"
 *   idPrefix   string, default "a-row-"
 *   rowHref    function(row)    URL of the row detail; the first cell becomes a link and a click anywhere on the row follows it
 *   onRow      function(row)    called on row click or Enter (instead of rowHref navigation)
 *   selected   text             rowKey value shown as selected
 *   sort       object           {key, dir:'asc'|'desc'} initial sort; header buttons change it
 *   search     true|object      {placeholder?, keys?}; searches the shown text and `keys` (needs filterbar.js)
 *   filters    object           {groups:[{key, field?, label?, options?, multi?}], value?, counts?, countScope?}; options and counts are derived from the rows when omitted (needs filterbar.js)
 *     countScope  function(row)|'visible'|'all'  which rows the chip counts cover: a predicate (count only open rows), 'visible' (rows that pass the other groups) or 'all' (default)
 *   pageSize   number, default 50  0 = no pager;  stickyFirst boolean, default true;  stickyCols number (how many leading columns stay pinned, default 1);  maxColumns number (cap on visible columns);  allColumns boolean (start with every column shown, scrolling);  maxHeight number (px, vertical scroll with sticky header)
 *   noun       text, default "rows"  used in the count line;  legend array [{label, cat|status}] under the table (same colours as cell cat; status draws the flag ring);  noMatchText text
 *   (common)   title, subtitle, actions, state, emptyText, frame, headingLevel
 *   fill       true|'scroll'|false  row-height fill, see DESIGN.md. true: next to a taller card the table shows more rows per page than pageSize while they fit, then adds row padding; it never makes
 *              the row taller. 'scroll': the row height comes from the other cards and the table scrolls inside (sticky header) with a fade. Default: off (a k-row-fill grid turns it on)
 * States: empty (no rows), no match (filters), loading, error, bad config. Hidden columns: a "+N more columns" button shows them (the table then scrolls inside its card).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] table: load core.js before table.js'); return; }
  var TYPES = ['id', 'text', 'num', 'time', 'date', 'datetime', 'status', 'badge', 'cell'], DASH = '\u2014';
  var MIN = { id: 0, num: 60, time: 60, date: 64, datetime: 96, status: 92, badge: 72 };
  var slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var isD = function (v) { return Object.prototype.toString.call(v) === '[object Date]'; };
  var sel = function (v) { return Array.isArray(v) ? v.map(String) : (v == null || v === '' ? [] : [String(v)]); };
  var warned = {};
  var safe = function (fn, a) { try { return fn(a); } catch (e) { if (!warned[e.message]) { warned[e.message] = 1; console.warn('[K.block] table: callback threw ' + e.message); } } };
  K.block.define('table', {
    version: '1.0',
    frame: true,
    fill: true,
    emptyText: 'No rows to show',
    schema: {
      columns: { type: 'array', required: true, of: {
        key: { type: 'string', required: true }, label: { type: 'text' }, type: { type: 'string', enum: TYPES, default: 'text' }, priority: { type: 'number' }, unit: { type: 'text' },
        dp: { type: 'number' }, width: { type: 'number' }, minWidth: { type: 'number' }, maxWidth: { type: 'number' }, align: { type: 'string', enum: ['left', 'right', 'center'] },
        sortable: { type: 'boolean' }, sortKey: { type: 'string' }, format: { type: 'function' }, cat: { type: 'boolean' }, short: { type: 'text' } } },
      rows: { type: 'array', required: true },
      rowKey: { type: 'string', default: 'id' }, idPrefix: { type: 'string', default: 'a-row-' }, rowHref: { type: 'function' }, onRow: { type: 'function' }, selected: { type: 'text' },
      sort: { type: 'object' }, search: { type: 'any' }, filters: { type: 'object' }, pageSize: { type: 'number', default: 50 }, stickyFirst: { type: 'boolean', default: true }, stickyCols: { type: 'number' },
      maxColumns: { type: 'number' }, allColumns: { type: 'boolean' }, maxHeight: { type: 'number' }, noun: { type: 'text', default: 'rows' }, legend: { type: 'array' }, noMatchText: { type: 'text' }
    },
    empty: function (c) { return !c.rows.length; },
    render: function (el, c, h) {
      if (!c.columns.length) throw new Error('columns needs at least one column');
      var T = h.tbl || (h.tbl = { sort: c.sort && c.sort.key ? { key: c.sort.key, dir: c.sort.dir === 'desc' ? 'desc' : 'asc' } : null, page: 0, fv: JSON.parse(JSON.stringify((c.filters && c.filters.value) || {})), all: !!c.allColumns });
      var rows = c.rows.map(function (r) { return r && typeof r === 'object' ? r : {}; });
      var rp = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, fam = getComputedStyle(el).fontFamily;
      var fB = '400 ' + 0.8125 * rp + 'px ' + fam, fI = '600 ' + 0.8125 * rp + 'px ' + fam, fH = '600 ' + 0.75 * rp + 'px ' + fam, fU = '500 ' + 0.75 * rp + 'px ' + fam;
      var lang = h.lang();
      var text = function (k, r) {
        var v = r[k.key];
        if (k.format) { try { v = k.format(r); } catch (e) { v = '?'; } }
        if (isD(v)) { if (isNaN(v)) { h.warn('column "' + k.key + '" holds an invalid Date, shown as "\u2014"', 'baddate'); return '\u2014'; } return k.type === 'date' ? h.date(v) : k.type === 'datetime' ? h.datetime(v) : k.type === 'time' ? h.time(v) : h.when(v); }
        if (v == null || v === '' || typeof v === 'object') return '';
        if (k.type === 'num') return typeof v === 'number' ? h.num(v, { dp: k.dp }) : String(v);
        if (k.type === 'time') return h.time(v);
        if (k.type === 'date') return h.date(v);
        if (k.type === 'datetime') return h.datetime(v);
        return String(v);
      };
      var cols = c.columns.map(function (k, i) {
        var o = Object.assign({}, k, { i: i, label: k.label == null ? String(k.key).charAt(0).toUpperCase() + String(k.key).slice(1) : String(k.label), prio: k.priority != null ? k.priority : (i === 0 ? 1 : 3) });
        o.sort = k.sortable != null ? k.sortable : k.type !== 'cell';
        o.align = k.align || (k.type === 'num' ? 'right' : k.type === 'cell' ? 'center' : 'left');
        if (k.type === 'cell') { o.nat = k.width || 44; return o; }
        var w = 0, n = Math.min(rows.length, 300);
        for (var j = 0; j < n; j++) w = Math.max(w, h.measureText(text(o, rows[j]), k.type === 'id' ? fI : fB));
        var extra = k.type === 'status' ? 28 : k.type === 'badge' ? (k.cat ? 30 : 20) : 0;
        var hw = h.measureText(o.label, fH) + (o.sort ? 18 : 0) + (k.unit != null ? h.measureText('(' + k.unit + ')', fU) + 5 : 0) + 28;
        o.nat = k.width || Math.ceil(Math.max(hw, k.minWidth || (MIN[k.type] != null ? MIN[k.type] : 96), k.type === 'id' ? w + extra + 28 : Math.min(k.maxWidth || (k.type === 'text' ? 300 : 260), w + extra + 28)));
        return o;
      });
      var colOf = function (key) { return cols.filter(function (k) { return k.key === key; })[0]; };
      /* filter groups: options and counts come from the rows when the app does not give them */
      var F = c.filters || {};
      var fg = (F.groups || []).map(function (g) {
        var f = g.field || g.key, opts = g.options, seen = {};
        if (!opts) { opts = []; rows.forEach(function (r) { var v = r[f]; if (v != null && v !== '' && !seen[v]) { seen[v] = 1; opts.push({ value: v }); } }); }
        return Object.assign({}, g, { field: f, options: opts, label: g.label != null ? g.label : (colOf(g.key) ? colOf(g.key).label : g.key) });
      });
      var passes = function (r, skip) { return fg.every(function (x) { var s = sel(T.fv[x.key]); return x === skip || !s.length || s.indexOf(String(r[x.field])) >= 0; }); };
      var counted = function () { // chip counts: over all rows, over the rows a predicate accepts, or over the rows the other groups let through
        var cs = F.countScope, base = typeof cs === 'function' ? rows.filter(function (r) { return safe(cs, r); }) : rows;
        return fg.map(function (g) {
          var pool = cs === 'visible' ? base.filter(function (r) { return passes(r, g); }) : base;
          return Object.assign({}, g, { options: g.options.map(function (o) { return { value: o.value, label: o.label, count: o.count != null ? o.count : (F.counts === false ? undefined : pool.filter(function (r) { return String(r[g.field]) === String(o.value); }).length) }; }) });
        });
      };
      var sc = c.search === true ? {} : c.search || null, hay = typeof WeakMap === 'function' ? new WeakMap() : null;
      var hayOf = function (r) {
        var s = hay && hay.get(r);
        if (s == null) {
          s = cols.filter(function (k) { return k.type !== 'cell'; }).map(function (k) { return text(k, r); }).concat((sc && sc.keys || []).map(function (k) { return r[k] == null ? '' : String(r[k]); })).join('\u0001').toLowerCase();
          if (hay) hay.set(r, s);
        }
        return s;
      };
      var cmpOf = function (k, dir) {
        var key = k.sortKey || k.key, num = k.type === 'num', d = dir === 'desc' ? -1 : 1;
        return function (a, b) {
          var x = a[key], y = b[key]; if (isD(x)) x = +x; if (isD(y)) y = +y; var nx = x == null || x === '' || x !== x, ny = y == null || y === '' || y !== y;
          if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1; // empty values sort last in both directions
          if (num || (typeof x === 'number' && typeof y === 'number')) return (parseFloat(x) - parseFloat(y) || 0) * d;
          return String(x).localeCompare(String(y), lang, { numeric: true, sensitivity: 'base' }) * d;
        };
      };
      var list = function () {
        var q = String(T.fv.q || '').toLowerCase().trim();
        var out = rows.filter(function (r) {
          for (var i = 0; i < fg.length; i++) { var s = sel(T.fv[fg[i].key]); if (s.length && s.indexOf(String(r[fg[i].field])) < 0) return false; }
          return !q || hayOf(r).indexOf(q) >= 0;
        });
        var sk = T.sort && colOf(T.sort.key);
        if (sk) out = out.sort(cmpOf(sk, T.sort.dir)); // Array.sort is stable
        return out;
      };
      var lo = function (k) { return k.type === 'cell' ? Math.min(k.nat, k.minWidth || 30) : k.type === 'text' && !k.width ? Math.min(k.nat, k.minWidth || 150) : k.nat; }; // long text may shrink to ellipsis before a column is hidden
      var tot = function (v) { return v.reduce(function (s, k) { return s + lo(k); }, 0); };
      var pick = function (avail, all) {
        var vis = cols.slice(), hid = [];
        if (!all) {
          var cand = cols.filter(function (k) { return k.i > 0 && k.type !== 'cell' && k.prio > 2; }).sort(function (a, b) { return b.prio - a.prio || b.i - a.i; });
          while (cand.length && ((c.maxColumns > 0 && vis.length > c.maxColumns) || tot(vis) > avail)) { var x = cand.shift(); vis.splice(vis.indexOf(x), 1); hid.push(x); }
        }
        return { vis: vis, hid: hid };
      };

      /* ---------- DOM skeleton: toolbar (built once), scroller (kept), footer (rebuilt on every paint) ---------- */
      var wrap = h.el('div', { class: 'k-tbl' + (el.closest('.k-b-card') ? ' k-tbl-bleed' : '') });
      var scroll = h.el('div', { class: 'k-tbl-scroll', tabindex: '0', role: 'region', 'aria-label': (c.title != null ? c.title : 'Table') + ' (scrollable)' });
      var frame = h.el('div', { class: 'k-tbl-frame', 'data-sx': 'start' }, [scroll]);
      var foot = h.el('div', { class: 'k-tbl-foot' });
      var toolbar = (sc || fg.length) ? h.el('div', { class: 'k-tbl-bar' }) : null;
      [toolbar, frame, foot].forEach(function (n) { if (n) wrap.appendChild(n); });
      el.appendChild(wrap);
      if (toolbar) {
        var fb, on = function (v) {
          var g0 = JSON.stringify(fg.map(function (x) { return T.fv[x.key]; })); T.fv = v; T.page = 0; paint(false);
          if (F.countScope === 'visible' && fb && g0 !== JSON.stringify(fg.map(function (x) { return v[x.key]; }))) { // counts follow the selection; keep the focused chip
            var a = document.activeElement, fid = a && toolbar.contains(a) ? a.getAttribute('data-fid') : null, nf;
            fb.update({ groups: counted(), value: T.fv });
            if (fid && (nf = toolbar.querySelector('[data-fid="' + fid + '"]'))) nf.focus();
          }
        };
        if (K.block.filterbar) {
          fb = K.block.filterbar(toolbar, { groups: counted(), search: sc ? { placeholder: sc.placeholder || 'Search ' + c.noun } : undefined, value: T.fv, onChange: on });
          h.cleanup(function () { fb.destroy(); });
        } else if (sc) {
          console.warn('[K.block] table: filterbar.js not loaded, only a plain search box is shown');
          var inp = h.el('input', { type: 'text', class: 'k-fb-input', placeholder: sc.placeholder || 'Search ' + c.noun, 'aria-label': 'Search', value: T.fv.q || '' });
          inp.addEventListener('input', function () { T.fv = { q: inp.value }; T.page = 0; paint(true); });
          toolbar.appendChild(h.el('div', { class: 'k-fb-search' }, [inp]));
        }
      }
      var scrolled = function () {
        var m = scroll.scrollWidth - scroll.clientWidth, x = scroll.scrollLeft;
        frame.setAttribute('data-sx', m <= 1 ? 'none' : x <= 1 ? 'start' : x >= m - 1 ? 'end' : 'mid');
      };
      scroll.addEventListener('scroll', scrolled);
      if (h.fill === 'scroll') { el.classList.add('k-b-own-scroll'); h.fade(scroll); }
      else if (c.maxHeight > 0) scroll.style.maxHeight = c.maxHeight + 'px';

      var paint = function (keep) {
        var a = document.activeElement, fid = keep !== false && a && wrap.contains(a) ? a.getAttribute('data-fid') : null;
        var avail = frame.clientWidth || 960, all = list(), size = T.fitN || (c.pageSize > 0 ? c.pageSize : all.length || 1);
        var pages = Math.max(1, Math.ceil(all.length / size));
        T.page = Math.min(T.page, pages - 1);
        var shown = all.slice(T.page * size, T.page * size + size);
        var pk = pick(avail, T.all), vis = pk.vis, hid0 = T.all ? pick(avail, false).hid : pk.hid;
        var w = vis.map(function (k) { return k.nat; }), sum = function () { return w.reduce(function (s, x) { return s + x; }, 0); }, over = sum() - avail;
        var cut = function (test) { // take width from the columns `test` accepts, in proportion to what they can give up
          var o = sum() - avail, room = vis.map(function (k, i) { return test(k) ? Math.max(0, w[i] - lo(k)) : 0; }), rt = room.reduce(function (x, y) { return x + y; }, 0);
          if (o > 0 && rt > 0) w = w.map(function (x, i) { return x - Math.min(room[i], Math.ceil(o * room[i] / rt)); });
        };
        if (over > 0) { cut(function (k) { return k.type === 'cell'; }); if (!T.all) cut(function (k) { return k.type !== 'cell'; }); }
        var slack = avail - sum();
        if (slack > 0) {
          var tg = vis.filter(function (k) { return k.type !== 'cell' && !k.width; });
          if (tg.length) { // text columns take twice their share, so long cells get room first
            var wt = tg.map(function (k) { return k.nat * (k.type === 'text' ? 2 : 1); }), sw = wt.reduce(function (x, y) { return x + y; }, 0);
            tg.forEach(function (k, i) { w[vis.indexOf(k)] += Math.floor(slack * wt[i] / sw); });
          } else {
            tg = vis.filter(function (k) { return k.type === 'cell'; });
            tg.forEach(function (k) { w[vis.indexOf(k)] += Math.min(Math.floor(slack / tg.length), 28); });
          }
        }
        var rest = avail - sum(), gi = vis.length - 1; // leftover pixels from rounding go to the last column that can take them
        while (gi > 0 && (vis[gi].width && vis[gi].type !== 'cell')) gi--;
        if (rest > 0 && rest < 40) { var cl = vis.filter(function (k) { return k.type === 'cell'; }); if (vis[gi].type === 'cell' && cl.length > 1) cl.forEach(function (k, i) { w[vis.indexOf(k)] += Math.floor(rest / cl.length) + (i < rest % cl.length ? 1 : 0); }); else w[gi] += rest; } /* leftover pixels: spread over the hour cells, so the last one is not wider */
        var total = w.reduce(function (s, x) { return s + x; }, 0);
        var ns = c.stickyCols != null ? c.stickyCols : c.stickyFirst ? 1 : 0, sx = {}, sl = 0; // pinned columns: left offsets, never more than 60 % of the width
        vis.forEach(function (k, vi) { if (vi < ns && (vi === 0 || sl + w[vi] <= avail * 0.6)) { sx[k.i] = sl; sl += w[vi]; k.last = vi === ns - 1 || (vi + 1 < vis.length && sl + w[vi + 1] > avail * 0.6); } });
        var stick = function (k) { return k.i in sx ? ' k-tbl-stick' + (k.last ? '' : ' k-tbl-stickn') : ''; };
        var stl = function (k) { return k.i in sx && sx[k.i] ? { left: sx[k.i] + 'px' } : null; };
        var tr0 = h.el('tr');
        vis.forEach(function (k, vi) {
          var hl = k.type === 'cell' && h.measureText(k.label, fH) + 6 > w[vi] ? (k.short != null ? String(k.short) : k.label.replace(/^(\d{1,2}):00$/, '$1')) : k.label;
          var on = T.sort && T.sort.key === k.key, lab = [h.el('span', { class: 'k-tbl-hl', text: hl }), k.unit != null ? h.el('span', { class: 'k-tbl-unit', text: '(' + k.unit + ')' }) : null];
          var th = h.el('th', { scope: 'col', class: 'k-tbl-th k-tbl-a-' + k.align + (k.type === 'cell' ? ' k-tbl-cellh' : '') + stick(k), style: stl(k), 'aria-sort': on ? (T.sort.dir === 'desc' ? 'descending' : 'ascending') : (k.sort ? 'none' : null), title: k.label + (k.unit != null ? ' (' + k.unit + ')' : '') });
          if (k.sort) {
            lab.push(h.svg('svg', { class: 'k-tbl-ico', width: 8, height: 12, viewBox: '0 0 8 12', 'aria-hidden': 'true' }, [
              h.svg('path', { d: 'M4 1L1 4.5h6z', class: on && T.sort.dir === 'asc' ? 'k-tbl-on' : '' }), h.svg('path', { d: 'M4 11L1 7.5h6z', class: on && T.sort.dir === 'desc' ? 'k-tbl-on' : '' })]));
            th.appendChild(h.el('button', { type: 'button', class: 'k-tbl-sort', 'data-fid': 'sort|' + k.key, on: { click: function () {
              T.sort = on ? { key: k.key, dir: T.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k.key, dir: 'asc' }; T.page = 0; paint(true); } } }, lab));
          } else lab.forEach(function (n) { if (n) th.appendChild(n); });
          tr0.appendChild(th);
        });
        var cellEl = function (k, r) {
          var v = r[k.key], td = h.el('td', { class: 'k-tbl-td k-tbl-a-' + k.align + (k.type === 'cell' ? ' k-tbl-cellc' : '') + stick(k), style: stl(k) });
          if (k.type === 'cell') {
            if (v == null || v === false || v === '') return td;
            var o = typeof v === 'object' ? v : { label: v === true ? '' : String(v) }, kind = o.status ? h.statusKind(o.status) : '';
            td.appendChild(h.el('span', { class: 'k-tbl-cell' + (kind ? ' k-s-' + kind + ' k-tbl-cell-s' : '') + (o.cat != null ? ' k-tbl-cell-c' : '') + (o.flag ? ' k-tbl-flag k-s-' + h.statusKind(o.flag) : ''),
              style: o.cat != null ? { '--k-cc': h.catFor(o.cat) } : null, title: o.title || (k.label + ': ' + (o.label || o.cat || o.status || 'yes')), text: o.label || '' }));
            return td;
          }
          var s = text(k, r);
          if (s === '') { td.appendChild(h.el('span', { class: 'k-b-faint', text: DASH })); return td; }
          var href = k.i === 0 && c.rowHref ? safe(c.rowHref, r) : null, inner;
          if (k.type === 'status') inner = h.el('span', { class: 'k-b-pill ' + h.status(v) }, [h.el('span', { class: 'k-b-line', text: s })]);
          else if (k.type === 'badge') inner = h.el('span', { class: 'k-tbl-badge' }, [k.cat ? h.el('i', { style: { background: h.catFor(s) } }) : null, h.el('span', { class: 'k-b-line', text: s })]);
          else inner = h.el('span', { class: k.type === 'text' ? 'k-b-line' : 'k-b-nw', text: s });
          if (k.type === 'id' || k.type === 'text' || k.type === 'status' || k.type === 'badge') td.title = s;
          if (k.type === 'id') inner.classList.add('k-tbl-id');
          td.appendChild(href ? h.el('a', { class: 'k-tbl-link', href: href }, [inner]) : inner);
          return td;
        };
        var body = h.el('tbody');
        shown.forEach(function (r) {
          var key = r[c.rowKey], isSel = c.selected != null && key != null && String(key) === String(c.selected);
          var tr = h.el('tr', { class: 'k-tbl-tr' + (isSel ? ' k-tbl-sel' : '') + (c.onRow || c.rowHref ? ' k-tbl-click' : ''), id: key != null ? c.idPrefix + slug(key) : null, 'data-key': key, 'aria-current': isSel ? 'true' : null, tabindex: c.onRow && !c.rowHref ? '0' : null });
          vis.forEach(function (k) { tr.appendChild(cellEl(k, r)); });
          if (c.onRow || c.rowHref) {
            tr.addEventListener('click', function (e) {
              if (e.target.closest('a,button,input')) return;
              var l = tr.querySelector('a.k-tbl-link');
              if (c.onRow) safe(c.onRow, r); else if (l) l.click();
            });
            if (c.onRow) tr.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); safe(c.onRow, r); } });
          }
          body.appendChild(tr);
        });
        var table = h.el('table', { class: 'k-tbl-t', style: { width: total + 'px' }, 'aria-label': c.title != null ? String(c.title) : null }, [
          h.el('colgroup', null, w.map(function (x) { return h.el('col', { style: { width: x + 'px' } }); })), h.el('thead', null, [tr0]), body]);
        scroll.textContent = '';
        scroll.appendChild(table);
        if (!all.length) {
          scroll.appendChild(h.el('div', { class: 'k-tbl-none', role: 'status' }, [h.el('p', { text: c.noMatchText != null ? c.noMatchText : 'No ' + c.noun + ' match these filters' }),
            h.el('button', { type: 'button', class: 'k-b-btn', 'data-fid': 'clear', text: 'Clear filters', on: { click: function () { T.fv = {}; T.page = 0; if (K.block.filterbar && toolbar && toolbar._kBlock) toolbar._kBlock.update({ value: T.fv, groups: counted() }); paint(false); } } })]));
        }
        /* footer: count line, hidden columns toggle, pager, legend */
        foot.textContent = '';
        var n = all.length, from = n ? T.page * size + 1 : 0, to = Math.min(n, T.page * size + size), f = n !== rows.length;
        var cnt = n <= size ? (f ? h.num(n) + ' of ' + h.num(rows.length) + ' ' + c.noun : h.num(n) + ' ' + c.noun) : 'Showing ' + h.num(from) + '\u2013' + h.num(to) + ' of ' + h.num(n) + ' ' + c.noun + (f ? ' (filtered from ' + h.num(rows.length) + ')' : '');
        var right = h.el('div', { class: 'k-tbl-foot-r' });
        if (hid0.length) right.appendChild(h.el('button', { type: 'button', class: 'k-tbl-more', 'aria-pressed': T.all ? 'true' : 'false', 'data-fid': 'all', title: hid0.map(function (k) { return k.label; }).join(', '),
          text: T.all ? 'Fit to width' : '+' + hid0.length + ' more column' + (hid0.length > 1 ? 's' : ''), on: { click: function () { T.all = !T.all; paint(true); } } }));
        if (pages > 1) {
          var pg = function (lbl, d, dis) { return h.el('button', { type: 'button', class: 'k-b-btn k-tbl-pg', 'data-fid': 'pg' + d, disabled: dis ? true : null, 'aria-label': lbl, title: lbl, text: d < 0 ? '\u2039' : '\u203a', on: { click: function () { T.page += d; paint(true); scroll.scrollTop = 0; } } }); };
          right.appendChild(pg('Previous page', -1, T.page === 0));
          right.appendChild(h.el('span', { class: 'k-b-num k-b-muted', text: 'Page ' + (T.page + 1) + ' of ' + pages }));
          right.appendChild(pg('Next page', 1, T.page >= pages - 1));
        }
        foot.appendChild(h.el('span', { class: 'k-tbl-count k-b-nw', text: cnt }));
        if (c.legend && c.legend.length) foot.appendChild(h.el('div', { class: 'k-b-legend k-tbl-legend' }, c.legend.map(function (l) {
          return h.el('span', null, [h.el('i', { class: l.status != null ? 'k-tbl-sw-ring k-tbl-sw-' + h.statusKind(l.status) : null, style: { '--sw': l.cat != null ? h.catFor(l.cat) : l.status != null ? 'var(--k-' + h.statusKind(l.status) + ')' : 'var(--k-neutral)' } }), l && l.label != null ? String(l.label) : '']); })));
        if (right.childNodes.length) foot.appendChild(right);
        scrolled();
        if (fid) { var nf = wrap.querySelector('[data-fid="' + fid + '"]'); if (nf && !nf.disabled) nf.focus(); }
      };
      T.fitN = null;
      paint(false);
      if (h.fill === 'grow') {
        var specs = [];
        if (c.pageSize > 0 && c.rows.length > c.pageSize) specs.push({ base: c.pageSize, max: c.rows.length, set: function (n) {
          var cur = T.fitN || c.pageSize, first = T.page * cur;
          T.fitN = n === c.pageSize ? null : n; T.page = Math.floor(first / n); paint(true);
        } });
        specs.push(h.padFit(wrap, 24));
        h.fit(specs);
      }
      h.resizeObserver(el, function () { paint(true); });
    }
  });
})();
