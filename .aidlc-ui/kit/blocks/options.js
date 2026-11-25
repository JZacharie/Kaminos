/* @block options 1.0 -- Decision cards: 2 to 5 options, each with an impact grid, a recommended mark, a selected state and one confirm button.
 * Use for: Stagehand incidents (ranked options: impact on running order, crew, curfew; approve one), VoltRoute plan choice (lowest cost vs charge on arrival), any pick-one-and-confirm step.
 * Pick: Pick-one-and-confirm decision cards with an impact grid and a recommended mark (2-5 options); layout auto: compare or list by width.
 * Load: blocks.css, core.js, options.css, options.js
 * Call: K.block.options('#a-options', {items: [{id:'o1', rank:1, title:'Car from the kerb', recommended:true, cost:'EUR 95', impact:[{label:'Crew', value:'none'}]}], onApprove: function (item) {}})
 * Config:
 *   items      array, required  [{id?, rank?, title, summary?, impact?, recommended?, cost?}], shown in the given order, never recomputed
 *     id       text             on the card (stable a-... anchor); value of selected/approved
 *     rank     number           rank chip (1 = the agent's first choice)
 *     title    text, required   wraps; an unbreakable word steps down to one line + ellipsis + title
 *     summary  text             1-2 sentences
 *     impact   array            [{label, value, tone?}] rows of a 2-column label | value grid; tone ok|warn|crit|info|neutral (neutral = muted, use for "none")
 *     recommended boolean       "Recommended" mark
 *     cost     text|number      headline figure top right ("EUR 95"), shown as given
 *   selected   text             id preselected (default none)
 *   approved   text             id approved: cards lock, that card shows "Approved"
 *   onApprove  function(item)   confirm pressed; the block then shows the approved state itself unless you pass approved
 *   onSelect   function(item)   selection changed
 *   approveLabel "Approve", approvedLabel "Approved", costLabel "Cost"  texts
 *   layout     'list'|'compare'|'auto', default 'list'  list = stacked (impact beside the text from 680 px); compare = side by side, balanced rows; auto = compare when the block is wide enough for one row of minCard cards (measured on the block, so a 5/12 column lists and a full row compares), else list
 *   minCard    number, default 240  compare: minimum card width
 *   confirm    boolean, default true  false = no confirm bar
 *   readOnly   boolean          cards cannot be chosen; the bar shows lockedText (text, default "Only the production manager can approve")
 *   (common)   title (accessible name of the group; frame is off), state, emptyText, errorText
 * States: empty, loading, error, bad config, none selected (confirm disabled), selected, approved, read only.
 * Keyboard: Tab to the group, arrows move and select, Tab to the confirm button.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] options: load core.js before options.js'); return; }
  var warnedCb = {};
  var cb = function (name, fn, arg) {
    if (typeof fn !== 'function') return;
    try { fn(arg); } catch (e) {
      var m = '[K.block] options: ' + name + ' threw: ' + String((e && e.message) || e).slice(0, 120);
      if (!warnedCb[m]) { warnedCb[m] = 1; console.warn(m); }
    }
  };
  K.block.define('options', {
    version: '1.0',
    frame: false,
    resize: true,
    emptyText: 'No options proposed yet',
    schema: {
      items: { type: 'array', required: true, of: {
        id: { type: 'text' }, rank: { type: 'number' }, title: { type: 'text', required: true }, summary: { type: 'text' },
        impact: { type: 'array', of: { label: { type: 'text', required: true }, value: { type: 'text', required: true }, tone: { type: 'string' } } },
        recommended: { type: 'boolean' }, cost: { type: 'text' } } },
      selected: { type: 'text' }, approved: { type: 'text' },
      onApprove: { type: 'function' }, onSelect: { type: 'function' },
      approveLabel: { type: 'text', default: 'Approve' }, approvedLabel: { type: 'text', default: 'Approved' }, costLabel: { type: 'text', default: 'Cost' },
      layout: { type: 'string', enum: ['list', 'compare', 'auto'], default: 'list' },
      minCard: { type: 'number', default: 240 },
      confirm: { type: 'boolean', default: true },
      readOnly: { type: 'boolean', default: false },
      lockedText: { type: 'text', default: 'Only the production manager can approve' }
    },
    empty: function (c) { return !c.items.length; },
    render: function (el, c, h) {
      var items = c.items, n = items.length, w = el.clientWidth || 720, gap = 16, compare = c.layout === 'compare' || (c.layout === 'auto' && w >= n * Math.max(160, c.minCard) + (n - 1) * gap); /* auto: side by side when every card gets minCard in one row, else stacked */
      var ids = items.map(function (it, i) { return it.id != null ? String(it.id) : 'opt-' + (i + 1); });
      var st = el._kOpt;
      if (!st || st.s0 !== c.selected || st.a0 !== c.approved) st = el._kOpt = { s0: c.selected, a0: c.approved, sel: c.selected != null ? String(c.selected) : null, app: c.approved != null ? String(c.approved) : null };
      if (ids.indexOf(st.sel) < 0) st.sel = null;
      if (ids.indexOf(st.app) < 0) st.app = null;
      var locked = function () { return c.readOnly || st.app != null; };

      var cols = 1;
      if (compare) {
        var fit = Math.max(1, Math.floor((w + gap) / (Math.max(160, c.minCard) + gap)));
        cols = Math.min(n, Math.ceil(n / Math.ceil(n / Math.min(fit, n))));
      }
      var wide = !compare && w >= 680;
      var group = h.el('div', { class: 'k-opt-group' + (compare ? ' k-opt-compare' : ' k-opt-list') + (wide ? ' k-opt-wide' : ''), role: 'radiogroup',
        'aria-label': c.title != null ? String(c.title) : 'Options', style: compare ? { '--k-opt-cols': cols } : null });
      var cards = [], guards = [];
      items.forEach(function (it, i) {
        var uid = h.uid('opt');
        var head = h.el('div', { class: 'k-opt-head' }, [
          h.el('span', { class: 'k-opt-radio', 'aria-hidden': 'true' }),
          it.rank != null ? h.el('span', { class: 'k-opt-rank k-b-num', title: 'Rank ' + it.rank, text: it.rank }) : null,
          h.el('span', { class: 'k-opt-approved', 'aria-hidden': 'true', text: '\u2713 ' + c.approvedLabel }),
          it.recommended ? h.el('span', { class: 'k-opt-rec', text: 'Recommended' }) : null]);
        var cost = it.cost != null && it.cost !== '' ? h.el('div', { class: 'k-opt-cost' + (String(it.cost).length > 18 ? ' k-opt-cost-long' : ''), title: c.costLabel + ' ' + it.cost }, [
          h.el('span', { class: 'k-opt-cost-l', text: c.costLabel }), h.el('span', { class: 'k-opt-cost-v' }, h.nowrap(typeof it.cost === 'number' ? h.num(it.cost) : it.cost))]) : null;
        var title = h.el('div', { class: 'k-opt-title', id: uid + '-t', title: String(it.title) }, h.nowrap(it.title));
        var sum = it.summary != null && it.summary !== '' ? h.el('p', { class: 'k-opt-sum', id: uid + '-s', title: String(it.summary) }, h.nowrap(it.summary)) : null;
        var dl = null;
        if (it.impact && it.impact.length) {
          dl = h.el('dl', { class: 'k-opt-impact', id: uid + '-i' });
          var rowsI = it.impact;
          /* every row is "none": one quiet line instead of a table of nothing (the given labels are kept) */
          if (rowsI.length > 1 && rowsI.every(function (r) { return (!r.tone || h.statusKind(r.tone) === 'neutral') && /^\s*none\s*$/i.test(String(r.value)); }))
            rowsI = [{ label: 'Impact', value: 'No impact on ' + rowsI.map(function (r) { return String(r.label).toLowerCase(); }).join(', '), tone: 'neutral' }];
          rowsI.forEach(function (r) {
            var kind = r.tone ? h.statusKind(r.tone) : '', v = typeof r.value === 'number' ? h.num(r.value) : String(r.value);
            if (!kind && /^\s*(none|no change|no impact|n\/a|nothing|[-\u2013\u2014])\s*$/i.test(v)) kind = 'neutral'; /* "no impact" is quiet, so the real impacts stand out */
            var hot = kind && kind !== 'neutral';
            var vv = h.el('span', { class: 'k-opt-v' }, [hot ? h.el('span', { class: 'k-b-dot k-s-' + kind, 'aria-hidden': 'true' }) : null, h.el('span', { class: 'k-opt-vt' }, h.nowrap(v))]);
            dl.appendChild(h.el('dt', { class: 'k-opt-k', title: String(r.label), text: r.label }));
            dl.appendChild(h.el('dd', { class: 'k-opt-d' + (hot ? ' k-s-' + kind : kind === 'neutral' ? ' k-opt-d-mute' : ''), title: v }, [vv]));
          });
        }
        var card = h.el('div', { class: 'k-opt' + (cost ? ' k-opt-has-cost' : '') + (dl ? ' k-opt-has-impact' : ''), role: 'radio', id: it.id != null ? String(it.id) : null,
          'aria-labelledby': uid + '-t', 'aria-describedby': [sum ? uid + '-s' : '', dl ? uid + '-i' : ''].join(' ').trim() || null,
          'data-opt': ids[i], 'data-recommended': it.recommended ? 'true' : null }, [head, cost, title, sum, dl]);
        cards.push(card);
        group.appendChild(card);
        guards.push(title, sum);
        if (dl) [].forEach.call(dl.querySelectorAll('dt'), function (v) { guards.push(v); });
        if (dl) [].forEach.call(dl.querySelectorAll('.k-opt-vt'), function (v) { guards.push(v); });
      });
      el.appendChild(group);

      // confirm bar
      var bar = null, barText = null, btn = null;
      if (c.confirm) {
        barText = h.el('div', { class: 'k-opt-bar-t' });
        btn = h.el('button', { class: 'k-b-btn k-b-btn-primary k-opt-go', type: 'button', text: c.approveLabel });
        bar = h.el('div', { class: 'k-opt-bar' }, [barText, btn]);
        el.appendChild(bar);
      }
      var titleOf = function (id) { var k = ids.indexOf(id); return k < 0 ? '' : String(items[k].title); };
      var paint = function () {
        var first = st.sel != null ? ids.indexOf(st.sel) : 0, lock = locked();
        cards.forEach(function (card, i) {
          var on = ids[i] === st.sel || ids[i] === st.app;
          card.setAttribute('aria-checked', on ? 'true' : 'false');
          card.setAttribute('data-selected', ids[i] === st.sel ? 'true' : 'false');
          card.setAttribute('data-approved', ids[i] === st.app ? 'true' : 'false');
          card.setAttribute('data-dim', st.app != null && ids[i] !== st.app ? 'true' : 'false');
          if (lock) { card.removeAttribute('tabindex'); card.setAttribute('aria-disabled', 'true'); } else { card.setAttribute('tabindex', i === first ? '0' : '-1'); card.removeAttribute('aria-disabled'); }
        });
        group.classList.toggle('k-opt-locked', lock);
        if (!bar) return;
        barText.textContent = '';
        if (st.app != null) {
          barText.appendChild(h.el('span', { class: 'k-opt-bar-pill k-b-pill k-s-ok', text: c.approvedLabel }));
          barText.appendChild(h.el('span', { class: 'k-opt-bar-n k-b-line', title: titleOf(st.app) }, [h.el('span', { text: titleOf(st.app) })]));
          btn.hidden = true;
        } else if (c.readOnly) {
          barText.appendChild(h.el('span', { class: 'k-opt-bar-m k-b-line', title: String(c.lockedText) }, [h.el('span', { text: '\ud83d\udd12 ' + c.lockedText })]));
          btn.hidden = true;
        } else {
          btn.hidden = false;
          btn.disabled = st.sel == null;
          if (st.sel == null) barText.appendChild(h.el('span', { class: 'k-opt-bar-m k-b-line' }, [h.el('span', { text: 'Select an option to continue' })]));
          else {
            barText.appendChild(h.el('span', { class: 'k-opt-bar-l', text: 'Selected' }));
            barText.appendChild(h.el('span', { class: 'k-opt-bar-n k-b-line', title: titleOf(st.sel) }, [h.el('span', { text: titleOf(st.sel) })]));
          }
        }
      };
      var select = function (i, focus) {
        if (locked() || i < 0 || i >= n) return;
        var changed = st.sel !== ids[i];
        st.sel = ids[i];
        paint();
        if (focus) cards[i].focus();
        if (changed) cb('onSelect', c.onSelect, items[i]);
      };
      cards.forEach(function (card, i) {
        card.addEventListener('click', function () { select(i, false); });
        card.addEventListener('keydown', function (e) {
          var k = e.key, to = -1;
          if (locked()) return;
          if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
          else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i + n - 1) % n;
          else if (k === 'Home') to = 0;
          else if (k === 'End') to = n - 1;
          else if (k === ' ' || k === 'Enter') to = i;
          if (to < 0) return;
          e.preventDefault();
          select(to, true);
        });
      });
      if (btn) btn.addEventListener('click', function () {
        var k = ids.indexOf(st.sel);
        if (k < 0 || locked()) return;
        st.app = ids[k];
        paint();
        cb('onApprove', c.onApprove, items[k]);
      });
      paint();
      // text that cannot break (an id, a code) steps down to one line with an ellipsis; the full text stays in title
      guards.forEach(function (g) { if (g && g.scrollWidth > g.clientWidth + 1) { g.classList.add('k-opt-one'); g.setAttribute('title', g.textContent); } });
    }
  });
})();
