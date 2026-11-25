/* @block steps 1.0 -- stepper: milestones or legs in order, each with planned and actual time and a status.
 * Use for: SpudTrack shipment legs (carrier, planned, actual), EV Fleet tomorrow's route stops, Stagehand artist arrival chain (flight, shuttle, gate, soundcheck).
 * Pick: Ordered milestones or legs with planned and actual times and a status (journey, arrival chain).
 * Load: blocks.css, core.js, steps.css, steps.js
 * Call: K.block.steps('#a-legs', {steps:[{label:'Zaragoza', planned:'08:00', actual:'08:10', status:'done'}, {label:'Madrid DC', planned:'14:00', status:'in progress'}]})
 * Config:
 *   steps        array, required  [{label, sub?, planned?, actual?, status?, statusText?, meta?, href?}] in order
 *     label      text, required   place or milestone; wraps at words (2 lines max), else one line with "..." and a tooltip
 *     sub        text             muted text under the label (carrier, mode); wraps to 2 lines, then "..." with a tooltip
 *     planned    time             planned time as given ("14:00", "Today 14:00"; an ISO date-time or a JS Date is formatted: clock time on today's date, else day and time); a time never wraps inside
 *     actual     time             actual or estimated time as given; tinted when the status is warn/crit. The block never computes delays or ETAs.
 *     status     text             done|ok = check, active|in progress|info = ring, delayed|at risk|warn = "!", blocked|crit = cross, else (also waiting, pending, queued, upcoming) = neutral empty ring, never "!"
 *     statusText text             the status word shown beside the label (default = status)
 *     meta       text             extra muted line (2 lines max, tooltip)
 *     href       string           the label becomes a link
 *   orientation  'h'|'v', default 'h'  horizontal falls back to vertical when a step would get less than minStepWidth
 *   minStepWidth number, default 128   plannedLabel text, default "Planned"   actualLabel text, default "Actual"
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: empty (no steps), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] steps: load core.js before steps.js'); return; }
  // not started yet is neutral here (core files these words under warn, which suits a table pill but not a step that simply has not begun)
  var WAIT = /^(waiting|pending|queued|upcoming|not started|to do|todo)$/i;
  var GLYPH = { ok: '\u2713', warn: '!', crit: '\u2715', info: '', neutral: '' };
  var fmt = function (h, v) { return /^\d{4}-\d\d-\d\dT/.test(String(v)) ? h.datetime(v) : String(v); };
  // lines needed to wrap text at word breaks in w px; Infinity when one word is wider than w
  var lines = function (h, text, font, w) {
    var ws = String(text).split(/\s+/).filter(Boolean), n = 1, cur = 0, sp = h.measureText(' ', font);
    for (var i = 0; i < ws.length; i++) {
      var x = h.measureText(ws[i], font);
      if (x > w) return Infinity;
      if (cur && cur + sp + x > w) { n++; cur = x; } else cur += (cur ? sp : 0) + x;
    }
    return n;
  };
  K.block.define('steps', {
    version: '1.0',
    resize: true,
    emptyText: 'No steps yet',
    schema: {
      steps: { type: 'array', required: true, of: { label: { type: 'text', required: true }, sub: { type: 'text' }, planned: { type: 'time' }, actual: { type: 'time' },
        status: { type: 'text' }, statusText: { type: 'text' }, meta: { type: 'text' }, href: { type: 'string' } } },
      orientation: { type: 'string', enum: ['h', 'v'], default: 'h' },
      minStepWidth: { type: 'number', default: 128 },
      plannedLabel: { type: 'text', default: 'Planned' }, actualLabel: { type: 'text', default: 'Actual' }
    },
    empty: function (c) { return !c.steps.length; },
    render: function (el, c, h) {
      var n = c.steps.length, w = el.clientWidth || 960, horiz = c.orientation === 'h' && w / n >= Math.max(96, c.minStepWidth);
      var fam = getComputedStyle(el).fontFamily, r = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      var FL = '600 ' + 0.8125 * r + 'px ' + fam, colW = horiz ? Math.floor(w / n) - 20 : w - 40;
      var wrap = h.el('ol', { class: 'k-steps ' + (horiz ? 'k-steps-h' : 'k-steps-v' + (w >= 560 ? ' k-steps-wide' : '')), style: horiz ? { '--k-steps-n': n } : null });
      c.steps.forEach(function (st, i) {
        var kind = WAIT.test(String(st.status == null ? '' : st.status).trim()) ? 'neutral' : h.statusKind(st.status), word = st.statusText != null ? st.statusText : st.status;
        var cur = /^(active|in progress|live|current)$/i.test(String(st.status || '')) || kind === 'info';
        var mk = h.el('span', { class: 'k-steps-mk k-s-' + kind + (cur ? ' k-steps-cur' : '') + (kind === 'neutral' && !cur ? ' k-steps-wait' : ''), 'aria-hidden': 'true', text: GLYPH[kind] });
        var rail = h.el('span', { class: 'k-steps-rail' }, [mk, i < n - 1 ? h.el('span', { class: 'k-steps-ln' + (kind === 'ok' || kind === 'warn' || kind === 'crit' ? ' k-steps-ln-done k-s-' + kind : '') }) : null]);
        var lab = lines(h, st.label, FL, colW) <= 2 ? h.el('span', { class: 'k-steps-lab', title: String(st.label) }, h.rich(st.label)) : h.line(st.label, { class: 'k-steps-lab k-steps-lab1' });
        if (st.href) { var a = h.el('a', { class: 'k-steps-a', href: st.href }); a.appendChild(lab); lab = a; }
        var tm = [];
        if (st.planned != null && st.planned !== '') tm.push(h.el('span', { class: 'k-steps-tm' }, [h.el('span', { class: 'k-steps-k', text: c.plannedLabel }), h.el('span', { class: 'k-steps-v k-b-num', text: fmt(h, st.planned) })]));
        if (st.actual != null && st.actual !== '') tm.push(h.el('span', { class: 'k-steps-tm' + (kind === 'warn' || kind === 'crit' ? ' k-steps-late k-s-' + kind : '') }, [h.el('span', { class: 'k-steps-k', text: c.actualLabel }), h.el('span', { class: 'k-steps-v k-b-num', text: fmt(h, st.actual) })]));
        var body = h.el('div', { class: 'k-steps-body' }, [
          h.el('div', { class: 'k-steps-top' }, [lab, word != null && word !== '' ? h.el('span', { class: 'k-b-pill k-s-' + kind, text: word, title: String(word) }) : null]),
          h.el('div', { class: 'k-steps-rest' }, [
            st.sub != null ? h.el('div', { class: 'k-steps-sub', title: String(st.sub), text: String(st.sub) }) : null,
            tm.length ? h.el('div', { class: 'k-steps-times' }, tm) : null,
            st.meta != null ? h.el('div', { class: 'k-steps-meta', title: String(st.meta) }, h.rich(st.meta)) : null])]);
        wrap.appendChild(h.el('li', { class: 'k-steps-i', 'aria-current': cur ? 'step' : null }, [rail, body]));
      });
      el.appendChild(wrap);
    }
  });
})();
