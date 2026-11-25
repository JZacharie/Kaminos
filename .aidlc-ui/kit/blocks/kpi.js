/* @block kpi 1.0 -- KPI strip: a row of big numbers with small units, wraps into balanced rows (6 per row down to 2).
 * Use for: the counters on top of a screen (in transit, delayed, ready, kWh to add, cost tonight).
 * Pick: The row of big counters at the top of a screen (3 to 8 numbers with unit, status, delta).
 * Load: blocks.css, core.js, kpi.css, kpi.js
 * Call: K.block.kpi('#a-kpis', {items: [{label: 'In transit', value: 128}, {label: 'Delayed', value: 7, status: 'warn', hint: '3 over 6 h'}]})
 * Config:
 *   items      array, required  [{label, value, unit?, delta?, good?, status?, hint?, href?, id?}]
 *     label    text, required   short caption ("Delayed"); ellipsis + title when too long
 *     value    text, required   the number or short value (16, "88", "16.99"); never wraps, shrinks then ellipsis
 *     unit     text             small unit after the value ("%", "kWh", "GBP" goes before: use prefix)
 *     prefix   text             small text before the value ("£", "GBP")
 *     delta    text|number      change vs a reference; a number gets a sign and an arrow ("+3", "-1.2 %")
 *     good     'up'|'down'      which direction of delta is good (colours the delta); default none = neutral
 *     status   ok|warn|crit|info|neutral (or aliases: delayed, at risk, blocked...)  coloured edge + dot
 *     hint     text             one muted line under the value (2 lines max, word wrap, title)
 *     href     string           whole tile becomes a link (e.g. "#/shipments?status=delayed")
 *     id       string           id on the tile element (stable a-... anchor)
 *   columns    number, default 6  maximum tiles per row; rows are balanced (12 items at 4 fit -> 4 x 3)
 *   minWidth   number, default 168  minimum tile width in px
 *   (common)   title, subtitle, state, emptyText, frame (default false: tiles are the cards), headingLevel
 * States: empty (no items), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] kpi: load core.js before kpi.js'); return; }
  var ARROW = { up: '\u25b2', down: '\u25bc' };
  K.block.define('kpi', {
    version: '1.0',
    frame: false,
    resize: true,
    emptyText: 'No figures yet',
    schema: {
      items: { type: 'array', required: true, of: {
        label: { type: 'text', required: true }, value: { type: 'text', required: true }, unit: { type: 'text' }, prefix: { type: 'text' },
        delta: { type: 'text' }, good: { type: 'string', enum: ['up', 'down'] }, status: { type: 'string' }, hint: { type: 'text' },
        href: { type: 'string' }, id: { type: 'string' } } },
      columns: { type: 'number', default: 6 },
      minWidth: { type: 'number', default: 168 }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var n = c.items.length, gap = 12;
      var w = el.clientWidth || 960, fit = Math.max(1, Math.min(Math.max(1, c.columns | 0), Math.floor((w + gap) / (Math.max(96, c.minWidth) + gap))));
      var rows = Math.ceil(n / fit), cols = Math.min(n, Math.ceil(n / rows));
      // 1 to 3 tiles keep a quarter-width tile instead of stretching across the page
      var grid = h.el('div', { class: 'k-kpi-grid', role: 'list', style: { '--k-kpi-cols': n < Math.min(fit, 4) ? Math.min(fit, 4) : cols } });
      c.items.forEach(function (it) {
        var kind = it.status ? h.statusKind(it.status) : '';
        var delta = null;
        if (it.delta != null && it.delta !== '') {
          var num = typeof it.delta === 'number', dir = num ? (it.delta > 0 ? 'up' : it.delta < 0 ? 'down' : '') : (/^\s*[+\u25b2]/.test(it.delta) ? 'up' : /^\s*[-\u2212\u25bc]/.test(it.delta) ? 'down' : '');
          var tone = !it.good || !dir ? 'neutral' : dir === it.good ? 'ok' : 'crit';
          var txt = num ? h.num(it.delta, { sign: true }) : String(it.delta);
          delta = h.el('span', { class: 'k-kpi-delta k-s-' + tone, title: txt }, [dir ? h.el('span', { 'aria-hidden': 'true', text: ARROW[dir] }) : null, txt]);
        }
        var value = h.el('div', { class: 'k-kpi-value', title: (it.prefix || '') + it.value + (it.unit ? ' ' + it.unit : '') }, [
          it.prefix != null ? h.el('span', { class: 'k-kpi-unit k-kpi-prefix', text: it.prefix }) : null,
          h.el('span', { class: 'k-kpi-num', text: typeof it.value === 'number' ? h.num(it.value) : it.value }),
          it.unit != null ? h.el('span', { class: 'k-kpi-unit', text: it.unit }) : null]);
        var tile = h.el(it.href ? 'a' : 'div', { class: 'k-kpi' + (kind ? ' k-s-' + kind + ' k-kpi-has-s' : ''), role: 'listitem', href: it.href, id: it.id }, [
          h.el('div', { class: 'k-kpi-label', title: String(it.label) }, [kind ? h.el('span', { class: 'k-b-dot k-s-' + kind, 'aria-hidden': 'true' }) : null, h.line(it.label)]),
          h.el('div', { class: 'k-kpi-row' }, [value, delta]),
          it.hint != null ? h.el('div', { class: 'k-kpi-hint', title: String(it.hint), text: it.hint }) : null]);
        if (kind) tile.setAttribute('data-status', kind);
        grid.appendChild(tile);
      });
      el.appendChild(grid);
      // a value that does not fit steps down one size, then ellipsis (never a wrap)
      [].forEach.call(grid.querySelectorAll('.k-kpi-num'), function (v) {
        if (v.scrollWidth > v.clientWidth + 1) v.parentNode.classList.add('k-kpi-value-sm');
      });
    }
  });
})();
