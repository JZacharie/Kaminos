/* @block filterbar 1.0 -- One-line filter strip: single or multi choice chips, menus when they do not fit, optional search, reset.
 * Use for: above a table, map or feed (SpudTrack shipments: mode, status, direction; EV Fleet vans: depot, model, status; Stagehand: stage, day).
 * Pick: The one-line filter strip (chips, menus, search, reset) above a table, map or feed.
 * Load: blocks.css, core.js, filterbar.css, filterbar.js
 * Call: K.block.filterbar('#a-filters', {groups: [{key: 'status', label: 'Status', options: [{value: 'Delayed'}]}], search: {placeholder: 'Search id or carrier'}, onChange: function (v) {}})
 * Config:
 *   groups     array, default []  [{key, label?, options, multi?, allLabel?, menu?}]
 *     key      string, required   name of the field in `value`
 *     label    text               caption before the chips ("Status"); defaults to the key
 *     options  array, required    [{value, label?, count?}]; value text, label defaults to value, count is shown muted
 *     multi    boolean            several options at once (value is an array); default single choice (value is a string)
 *     allLabel text               label of the "clear" chip, default "All"
 *     menu     boolean            always a dropdown menu instead of chips (automatic above `chipsMax` options or when the strip is too narrow)
 *   search     object             {placeholder?, label?}; its text is value.q; the input grows to fit the placeholder (180-340 px)
 *   value      object             current selection {groupKey: 'x' | ['x','y'], q: 'text'}; a new object from the app replaces the state
 *   onChange   function(value)    called with a copy of the whole value after each change (search is debounced 150 ms)
 *   reset      boolean, default true  shows a "Reset" button while something is selected
 *   chipsMax   number, default 6  groups with more options are menus
 *   (common)   state, emptyText, headingLevel (frame is off: the bar sits inside your card)
 * States: empty (no groups and no search), bad config (inline error). Chips never wrap: groups that do not fit become menus, then whole menus wrap onto a second line.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] filterbar: load core.js before filterbar.js'); return; }
  var sel = function (v) { return Array.isArray(v) ? v.map(String) : (v == null || v === '' ? [] : [String(v)]); };
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  var copy = function (o) { var r = {}; for (var k in o || {}) r[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return r; };
  K.block.define('filterbar', {
    version: '1.0',
    frame: false,
    emptyText: 'No filters',
    schema: {
      groups: { type: 'array', default: [], of: {
        key: { type: 'string', required: true }, label: { type: 'text' }, multi: { type: 'boolean' }, allLabel: { type: 'text' }, menu: { type: 'boolean' },
        options: { type: 'array', required: true, of: { value: { type: 'text', required: true }, label: { type: 'text' }, count: { type: 'number' } } } } },
      search: { type: 'object' }, value: { type: 'object' }, onChange: { type: 'function' },
      reset: { type: 'boolean', default: true }, chipsMax: { type: 'number', default: 6 }
    },
    empty: function (c) { return !c.groups.length && !c.search; },
    render: function (el, c, h) {
      var S = h.fb || (h.fb = { last: undefined, v: {}, open: null });
      if (c.value !== S.last) { S.last = c.value; S.v = copy(c.value); }
      var root = h.el('div', { class: 'k-fb' }), strip = h.el('div', { class: 'k-fb-strip' }), timer, input, pop;
      if (c.groups.length) root.appendChild(strip);
      var emit = function () { if (c.onChange) { try { c.onChange(copy(S.v)); } catch (e) { console.warn('[K.block] filterbar: onChange threw ' + e.message); } } };
      var active = function () { return !!(S.v.q || c.groups.some(function (g) { return sel(S.v[g.key]).length; })); };
      var optLabel = function (g, val) { var o = g.options.filter(function (x) { return String(x.value) === val; })[0]; return o ? String(o.label != null ? o.label : o.value) : val; };
      var set = function (g, val) {
        var cur = sel(S.v[g.key]), s = String(val);
        if (val === null) delete S.v[g.key];
        else if (g.multi) { var i = cur.indexOf(s); if (i < 0) cur.push(s); else cur.splice(i, 1); if (cur.length) S.v[g.key] = cur; else delete S.v[g.key]; }
        else if (cur[0] === s) delete S.v[g.key]; else S.v[g.key] = s;
        if (!g.multi) S.open = null;
        draw(true); emit();
      };
      var chips = function (g) {
        var cur = sel(S.v[g.key]), grp = h.el('div', { class: 'k-fb-group', role: 'group', 'aria-label': String(g.label != null ? g.label : cap(g.key)) });
        var box = h.el('div', { class: 'k-fb-chips' });
        var chip = function (label, on, count, fid, fn, title) {
          return h.el('button', { type: 'button', class: 'k-fb-chip', 'aria-pressed': on ? 'true' : 'false', 'data-fid': fid, title: title || label, on: { click: fn } },
            [h.el('span', { text: label }), count != null ? h.el('span', { class: 'k-fb-n', text: h.num(count) }) : null]);
        };
        box.appendChild(chip(g.allLabel != null ? String(g.allLabel) : 'All', !cur.length, null, g.key + '|', function () { set(g, null); }));
        g.options.forEach(function (o) { var l = String(o.label != null ? o.label : o.value); box.appendChild(chip(l, cur.indexOf(String(o.value)) >= 0, o.count, g.key + '|' + o.value, function () { set(g, o.value); })); });
        grp.appendChild(h.el('span', { class: 'k-fb-lab', text: g.label != null ? g.label : cap(g.key) }));
        grp.appendChild(box);
        return grp;
      };
      var menu = function (g) {
        var cur = sel(S.v[g.key]), lab = g.label != null ? g.label : cap(g.key), all = g.allLabel != null ? String(g.allLabel) : 'All';
        var txt = !cur.length ? all : optLabel(g, cur[0]) + (cur.length > 1 ? ' +' + (cur.length - 1) : '');
        return h.el('div', { class: 'k-fb-group' }, [h.el('button', { type: 'button', class: 'k-fb-menubtn' + (cur.length ? ' k-fb-on' : ''), 'data-fid': g.key + '|menu', 'aria-haspopup': 'listbox', 'aria-expanded': S.open === g.key ? 'true' : 'false', title: lab + ': ' + txt,
          on: { click: function () { S.open = S.open === g.key ? null : g.key; draw(true); } } },
          [h.el('span', { class: 'k-fb-mt' }, [h.el('span', { class: 'k-fb-lab', text: lab + ':' }), h.el('span', { class: 'k-fb-val', text: txt })]), h.svg('svg', { width: 10, height: 10, viewBox: '0 0 10 10', 'aria-hidden': 'true' }, [h.svg('path', { d: 'M2 3.5l3 3 3-3', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })])])]);
      };
      var popover = function (g) {
        var cur = sel(S.v[g.key]), p = h.el('div', { class: 'k-fb-pop', role: 'listbox', 'aria-label': String(g.label != null ? g.label : cap(g.key)), 'aria-multiselectable': g.multi ? 'true' : null });
        var item = function (label, on, count, fid, fn) {
          return h.el('button', { type: 'button', role: 'option', class: 'k-fb-opt' + (g.multi ? ' k-fb-multi' : ''), 'aria-selected': on ? 'true' : 'false', 'data-fid': fid, title: label, on: { click: fn } },
            [h.el('span', { class: 'k-fb-tick', 'aria-hidden': 'true' }), h.el('span', { class: 'k-b-line', text: label }), count != null ? h.el('span', { class: 'k-fb-n', text: h.num(count) }) : null]);
        };
        p.appendChild(item(g.allLabel != null ? String(g.allLabel) : 'All', !cur.length, null, g.key + '|', function () { set(g, null); }));
        g.options.forEach(function (o) { p.appendChild(item(String(o.label != null ? o.label : o.value), cur.indexOf(String(o.value)) >= 0, o.count, g.key + '|' + o.value, function () { set(g, o.value); })); });
        return p;
      };
      var fits = function () { return strip.scrollWidth <= strip.clientWidth + 1; };
      var draw = function (keepFocus) {
        var fid = keepFocus && document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-fid') : null;
        strip.classList.remove('k-fb-wrap');
        var menus = {}, build = function () {
          strip.textContent = '';
          if (pop) { pop.remove(); pop = null; }
          c.groups.forEach(function (g) { strip.appendChild(menus[g.key] ? menu(g) : chips(g)); });
          if (c.reset && active()) strip.appendChild(h.el('button', { type: 'button', class: 'k-fb-reset', text: 'Reset', title: 'Clear all filters', 'data-fid': 'reset', on: { click: function () {
            S.v = {}; S.open = null; if (input) input.value = ''; draw(false); emit(); } } }));
        };
        c.groups.forEach(function (g) { if (g.menu || g.options.length > c.chipsMax) menus[g.key] = 1; });
        build();
        while (!fits()) {
          var best = null;
          c.groups.forEach(function (g) { if (!menus[g.key] && (!best || g.options.length > best.options.length)) best = g; });
          if (!best) break;
          menus[best.key] = 1; build();
        }
        strip.classList.toggle('k-fb-wrap', !fits()); // last resort: whole menus wrap onto a second line, nothing is ever cut
        var og = S.open && c.groups.filter(function (g) { return g.key === S.open && menus[g.key]; })[0];
        if (og) {
          pop = root.appendChild(popover(og));
          var b = strip.querySelector('[data-fid="' + og.key + '|menu"]'), r = b.getBoundingClientRect(), pw = Math.max(176, r.width);
          pop.style.minWidth = pw + 'px';
          pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
          pop.style.top = (r.bottom + 4) + 'px';
        } else S.open = null;
        if (fid) { var f = root.querySelector('[data-fid="' + fid + '"]'); if (f) f.focus(); }
      };
      if (c.search) {
        var ph = String(c.search.placeholder != null ? c.search.placeholder : 'Search'), lab = String(c.search.label != null ? c.search.label : ph);
        var w = Math.max(180, Math.min(340, Math.ceil(h.measureText(ph, '400 ' + (0.8125 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)) + 'px ' + getComputedStyle(el).fontFamily) + 64)));
        var clear = h.el('button', { type: 'button', class: 'k-fb-clear', 'aria-label': 'Clear search', title: 'Clear search', hidden: S.v.q ? null : true, text: '\u00d7',
          on: { click: function () { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); } } });
        input = h.el('input', { type: 'text', class: 'k-fb-input', placeholder: ph, 'aria-label': lab, title: ph, autocomplete: 'off', spellcheck: 'false' });
        input.value = S.v.q || '';
        input.addEventListener('input', function () {
          if (input.value) S.v.q = input.value; else delete S.v.q;
          clear.hidden = !input.value; draw(true);
          clearTimeout(timer); timer = setTimeout(emit, 150);
        });
        input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && input.value) { input.value = ''; input.dispatchEvent(new Event('input')); } });
        root.appendChild(h.el('div', { class: 'k-fb-search', style: { '--k-fb-w': w + 'px' } }, [
          h.svg('svg', { width: 14, height: 14, viewBox: '0 0 14 14', class: 'k-fb-mag', 'aria-hidden': 'true' }, [h.svg('circle', { cx: 6, cy: 6, r: 4.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }), h.svg('path', { d: 'M9.3 9.3L12.5 12.5', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })]),
          input, clear]));
      }
      el.appendChild(root);
      draw(false);
      var close = function (e) { if (S.open && !(pop && pop.contains(e.target)) && !(e.target.closest && e.target.closest('.k-fb-menubtn'))) { S.open = null; draw(false); } };
      var esc = function (e) { if (e.key === 'Escape' && S.open) { var k = S.open; S.open = null; draw(false); var b = strip.querySelector('[data-fid="' + k + '|menu"]'); if (b) b.focus(); } };
      var shut = function (e) { if (S.open && !(pop && e && pop.contains(e.target))) { S.open = null; draw(false); } };
      document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc); window.addEventListener('scroll', shut, true);
      h.cleanup(function () { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', shut, true); clearTimeout(timer); if (pop) pop.remove(); });
      h.resizeObserver(el, function () { draw(true); });
    }
  });
})();
