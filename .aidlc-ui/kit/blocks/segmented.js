/* @block segmented 1.0 -- Single-choice switch: a row of options of which exactly one is selected (depot, day, mode, view).
 * Use for: E depot switch (Trafford Park / Salford), G Friday / Saturday, S mode filter on the map (All / Truck / Ship / Air). 2 to about 8 short options.
 * Pick: A single-choice switch of 2 to 8 short options (depot, day, view, mode).
 * Load: blocks.css, core.js, segmented.css, segmented.js
 * Call: K.block.segmented('#a-depot', {label:'Depot', options:[{value:'TP', label:'Trafford Park', count:11}, {value:'SQ', label:'Salford Quays', count:7}], value:'TP', onChange:function(v){}})
 * Config:
 *   options   array, required  [{value, label, count?, disabled?}]
 *     value   text, required   the value reported to onChange (string or number)
 *     label   text, required   shown text, one line (ellipsis + title past 16rem)
 *     count   number|text      small muted number after the label (the app's own figure, shown as given)
 *     disabled boolean         cannot be chosen
 *   value     text             selected option value; none selected when absent or unknown (the first option stays reachable with Tab)
 *   onChange  function         onChange(value, option) after the user picks; the block shows the choice at once (it calls update({value}) itself)
 *   label     text             caption on the left ("Depot"), also the accessible name of the group
 *   (common)  state, emptyText, errorText, headingLevel; frame is off: it is a control, put it where you need it
 * Behaviour: one tab stop; arrows (and Home / End) move and select, like a radio group. A row wider than its container scrolls inside itself, edges fade, and the selected
 *   option is scrolled into view: a chip never wraps onto a second line.
 * States: empty (no options), loading, error, bad config (inline error).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] segmented: load core.js before segmented.js'); return; }
  K.block.define('segmented', {
    version: '1.0',
    frame: false,
    compact: true,
    emptyText: 'No options',
    schema: {
      options: { type: 'array', required: true, of: { value: { type: 'text', required: true }, label: { type: 'text', required: true }, count: { type: 'text' }, disabled: { type: 'boolean' } } },
      value: { type: 'text' },
      onChange: { type: 'function' },
      label: { type: 'text' }
    },
    empty: function (c) { return !c.options.length; },
    render: function (el, c, h) {
      var E = h.el, uid = h.uid('k-seg'), sel = String(c.value == null ? '' : c.value), btns = [];
      var scroller = E('div', { class: 'k-seg-scroll' });
      var group = E('div', { class: 'k-seg', role: 'radiogroup', 'aria-labelledby': c.label != null ? uid : null, 'aria-label': c.label == null ? 'Options' : null });
      var hasSel = c.options.some(function (o) { return String(o.value) === sel && !o.disabled; });
      c.options.forEach(function (o, i) {
        var on = String(o.value) === sel, tab = on || (!hasSel && i === c.options.findIndex(function (x) { return !x.disabled; }));
        var b = E('button', { class: 'k-seg-opt', type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', tabindex: tab ? '0' : '-1', disabled: o.disabled ? true : null, title: String(o.label) + (o.count != null ? ' (' + o.count + ')' : '') }, [
          E('span', { class: 'k-seg-t' }, E('span', { text: o.label })),
          o.count != null && o.count !== '' ? E('span', { class: 'k-seg-n', text: typeof o.count === 'number' ? h.num(o.count) : o.count }) : null]);
        b._opt = o;
        btns.push(b); group.appendChild(b);
      });
      scroller.appendChild(group);
      var arrow = function (dir, ch) { return E('button', { class: 'k-seg-arrow', type: 'button', tabindex: '-1', 'aria-hidden': 'true', hidden: true, text: ch, on: { click: function () { scroller.scrollBy({ left: dir * Math.max(80, scroller.clientWidth * 0.6), behavior: 'smooth' }); } } }); };
      var aL = arrow(-1, '\u2039'), aR = arrow(1, '\u203a');
      var wrap = E('div', { class: 'k-seg-wrap' }, [c.label != null ? E('span', { class: 'k-seg-label', id: uid, text: c.label }) : null, aL, scroller, aR]);
      el.appendChild(wrap);

      var pick = function (b, focus) {
        var left = scroller.scrollLeft;
        if (b._opt.disabled) return;
        var handle = el._kBlock;
        if (typeof c.onChange === 'function') { try { c.onChange(b._opt.value, b._opt); } catch (e) { console.warn('[K.block] segmented: onChange threw: ' + String((e && e.message) || e).slice(0, 120)); } }
        if (handle) handle.update({ value: b._opt.value });
        var s = el.querySelector('.k-seg-scroll');
        if (s) s.scrollLeft = left;
        if (focus) { var nb = [].filter.call(el.querySelectorAll('.k-seg-opt'), function (x) { return x._opt === undefined ? false : String(x._opt.value) === String(b._opt.value); })[0]; if (nb) nb.focus(); }
      };
      btns.forEach(function (b) {
        b.addEventListener('click', function () { if (b.getAttribute('aria-checked') !== 'true') pick(b, b === document.activeElement); });
        b.addEventListener('keydown', function (e) {
          var on = btns.filter(function (x) { return !x._opt.disabled; }), i = on.indexOf(b), n = on.length, to = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = on[(i + 1) % n];
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = on[(i - 1 + n) % n];
          else if (e.key === 'Home') to = on[0];
          else if (e.key === 'End') to = on[n - 1];
          if (to) { e.preventDefault(); pick(to, true); }
        });
      });

      // scroll in place: fade the edges that have more content, keep the selected option in view
      var edges = function () {
        var max = scroller.scrollWidth - scroller.clientWidth, over = max > 2;
        aL.hidden = aR.hidden = !over;
        if (over) { aL.disabled = scroller.scrollLeft <= 2; aR.disabled = scroller.scrollLeft >= max - 2; }
        wrap.classList.toggle('k-seg-fade-l', scroller.scrollLeft > 2);
        wrap.classList.toggle('k-seg-fade-r', max > 2 && scroller.scrollLeft < max - 2);
      };
      scroller.addEventListener('scroll', edges);
      edges();
      var cur = btns.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0];
      if (cur && scroller.scrollWidth > scroller.clientWidth) {
        var sb = scroller.getBoundingClientRect(), at = function (n) { return n.getBoundingClientRect().left - sb.left + scroller.scrollLeft; };
        var x0 = at(cur), x1 = x0 + cur.offsetWidth, v0 = scroller.scrollLeft, v1 = v0 + scroller.clientWidth;
        // start the visible window on the option before the selected one, so no label is cut at the left edge
        if (x0 < v0 + 4 || x1 > v1 - 4) { var prev = cur.previousElementSibling; scroller.scrollLeft = Math.max(0, (prev && x1 - at(prev) <= scroller.clientWidth - 8 ? at(prev) : x0) - 4); }
      }
      edges();
      h.resizeObserver(el, edges);
    }
  });
})();
