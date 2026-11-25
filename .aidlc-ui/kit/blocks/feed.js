/* @block feed 1.0 -- Alert / incident / event feed: severity-ranked rows, open before closed, times shown exactly as given.
 * Use for: alert feed and "Needs a call today" (S); alerts with a suggested action (E); incident list, incident log, arrivals (G).
 * Pick: Alerts, incidents or events ranked by severity, open before closed, times as given.
 * Load: blocks.css, core.js, feed.css, feed.js
 * Call: K.block.feed('#a-alerts', {title: 'Alerts', items: [{id: 'AL-01', title: 'SP-2414 line stops tomorrow 06:00', severity: 'High', time: '09:55'}]})
 * Config:
 *   items     array, required  [{id?, title, severity?, status?, tone?, time?, at?, meta?, body?, tags?, href?, selected?, closed?}]
 *     title   text, required   what happened; wraps at spaces, shown in full; ids and times inside never break
 *     severity text           High|Medium|Low (or Critical, Warning...) -> pill and coloured edge; sorts the feed
 *     status  text            Open, Closed, Delayed, Cancelled...; used for the pill when there is no severity. Closed/Resolved/Done/Dismissed = closed
 *     tone    ok|warn|crit|info|neutral  overrides the colour of severity/status words the block does not know ("Cancelled" -> crit)
 *     time    time            shown as given, never recomputed ("09:55", "yesterday 14:30"); a JS Date shows as clock time today, else day and time
 *     at      time|number     sortable moment (ISO string, ms or JS Date) used only by sort='time'
 *     meta    text            one muted line next to the pill ("SP-2414 \u00b7 Open")
 *     body    text            detail or suggested action; cut at 3 lines with a Show more toggle
 *     tags    array           short chips (["Truck", "Border"])
 *     href    string          the row is a link; selected  boolean  marks the current row; closed  boolean  forces closed
 *   sort      'severity'|'time'|'none', default 'severity'  severity: crit, warn, info, neutral, given order inside a rank; time: newest first by "at"
 *   group     'state'|'severity'|'none', default 'state'  state: open rows, then closed rows (headers only when both exist)
 *   limit     number, default 30   rows shown first; "Show more" adds that many again
 *   fill      true|'scroll'|false  row-height fill, see DESIGN.md. true: next to a taller card the feed shows more rows than `limit` while they fit, then spreads the row padding; it never
 *             makes the row taller. 'scroll': the row height comes from the other cards and the list scrolls inside with a fade. Default: off (a k-row-fill grid turns it on)
 *   onSelect  function(item)       rows become buttons that call it and mark the row selected (ignored for rows with href)
 *   compact   boolean, default false  log style: time column, dot, one title line, no body/tags; no pill unless `pill` is true
 *   pill      boolean, default true (false when compact)  true keeps the severity/status pill; compact then shows it in its own column at the right end
 *   (common)  title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no items), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] feed: load core.js before feed.js'); return; }
  var TONES = ['ok', 'warn', 'crit', 'info', 'neutral'], RANK = { crit: 0, warn: 1, info: 2, ok: 3, neutral: 4 };
  var CLOSED = /^(closed|resolved|done|dismissed)$/i;
  K.block.define('feed', {
    version: '1.0',
    frame: true,
    fill: true,
    resize: false,
    emptyText: 'Nothing to show yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, title: { type: 'text', required: true }, severity: { type: 'text' }, status: { type: 'text' }, tone: { type: 'string' },
        time: { type: 'time' }, at: { type: 'time' }, meta: { type: 'text' }, body: { type: 'text' }, tags: { type: 'array' },
        href: { type: 'string' }, selected: { type: 'boolean' }, closed: { type: 'boolean' } } },
      sort: { type: 'string', enum: ['severity', 'time', 'none'], default: 'severity' },
      group: { type: 'string', enum: ['state', 'severity', 'none'], default: 'state' },
      limit: { type: 'number', default: 30 },
      onSelect: { type: 'function' },
      compact: { type: 'boolean', default: false }, pill: { type: 'boolean' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var norm = function (t) { return String(t).toLowerCase().replace(/[\s.!:;,\u2026-]+$/, '').replace(/\s+/g, ' '); }, same = function (x, y) { return norm(x) === norm(y); };
      var kindOf = function (it) {
        if (it.tone && TONES.indexOf(it.tone) >= 0) return it.tone;
        var w = it.severity != null && it.severity !== '' ? it.severity : it.status;
        return w == null || w === '' || CLOSED.test(String(w)) ? (w == null || w === '' ? '' : 'neutral') : h.statusKind(w);
      };
      var rows = c.items.map(function (it, i) {
        var word = it.severity != null && it.severity !== '' ? String(it.severity) : (it.status != null ? String(it.status) : '');
        return { it: it, i: i, kind: kindOf(it), word: word, closed: it.closed === true || CLOSED.test(String(it.status == null ? '' : it.status)) };
      });
      var cmp = function (a, b) {
        var d = 0;
        if (c.group === 'state') d = (a.closed ? 1 : 0) - (b.closed ? 1 : 0);
        if (!d && c.group === 'severity') d = (RANK[a.kind || 'neutral'] - RANK[b.kind || 'neutral']) || a.word.localeCompare(b.word);
        if (!d && c.sort === 'severity') d = RANK[a.kind || 'neutral'] - RANK[b.kind || 'neutral'];
        if (!d && c.sort === 'time') { var ms = function (it) { return it['at$ms'] || (typeof it.at === 'number' ? it.at : Date.parse(it.at)); }, ta = ms(a.it), tb = ms(b.it); d = isNaN(ta) || isNaN(tb) ? 0 : tb - ta; }
        return d || a.i - b.i;
      };
      if (c.sort !== 'none' || c.group !== 'none') rows.sort(cmp);
      var nClosed = rows.filter(function (r) { return r.closed; }).length;
      var heads = c.group === 'state' ? (nClosed && nClosed < rows.length) : c.group === 'severity';
      var keyOf = function (r) { return c.group === 'severity' ? (r.word || 'Other') : (r.closed ? 'Closed' : 'Open'); };
      var cnt = {};
      if (heads) rows.forEach(function (r) { cnt[keyOf(r)] = (cnt[keyOf(r)] || 0) + 1; });
      var ul = h.el('ul', { class: 'k-feed' + (c.compact ? ' k-feed-compact' + (c.pill === true ? ' k-feed-cpill' : '') : '') });
      var pos = 0, shown = 0, last = null, step = Math.max(1, c.limit | 0), cap = step, more = null;
      var one = function (r) {
        var it = r.it, k = r.kind, tagged = (it.tags || []).filter(function (t) { return t != null && t !== ''; });
        var cls = 'k-feed-main' + (k ? ' k-s-' + k : '') + (r.closed ? ' k-feed-closed' : '');
        var title = h.el('span', { class: 'k-feed-t' }, [h.el('span', {}, h.rich(it.title))]);
        var time = it.time != null && it.time !== '' ? h.el('span', { class: 'k-feed-time', title: String(it.time) }, h.rich(it.time)) : null;
        var pillWord = r.word && (!c.compact || c.pill === true) ? h.el('span', { class: 'k-b-pill k-s-' + (k || 'neutral'), title: r.word }, [h.el('span', { text: r.word })]) : null;
        var closedChip = r.closed && it.severity != null && it.severity !== '' && !c.compact ? h.el('span', { class: 'k-feed-chip', text: it.status != null && CLOSED.test(String(it.status)) ? it.status : 'Closed' }) : null;
        var meta = it.meta != null && it.meta !== '' ? h.el('span', { class: 'k-feed-meta', title: String(it.meta) }, [h.el('span', { text: it.meta })]) : null;
        var kids;
        if (c.compact) kids = [time || h.el('span'), h.el('span', { class: 'k-b-dot k-s-' + (k || 'neutral'), 'aria-hidden': 'true' }),
          h.el('span', { class: 'k-feed-c' }, [title, meta]), pillWord];
        else kids = [h.el('span', { class: 'k-feed-top' }, [title, time]),
          pillWord || meta || closedChip ? h.el('span', { class: 'k-feed-sub' }, [pillWord, closedChip, meta]) : null,
          it.body != null && it.body !== '' && !same(it.body, it.title) ? h.el('span', { class: 'k-feed-body' }, [h.el('span', { text: String(it.body).replace(/^[a-z]/, function (m) { return m.toUpperCase(); }) })]) : null,
          tagged.length ? h.el('span', { class: 'k-feed-tags' }, tagged.map(function (t) { return h.el('span', { class: 'k-feed-tag', text: t }); })) : null];
        var tag = it.href ? 'a' : c.onSelect ? 'button' : 'div';
        var main = h.el(tag, { class: cls, href: it.href, type: tag === 'button' ? 'button' : null, id: it.id != null ? String(it.id) : null,
          'aria-current': it.selected ? 'true' : null, title: String(it.title) + (it.time ? ' \u00b7 ' + it.time : '') }, kids);
        if (tag === 'button') main.addEventListener('click', function () {
          [].forEach.call(ul.querySelectorAll('[aria-current]'), function (n) { n.removeAttribute('aria-current'); });
          main.setAttribute('aria-current', 'true');
          try { c.onSelect(it); } catch (e) { console.warn('[K.block] feed: onSelect failed: ' + String((e && e.message) || e).slice(0, 120)); }
        });
        return h.el('li', { class: 'k-feed-i' }, [main]);
      };
      var fillRows = function () {
        while (pos < rows.length && shown < cap) {
          var r = rows[pos++];
          if (heads && keyOf(r) !== last) {
            last = keyOf(r);
            ul.appendChild(h.el('li', { class: 'k-feed-gh', role: 'presentation' }, [h.el('span', { text: last }), h.el('span', { class: 'k-b-faint k-b-num', text: String(cnt[last]) })]));
          }
          var li = ul.appendChild(one(r)), bd = li.querySelector('.k-feed-body');
          // a body cut at 3 lines gets a toggle, so the full text is always reachable
          if (bd && bd.scrollHeight > bd.clientHeight + 1) {
            var tg = h.el('button', { class: 'k-feed-toggle', type: 'button', 'aria-expanded': 'false', text: 'Show more' });
            tg.addEventListener('click', function () { var o = li.classList.toggle('k-feed-open'); tg.setAttribute('aria-expanded', String(o)); tg.textContent = o ? 'Show less' : 'Show more'; });
            li.appendChild(tg);
          }
          shown++;
        }
        if (more) { more.remove(); more = null; }
        if (pos < rows.length) {
          var left = rows.length - pos;
          more = h.el('button', { class: 'k-b-btn k-feed-more', type: 'button', text: 'Show ' + Math.min(step, left) + ' more (' + left + ' left)',
            on: { click: function () { h.fitStop(); cap += step; fillRows(); } } });
          el.appendChild(more);
        }
      };
      el.appendChild(ul);
      fillRows();
      // row-height fill: more rows while they fit (only rows the feed has beyond `limit`), then extra row padding
      if (h.fill === 'grow') {
        var base = Math.min(step, rows.length);
        h.fit([{ base: base, max: rows.length, set: function (n) {
          ul.textContent = ''; pos = 0; shown = 0; last = null; cap = n; fillRows();
        } }, h.padFit(ul, 28)]);
      }
    }
  });
})();
