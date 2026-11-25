/* @block detail 1.0 -- Key-value panel with titled sections and ordered lists; sizes to its content.
 * Use for: shipment cargo and lot, documents (S); van status, tomorrow's route stops with km (E); artist card, rider check (G).
 * Pick: One record's key-value facts in titled sections, plus ordered lists (cargo, vehicle, person, route stops).
 * Load: blocks.css, core.js, detail.css, detail.js
 * Call: K.block.detail('#a-cargo', {title: 'Cargo and lot', sections: [{items: [{label: 'Lot', value: 'L-26-0871'}]}]})
 * Config:
 *   sections   array, required  [{title?, items[] | list[], ordered?}]; a section with neither items nor list is skipped
 *     title    text             small caption above the section
 *     items    array            key-value rows [{label, value, status?, tone?, href?, mono?, hint?}]
 *       label  text, required   caption, one line (ellipsis + title); labels line up in one column per section
 *       value  text             shown as given; ids, times and numbers never break; missing -> a dash
 *       status text             value becomes a pill (dot + word); words map to ok/warn/crit/info (Delayed -> warn)
 *       tone   ok|warn|crit|info|neutral  overrides the colour the status word maps to; on a row without status it colours the value (a critical number)
 *       href   string           value becomes a link
 *       mono   boolean          monospace value (codes, plates, container numbers)
 *       strong boolean          the key figure of the card: larger, semibold value
 *       hint   text             one muted line under the value
 *     list     array            plain or ordered rows [{text, meta?, status?, tone?}]
 *       text   text, required   the row (wraps at spaces, shown in full)
 *       meta   text             right-aligned, never wraps ("42 km", "17:55")
 *       status text             coloured marker (dot, or ring around the number when ordered)
 *     ordered  boolean, default false  numbered markers joined by a line (route stops, steps)
 *   columns    1|2, default 1   2 puts key-value rows in two columns, only when the card is >= 480 px wide and only in sections with 4 or more rows
 *              (a section with fewer rows stays in one column; such sections sit side by side two to a row, so the card has no empty right half)
 *   fill       true|'scroll'|false  row-height fill, see DESIGN.md. true: next to a taller card the rows get extra padding until the card ends with the row; 'scroll': the row height
 *              comes from the other cards and the sections scroll inside with a fade. Default: off (a k-row-fill grid turns it on)
 *   (common)   title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no rows), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] detail: load core.js before detail.js'); return; }
  var TONES = ['ok', 'warn', 'crit', 'info', 'neutral'];
  var kind = function (h, o) { return o.tone && TONES.indexOf(o.tone) >= 0 ? o.tone : h.statusKind(o.status); };
  var pill = function (h, k, text) {
    return h.el('span', { class: 'k-b-pill k-detail-pill k-s-' + k + '', title: String(text) }, [h.el('span', { text: text })]);
  };
  K.block.define('detail', {
    version: '1.0',
    fill: true,
    resize: true,
    emptyText: 'Nothing to show yet',
    schema: {
      sections: { type: 'array', required: true, of: {
        title: { type: 'text' }, ordered: { type: 'boolean' },
        items: { type: 'array', of: {
          label: { type: 'text', required: true }, value: { type: 'text' }, status: { type: 'text' }, tone: { type: 'string' },
          href: { type: 'string' }, mono: { type: 'boolean' }, strong: { type: 'boolean' }, hint: { type: 'text' } } },
        list: { type: 'array', of: { text: { type: 'text', required: true }, meta: { type: 'text' }, status: { type: 'text' }, tone: { type: 'string' } } } } },
      columns: { type: 'number', default: 1, enum: [1, 2] }
    },
    empty: function (c) { return !c.sections.some(function (s) { return (s.items && s.items.length) || (s.list && s.list.length); }); },
    render: function (el, c, h) {
      var cols = c.columns === 2 && (el.clientWidth || 600) >= 480 ? 2 : 1, lvl = Math.min(6, Math.max(2, c.headingLevel | 0) + 1);
      var root = el.appendChild(h.el('div', { class: 'k-detail' + (cols === 2 ? ' k-detail-g2' : '') }));
      if (h.fill === 'grow') h.fit(h.padFit(root, 24));
      // one label column for the whole block: as wide as the longest label, at most 46 % (34 % per side in two columns)
      var f = '500 13px ' + getComputedStyle(root).fontFamily, lw = 0;
      c.sections.forEach(function (sec) { (sec.items || []).forEach(function (r) { lw = Math.max(lw, h.measureText(String(r.label), f)); }); });
      root.style.setProperty('--k-detail-lw', Math.ceil(Math.min(lw + 18, (root.clientWidth || 300) * (cols === 2 ? 0.34 : 0.46))) + 'px');
      c.sections.forEach(function (sec) {
        var rows = sec.items || [], list = sec.list || [];
        if (!rows.length && !list.length) return;
        var s = root.appendChild(h.el('section', { class: 'k-detail-sec' + (cols === 2 && rows.length >= 4 ? ' k-detail-wide' : '') }));
        if (sec.title != null) s.appendChild(h.el('h' + lvl, { class: 'k-detail-h', text: sec.title, title: String(sec.title) }));
        if (rows.length) {
          var sc = cols === 2 && rows.length >= 4 ? 2 : 1, dl = h.el('dl', { class: 'k-detail-kv' + (sc === 2 ? ' k-detail-2' : '') });
          rows.forEach(function (r, i) {
            var first = i < sc ? ' k-detail-first' : '';
            var has = r.value != null && r.value !== '';
            var txt = has ? String(r.value) : '';
            var inner;
            if (!has) inner = h.el('span', { class: 'k-b-faint', 'aria-label': 'no value', text: '\u2014' });
            else if (r.status != null && r.status !== '') inner = pill(h, kind(h, r), txt);
            else if (r.mono) inner = h.el('span', { class: 'k-b-mono k-detail-mono', text: txt });
            else inner = h.rich(txt);
            if (has && !(r.status != null && r.status !== '') && r.tone && TONES.indexOf(r.tone) >= 0) inner = h.el('span', { class: 'k-detail-vt k-s-' + r.tone }, inner);
            var val = h.el('dd', { class: 'k-detail-v' + first + (r.strong ? ' k-detail-strong' : ''), title: txt || null }, [].concat(
              r.href ? h.el('a', { class: 'k-detail-a', href: r.href }, inner) : inner,
              r.hint != null && r.hint !== '' ? h.el('span', { class: 'k-detail-hint' }, h.rich(String(r.hint).replace(/(\S)[ \t]+(?=\d{1,2}:\d{2}(?:\s|$|[,.;)]))/g, '$1\u00a0'))) : null));
            dl.appendChild(h.el('dt', { class: 'k-detail-k' + first, title: String(r.label) }, [h.el('span', { text: r.label })]));
            dl.appendChild(val);
          });
          if (sc === 2 && rows.length % 2) { dl.appendChild(h.el('dt', { class: 'k-detail-k', 'aria-hidden': 'true' })); dl.appendChild(h.el('dd', { class: 'k-detail-v', 'aria-hidden': 'true' })); }
          s.appendChild(dl);
          dl.style.gridTemplateColumns = sc === 2 ? 'var(--k-detail-lw) minmax(0,1fr) var(--k-detail-lw) minmax(0,1fr)' : 'var(--k-detail-lw) minmax(0,1fr)';
        }
        if (list.length) {
          var ol = h.el(sec.ordered ? 'ol' : 'ul', { class: 'k-detail-list' + (sec.ordered ? ' k-detail-ord' : '') });
          list.forEach(function (it, i) {
            var k = it.status != null || it.tone ? kind(h, it) : '';
            var mark = sec.ordered ? h.el('span', { class: 'k-detail-n' + (k ? ' k-s-' + k : ''), 'aria-hidden': 'true', text: String(i + 1) })
              : h.el('span', { class: 'k-b-dot' + (k ? ' k-s-' + k : ''), 'aria-hidden': 'true' });
            ol.appendChild(h.el('li', { class: 'k-detail-li', title: String(it.text) + (it.meta != null ? ' \u00b7 ' + it.meta : '') }, [
              mark,
              h.el('span', { class: 'k-detail-t' }, [].concat(h.rich(it.text), it.status != null && it.status !== '' && TONES.indexOf(String(it.status)) < 0 ? [' ', h.el('span', { class: 'k-b-pill k-detail-st k-s-' + k }, [h.el('span', { text: it.status })])] : null)),
              it.meta != null && it.meta !== '' ? h.el('span', { class: 'k-detail-m k-b-num', text: it.meta }) : null]));
          });
          s.appendChild(ol);
        }
      });
      if (cols === 2) { // small sections pair up two to a row; one left alone at the end of a run takes the full width
        var run = [];
        [].slice.call(root.children).concat([null]).forEach(function (n) {
          if (n && !n.classList.contains('k-detail-wide')) { run.push(n); return; }
          if (run.length % 2) run[run.length - 1].classList.add('k-detail-wide');
          run = [];
        });
      }
    }
  });
})();
