/* @block calendar 1.0 -- Month calendar: grid of days with event chips and multi-day bars, agenda of the picked day, or an agenda list of the month.
 * Use for: bookings, appointments, content plans, rotas, release dates: anything with a date that lives in a month (lanes = one day by resource).
 * Pick: Month grid of days with events, prev/next month and an agenda of the picked day; not for the hours of one day (use lanes).
 * Load: blocks.css, core.js, media.lib.css, media.lib.js, calendar.css, calendar.js
 * Call: K.block.calendar('#a-cal', {month: '2026-11', today: '2026-11-17', events: [{id: 'e1', date: '2026-11-18', title: 'Dentist', time: '09:30', cat: 'Health'}]})
 * Config:
 *   month      text             'YYYY-MM'; default month of today, else of the first event; prev / next / Today buttons move it and call onMonth
 *   today      text             'YYYY-MM-DD' given by the app (ring + aria-current=date); the clock is not read; no Today button without it
 *   selected   text             'YYYY-MM-DD' picked day: ring, and its agenda under the grid
 *   weekStart  0|1, default 1   0 = Sunday, 1 = Monday; names come from Intl with the page lang
 *   events     array            [{id?, date, end?, title, time?, cat?, status?, allDay?, href?}] date 'YYYY-MM-DD'; end = last day (bar; title again on each week row)
 *     time 'HH:MM' before the title; cat = colour key; status = text in title and agenda pill (a crit word like cancelled is struck through); href = link
 *   view       'month'|'agenda'|'auto', default 'auto'  month: chip grid from 560 px wide (measured on the block), below that a grid with dots (agenda only after a pick);
 *                               auto: the same, plus the agenda of the picked day (default today) below 560 px; agenda: list of the month
 *   maxPerDay  number, default 3  chips per day, then a "+2 more" button that picks the day
 *   showWeekNumbers boolean     ISO week column;   labels  object  {today, prev, next, allDay, more, none, events}
 *   onSelect(date), onEvent(event), onMonth(month)  callbacks (state also changes locally)
 *   (common)   headingLevel, state, emptyText, errorText; frame is off
 * States: loading, error, bad config; a month without events shows the empty grid (agenda view: "No events").
 * Keyboard: grid = one tab stop; arrows move day / week, PageUp / PageDown month, Home / End row ends, Enter / Space pick; Tab then reaches that day's chips.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define || !K.media) { console.warn('[K.block] calendar: load core.js and media.lib.js before calendar.js'); return; }
  var M = K.media, DAY = 864e5, warned = {}, CH = 'button.k-cal-ev,a.k-cal-ev,.k-cal-more';
  var cb = function (name, fn, a) {
    if (typeof fn !== 'function') return;
    try { fn(a); } catch (e) { var m = '[K.block] calendar: ' + name + ' threw: ' + String((e && e.message) || e).slice(0, 120); if (!warned[m]) { warned[m] = 1; console.warn(m); } }
  };
  var D = function (s) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s), t; if (!m) return null; t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return new Date(t).getUTCMonth() === m[2] - 1 ? t : null; };
  var iso = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var dim = function (t) { var d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
  var addM = function (t, n) { var d = new Date(t), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return iso(d.setUTCDate(Math.min(day, dim(+d)))); };
  K.block.define('calendar', {
    version: '1.0',
    frame: false,
    resize: true,
    schema: {
      month: { type: 'text' }, today: { type: 'text' }, selected: { type: 'text' }, weekStart: { type: 'number', default: 1 },
      events: { type: 'array', default: [], of: { id: { type: 'text' }, date: { type: 'text', required: true }, end: { type: 'text' }, title: { type: 'text', required: true }, time: { type: 'text' },
        cat: { type: 'text' }, status: { type: 'text' }, allDay: { type: 'boolean' }, href: { type: 'string' } } },
      view: { type: 'string', enum: ['month', 'agenda', 'auto'], default: 'auto' }, maxPerDay: { type: 'number', default: 3 }, showWeekNumbers: { type: 'boolean' }, labels: { type: 'object' },
      onSelect: { type: 'function' }, onEvent: { type: 'function' }, onMonth: { type: 'function' }
    },
    render: function (el, c, h) {
      var T = Object.assign({ today: 'Today', prev: 'Previous month', next: 'Next month', allDay: 'All day', more: 'more', none: 'No events', events: 'events' }, c.labels), ws = c.weekStart === 0 ? 0 : 1, lang = h.lang();
      var F = function (o) { o.timeZone = 'UTC'; try { return new Intl.DateTimeFormat(lang, o); } catch (e) { return new Intl.DateTimeFormat(undefined, o); } };
      var wide = (el.clientWidth || 720) >= 560, agOnly = c.view === 'agenda', today = c.today && D(c.today) != null ? c.today : null, max = Math.max(1, c.maxPerDay | 0), wn = c.showWeekNumbers;
      var hl = function (n) { return 'h' + Math.min(6, Math.max(1, c.headingLevel | 0) + n); };
      var col = function (e) { return { '--ic': e.cat != null && e.cat !== '' ? h.catFor(e.cat) : 'var(--k-neutral)' }; };
      var evs = [], map = {};
      c.events.forEach(function (e, i) {
        var s = D(e.date), en = e.end != null ? D(e.end) : s;
        if (s == null || en == null || en < s) { h.warn('events[' + i + '] has an invalid date or end, skipped', 'ev-date'); return; }
        evs.push({ e: e, s: s, en: en, multi: en > s, k: (en > s || e.allDay ? '0' : '1') + (e.time || '') + '\u0001' + e.title });
      });
      evs.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
      evs.forEach(function (v) { for (var t = v.s, n = 0; t <= v.en && n < 400; t += DAY, n++) (map[iso(t)] = map[iso(t)] || []).push(v); });
      var st = h._kCal, sig = [c.month, c.selected, c.today].join('|');
      if (!st || st.sig !== sig) {
        var m0 = c.month != null && /^\d{4}-\d\d$/.test(c.month) && D(c.month + '-01') != null ? c.month : null;
        if (c.month != null && !m0) h.warn('month must look like 2026-11, ignored', 'month');
        st = h._kCal = { sig: sig, sel: c.selected && D(c.selected) != null ? c.selected : null,
          month: m0 || (today ? today.slice(0, 7) : iso(evs.length ? Math.min.apply(null, evs.map(function (v) { return v.s; })) : Date.now()).slice(0, 7)) };
      }
      var mon = st.month, first = D(mon + '-01'), off = (new Date(first).getUTCDay() - ws + 7) % 7, rows = Math.ceil((off + dim(first)) / 7), uid = h.uid('cal');
      var fFull = F({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), fShort = F({ day: 'numeric', month: 'short' }), cells = [], by = {}, agBox = h.el('div', { class: 'k-cal-ag' });
      var go = function (month, foc, fc) { st.month = month; st.foc = foc; st.fc = fc; cb('onMonth', c.onMonth, month); h.rerender(); };
      var nav = function (cls, label, ic, to, txt) {
        var b = h.el('button', { type: 'button', class: 'k-b-btn k-cal-nb ' + cls, 'aria-label': label, title: label }, ic ? M.icon(h, ic, { size: 16 }) : txt);
        b.addEventListener('click', function () { go(to, null, '.' + cls); });
        return b;
      };
      el.appendChild(h.el('div', { class: 'k-cal-hd' }, [h.el(hl(1), { class: 'k-cal-ttl', id: uid, 'aria-live': 'polite', text: F({ month: 'long', year: 'numeric' }).format(first) }),
        h.el('div', { class: 'k-cal-nav' }, [nav('k-cal-p', T.prev, 'chevl', addM(first, -1).slice(0, 7)), today ? nav('k-cal-t', T.today, null, today.slice(0, 7), T.today) : null, nav('k-cal-n', T.next, 'chevr', addM(first, 1).slice(0, 7))])]));

      // agenda: the picked day (or the whole month)
      var days = function () { return Object.keys(map).filter(function (k) { return k.slice(0, 7) === mon; }).sort(); };
      var cur = function () { return st.sel || (wide || agOnly || c.view !== 'auto' ? null : today && today.slice(0, 7) === mon ? today : days()[0] || mon + '-01'); };
      var item = function (v) {
        var e = v.e, kind = e.status ? h.statusKind(e.status) : '';
        var a = h.el(e.href ? 'a' : 'button', { class: 'k-cal-ai', href: e.href, type: e.href ? null : 'button', style: col(e) }, [
          h.el('span', { class: 'k-cal-at k-b-nw', text: v.multi || e.allDay ? T.allDay : e.time || '' }),
          h.el('span', { class: 'k-cal-ab' }, [h.line(e.title, kind === 'crit' ? { class: 'k-cal-x' } : null), v.multi ? h.line(fShort.formatRange(new Date(v.s), new Date(v.en)), { class: 'k-cal-as' }) : null]),
          e.status ? h.el('span', { class: 'k-b-pill k-s-' + kind }, h.line(e.status)) : null]);
        a.addEventListener('click', function () { cb('onEvent', c.onEvent, e); });
        return h.el('li', null, a);
      };
      var paint = function () {
        var d = cur(), ds = agOnly ? days() : d ? [d] : [];
        cells.forEach(function (n) { var on = n.getAttribute('data-d') === d; n.setAttribute('aria-selected', on ? 'true' : 'false'); n.classList.toggle('k-cal-sel', on); });
        agBox.textContent = '';
        if (agOnly && !ds.length) agBox.appendChild(h.el('p', { class: 'k-cal-none', text: T.none }));
        ds.forEach(function (k) {
          var l = map[k] || [];
          agBox.appendChild(h.el('section', { class: 'k-cal-day' }, [h.el(hl(2), { class: 'k-cal-dh', text: fFull.format(D(k)) }), l.length ? h.el('ul', { class: 'k-cal-al', role: 'list' }, l.map(item)) : h.el('p', { class: 'k-cal-none', text: T.none })]));
        });
      };
      var rove = function (n) {
        cells.forEach(function (x) { x.tabIndex = -1; [].forEach.call(x.querySelectorAll(CH), function (y) { y.tabIndex = -1; }); });
        n.tabIndex = 0;
        [].forEach.call(n.querySelectorAll(CH), function (y) { y.tabIndex = 0; });
      };
      var pick = function (k) { st.sel = k; st.foc = k; paint(); cb('onSelect', c.onSelect, k); };

      if (!agOnly) {
        var fWd = F({ weekday: wide ? 'short' : 'narrow' }), fWl = F({ weekday: 'long' }), sun = D('2024-01-07'), hn = wn ? ' k-cal-hasn' : '';
        var wh = h.el('div', { class: 'k-cal-wk k-cal-wh' + hn, role: 'row' }, wn ? h.el('div', { class: 'k-cal-wn', role: 'columnheader', 'aria-label': 'Week', text: 'W' }) : null);
        for (var i = 0; i < 7; i++) { var wt = sun + ((ws + i) % 7) * DAY; wh.appendChild(h.el('div', { class: 'k-cal-wd', role: 'columnheader', 'aria-label': fWl.format(wt), text: fWd.format(wt) })); }
        var grid = h.el('div', { class: 'k-cal-g' + (wide ? '' : ' k-cal-sm'), role: 'grid', 'aria-labelledby': uid }, wh);
        var chip = function (v, t, ts) {
          var e = v.e, kind = e.status ? h.statusKind(e.status) : '', cls = 'k-cal-ev' + (t > v.s ? ' k-cal-ec' : '') + (t < v.en ? ' k-cal-en' : '') + (kind === 'crit' ? ' k-cal-x' : ''), b;
          var call = function (ev) { ev.stopPropagation(); cb('onEvent', c.onEvent, e); };
          if (ts !== t) { b = h.el('span', { class: cls, style: col(e), 'aria-hidden': 'true' }); b.addEventListener('click', call); return b; }
          var tm = !e.allDay && e.time ? String(e.time) : '', lab = [tm, e.title, e.status].filter(Boolean).join(', ');
          b = h.el(e.href ? 'a' : 'button', { class: cls, href: e.href, type: e.href ? null : 'button', style: col(e), title: lab, 'aria-label': lab, tabindex: '-1' }, [
            kind && kind !== 'neutral' ? h.el('span', { class: 'k-b-dot k-s-' + kind, 'aria-hidden': 'true' }) : null, tm ? h.el('span', { class: 'k-cal-tm k-b-nw', text: tm }) : null, h.line(e.title, { title: lab })]);
          b.addEventListener('click', call);
          return b;
        };
        var key = function (e) {
          var k = this.getAttribute('data-d'), t = D(k), wd = (new Date(t).getUTCDay() - ws + 7) % 7, n = e.key, to = null;
          if (e.target !== this) return;
          if (n === 'ArrowLeft' || n === 'ArrowRight') to = t + (n === 'ArrowLeft' ? -DAY : DAY);
          else if (n === 'ArrowUp' || n === 'ArrowDown') to = t + (n === 'ArrowUp' ? -7 : 7) * DAY;
          else if (n === 'Home' || n === 'End') to = t + (n === 'Home' ? -wd : 6 - wd) * DAY;
          else if (n === 'PageUp' || n === 'PageDown') { e.preventDefault(); var nd = addM(t, n === 'PageUp' ? -1 : 1); go(nd.slice(0, 7), nd, '[data-d="' + nd + '"]'); return; }
          else if (n === 'Enter' || n === ' ') { e.preventDefault(); pick(k); return; }
          else return;
          e.preventDefault();
          var k2 = iso(to);
          if (by[k2]) { st.foc = k2; by[k2].focus(); } else go(k2.slice(0, 7), k2, '[data-d="' + k2 + '"]');
        };
        for (var r = 0; r < rows; r++) {
          var t0 = first - off * DAY + r * 7 * DAY, t6 = t0 + 6 * DAY, lanes = [], wrow = h.el('div', { class: 'k-cal-wk' + hn, role: 'row' });
          if (wn) { var th = t0 + ((4 - ws + 7) % 7) * DAY, j4 = Date.UTC(new Date(th).getUTCFullYear(), 0, 4); wrow.appendChild(h.el('div', { class: 'k-cal-wn', role: 'rowheader', text: 1 + Math.round(((th - j4) / DAY - 3 + (new Date(j4).getUTCDay() + 6) % 7) / 7) })); }
          if (wide) evs.filter(function (v) { return v.multi && v.s <= t6 && v.en >= t0; }).forEach(function (v) {
            var l = 0;
            while (lanes[l] && lanes[l].end >= Math.max(v.s, t0)) l++;
            (lanes[l] = lanes[l] || { list: [] }).end = Math.min(v.en, t6);
            lanes[l].list.push(v);
          });
          for (var d = 0; d < 7; d++) {
            var t = t0 + d * DAY, k = iso(t), all = map[k] || [], n = all.length;
            var cell = h.el('div', { class: 'k-cal-c' + (k.slice(0, 7) === mon ? '' : ' k-cal-o') + (k === today ? ' k-cal-today' : ''), role: 'gridcell', 'data-d': k, tabindex: '-1', 'aria-current': k === today ? 'date' : null,
              'aria-label': fFull.format(t) + (n ? ', ' + n + ' ' + T.events : '') }, h.el('span', { class: 'k-cal-dn k-b-nw', text: new Date(t).getUTCDate() }));
            if (wide) {
              var one = all.filter(function (v) { return !v.multi; }), box = h.el('div', { class: 'k-cal-evs' });
              var slots = lanes.map(function (ln) { return ln.list.filter(function (v) { return v.s <= t && v.en >= t; })[0] || one.shift() || null; }).concat(one);
              var shown = slots.slice(0, max), seen = shown.filter(Boolean).length;
              shown.forEach(function (v) { box.appendChild(v ? chip(v, t, v.multi ? Math.max(v.s, t0) : t) : h.el('span', { class: 'k-cal-sp', 'aria-hidden': 'true' })); });
              if (n > seen) {
                var mb = h.el('button', { type: 'button', class: 'k-cal-more', tabindex: '-1', text: '+' + (n - seen) + ' ' + T.more });
                mb.addEventListener('click', function (ev) { ev.stopPropagation(); pick(this.closest('[data-d]').getAttribute('data-d')); });
                box.appendChild(mb);
              }
              cell.appendChild(box);
            } else if (n) cell.appendChild(h.el('span', { class: 'k-cal-dots', 'aria-hidden': 'true' }, all.slice(0, 3).map(function (v) { return h.el('i', { class: 'k-cal-dot', style: col(v.e) }); })));
            cell.addEventListener('click', function () { pick(this.getAttribute('data-d')); });
            cell.addEventListener('keydown', key);
            cell.addEventListener('focusin', function () { rove(this); });
            cells.push(cell); by[k] = cell; wrow.appendChild(cell);
          }
          grid.appendChild(wrow);
        }
        el.appendChild(grid);
        rove(by[st.foc && by[st.foc] ? st.foc : st.sel && by[st.sel] ? st.sel : today && by[today] && today.slice(0, 7) === mon ? today : mon + '-01']);
      }
      el.appendChild(agBox);
      paint();
      if (st.fc) { var fn = el.querySelector(st.fc); st.fc = null; if (fn) fn.focus(); }
    }
  });
})();
