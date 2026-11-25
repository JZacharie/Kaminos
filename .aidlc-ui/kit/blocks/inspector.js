/* @block inspector 1.0 -- Properties side panel: the selected object's name and id, optional tabs, collapsible sections of editable controls with a Reset per section.
 * Use for: video and photo editor properties (position, scale, opacity), a charger or van configuration panel, a rule or alert editor, a CMS block settings pane. Not `detail` (read-only key/value).
 * Pick: Editable properties panel of the selected thing: tabs, collapsible sections, number/slider/text/select/switch/choice/colour, Reset.
 * Load: blocks.css, core.js, inspector.css, inspector.js
 * Call: K.block.inspector('#a-props', {subject: {name: 'Title card', id: 'clip-14'}, sections: [{id: 'tf', title: 'Transform', resettable: true, controls: [{key: 'opacity', label: 'Opacity', type: 'slider', value: 80, min: 0, max: 100, unit: '%'}]}], onChange: function (key, value, sectionId) {}})
 * Config:
 *   subject   object             {name, id?, kind?}; missing or no name = the "Nothing selected" empty state
 *   tabs      array              [{id, label?}] optional tab strip (arrows, Home/End); sections without `tab` show on every tab
 *   tab       text               active tab id, default the first
 *   sections  array, default []  [{id, tab?, title, open?, resettable?, controls[]}]
 *     open        boolean, default true  start expanded; the header is a button (aria-expanded)
 *     resettable  boolean                shows "Reset" (disabled while every value equals its default)
 *     controls    [{key, label, type, value, default?, unit?, min?, max?, step?, options?, disabled?, hint?}]
 *       type      'number'|'slider'|'text'|'select'|'switch'|'choice'|'swatch', default 'text'
 *       value     the current value; number and slider take a number, switch a boolean, select/choice/swatch the value of an option, swatch a #rgb/#rrggbb colour
 *       default   what Reset restores; absent = the value the block was given (a new `sections` replaces local edits)
 *       unit, min, max, step   number and slider: unit shown after the value, limits (slider 0-100), step (typed values snap to it)
 *       options   [{value, label?}] for select and choice; for swatch a palette of colours (without options: a colour picker)
 *       hint      small help text under the control
 *   onChange(key, value, sectionId)  slider on every move, others on commit (blur/Enter, pick, toggle)
 *   onReset(sectionId), onTab(id), onToggleSection(sectionId, open)
 *   (common)  title (accessible name of the panel; frame is off), emptyText, state, errorText, headingLevel (the subject name; sections use +1)
 * Behaviour: number and slider stay in sync (the slider has an editable value box); typed values clamp to min/max and snap to step, text that is not a number reverts with a small inline hint.
 *   Local edits, open sections and the tab survive re-renders; a changed config replaces them. Number box: Up/Down = step (Shift = 10 steps), Esc reverts.
 * States: empty (no subject), loading, error, bad config, empty tab, 60 controls, 320 px sidebar.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] inspector: load core.js before inspector.js'); return; }
  var S = function (v) { return v == null ? '' : String(v); };
  var decs = function (n) { var m = /(?:\.(\d+))?(?:e-(\d+))?$/.exec(String(n)); return Math.min(8, (m[1] || '').length + (+m[2] || 0)); };
  var hex = function (v) { v = S(v).trim(); if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).replace(/./g, '$&$&'); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; };
  var fit = function (k, v) {
    if (k.step > 0) { var b = k.min != null ? k.min : 0; v = +(b + Math.round((v - b) / k.step) * k.step).toFixed(Math.max(decs(k.step), decs(b))); }
    if (k.max != null && v > k.max) v = k.max;
    if (k.min != null && v < k.min) v = k.min;
    return +v.toFixed(8);
  };
  var parse = function (s, unit) {
    s = s.replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.');
    if (unit) { var u = unit.replace(/\s/g, ''); if (s.toLowerCase().slice(-u.length) === u.toLowerCase()) s = s.slice(0, -u.length); }
    return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? +s : null;
  };
  var CTL = { key: { type: 'text', required: true }, label: { type: 'text' }, type: { type: 'string', enum: ['number', 'slider', 'text', 'select', 'switch', 'choice', 'swatch'], default: 'text' }, value: { type: 'any' }, default: { type: 'any' },
    unit: { type: 'text' }, min: { type: 'number' }, max: { type: 'number' }, step: { type: 'number' }, disabled: { type: 'boolean' }, hint: { type: 'text' },
    options: { type: 'array', of: { value: { type: 'text', required: true }, label: { type: 'text' } } } };
  K.block.define('inspector', {
    version: '1.0',
    frame: false,
    emptyText: 'Nothing selected',
    schema: {
      subject: { type: 'object' },
      tabs: { type: 'array', of: { id: { type: 'text', required: true }, label: { type: 'text' } } },
      tab: { type: 'text' },
      sections: { type: 'array', default: [], of: { id: { type: 'text' }, tab: { type: 'text' }, title: { type: 'text' }, open: { type: 'boolean' }, resettable: { type: 'boolean' }, controls: { type: 'array', of: CTL } } },
      onChange: { type: 'function' }, onReset: { type: 'function' }, onTab: { type: 'function' }, onToggleSection: { type: 'function' }
    },
    empty: function (c) { return !c.subject || c.subject.name == null || c.subject.name === ''; },
    render: function (el, c, h) {
      var E = h.el, lvl = Math.min(5, Math.max(2, c.headingLevel | 0)), sub = c.subject, timers = [], ctls = [], secs = [], tabBtns = [];
      h.cleanup(function () { timers.forEach(clearTimeout); });
      var go = function (name, a, b, d) {
        if (typeof c[name] !== 'function') return;
        try { c[name](a, b, d); } catch (e) { h.warn(name + ' threw: ' + S((e && e.message) || e).slice(0, 120)); }
      };
      var tabs = c.tabs || [], tabIds = tabs.map(function (t) { return S(t.id); });
      var sig = ''; try { sig = JSON.stringify([sub, c.tab, tabs, c.sections]); } catch (e) { sig = String(Math.random()); }
      var st = el._kIn;
      if (!st || st.sig !== sig) st = el._kIn = { sig: sig, vals: {}, open: {}, tab: null };
      if (st.tab == null || tabIds.indexOf(st.tab) < 0) {
        if (c.tab != null && tabIds.indexOf(S(c.tab)) < 0 && tabs.length) h.warn('tab "' + S(c.tab) + '" is not in tabs; showing the first');
        st.tab = c.tab != null && tabIds.indexOf(S(c.tab)) >= 0 ? S(c.tab) : tabIds[0] || '';
      }
      var uid = h.uid('k-in'), n = 0;
      var roving = function (group, sel) {
        group.addEventListener('keydown', function (e) {
          var bs = [].slice.call(group.querySelectorAll(sel)), i = bs.indexOf(el.ownerDocument.activeElement), k = e.key, m = bs.length;
          var j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % m : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + m) % m : k === 'Home' ? 0 : k === 'End' ? m - 1 : -1;
          if (i < 0 || j < 0) return;
          e.preventDefault(); bs[j].focus(); bs[j].click();
        });
      };

      var control = function (sec, k) {
        var t = k.type, key = S(k.key), id = uid + '-' + (n++), vk = sec.sid + '\n' + key, name = S(k.label != null ? k.label : key), row, cur = function () { return st.vals[vk]; };
        var opts = k.options || [], optVal = function (v) { for (var i = 0; i < opts.length; i++) if (S(opts[i].value).toLowerCase() === S(v).toLowerCase()) return opts[i].value; return v; };
        var num = t === 'number' || t === 'slider', paints = [], hint = k.hint != null && k.hint !== '' ? E('p', { class: 'k-in-hint', id: id + '-h', text: k.hint }) : null;
        var errEl = num || t === 'text' ? E('p', { class: 'k-in-err', id: id + '-e', role: 'status' }) : null, errT, field, slider, text;
        if (t === 'slider') {
          if (k.min == null) k.min = 0;
          if (k.max == null) k.max = 100;
          if (!(k.max > k.min)) { h.warn('control "' + key + '": max must be above min; using min + 100'); k.max = k.min + 100; }
          if (!(k.step > 0)) k.step = Math.min(1, Math.pow(10, Math.floor(Math.log10((k.max - k.min) / 50))));
        }
        var norm = function (v) {
          if (num) { v = typeof v === 'number' && isFinite(v) ? v : isFinite(parseFloat(v)) ? parseFloat(v) : k.min != null ? k.min : 0; return fit(k, v); }
          if (t === 'switch') return v === true || v === 'true';
          if (t === 'swatch') return opts.length ? optVal(v) : hex(v) || (h.warn('control "' + key + '": swatch value must be #rgb or #rrggbb'), '#000000');
          return t === 'text' ? S(v) : optVal(v);
        };
        var init = norm(k.value), tgt = k.default !== undefined ? norm(k.default) : init;
        if (!(vk in st.vals)) st.vals[vk] = init;
        var c0 = { sec: sec, vk: vk, tgt: tgt, set: null };
        var err = function (msg) {
          if (!errEl) return;
          clearTimeout(errT); errEl.textContent = msg; text.setAttribute('aria-invalid', msg ? 'true' : 'false');
          if (msg) { errT = setTimeout(function () { err(''); }, 4000); timers.push(errT); }
        };
        var set = c0.set = function (v, fire) {
          st.vals[vk] = v;
          paints.forEach(function (p) { p(v); });
          if (fire) { go('onChange', key, v, sec.sid); sync(sec); }
        };
        var common = { id: id, disabled: k.disabled ? true : null, 'aria-describedby': [hint && id + '-h', errEl && id + '-e'].filter(Boolean).join(' ') || null };
        var ctl, grouped = t === 'choice' || (t === 'swatch' && opts.length);
        if (num) {
          var fmt = function (v) { return S(+v.toFixed(Math.max(decs(k.step || 0), 6))); }, unit = k.unit != null ? S(k.unit) : '';
          var lo = k.min, hi = k.max;
          text = E('input', { class: 'k-in-num k-b-num', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', id: t === 'slider' ? id + '-n' : id, 'aria-label': t === 'slider' ? name + ' value' + (unit ? ' in ' + unit : '') : null,
            disabled: common.disabled, 'aria-describedby': common['aria-describedby'] });
          if (t === 'number') text.setAttribute('aria-label', name + (unit ? ' in ' + unit : ''));
          field = E('span', { class: 'k-in-fld' }, [text, unit ? E('span', { class: 'k-in-unit k-b-nw', 'aria-hidden': 'true', text: unit }) : null]);
          var apply = function (v) {
            var f = fit(k, v);
            if (f !== v && ((hi != null && v > hi) || (lo != null && v < lo))) err(lo != null && hi != null ? 'Keep it between ' + lo + ' and ' + hi + (unit ? '\u00a0' + unit : '') : hi != null && v > hi ? 'At most ' + hi + (unit ? '\u00a0' + unit : '') : 'At least ' + lo + (unit ? '\u00a0' + unit : ''));
            else err('');
            set(f, f !== cur());
          };
          text.addEventListener('change', function () {
            var v = parse(text.value, unit);
            if (v == null) { text.value = fmt(cur()); err('Enter a number' + (unit ? ' in ' + unit : '')); return; }
            apply(v);
          });
          text.addEventListener('input', function () { err(''); });
          text.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { text.value = fmt(cur()); err(''); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); apply(cur() + (e.key === 'ArrowUp' ? 1 : -1) * (k.step > 0 ? k.step : 1) * (e.shiftKey ? 10 : 1)); }
          });
          paints.push(function (v) { text.value = fmt(v); });
          ctl = field;
          if (t === 'slider') {
            slider = E('input', { class: 'k-in-range', type: 'range', id: id, min: k.min, max: k.max, step: k.step, 'aria-label': name, disabled: common.disabled });
            slider.addEventListener('input', function () { err(''); set(+slider.value, true); });
            paints.push(function (v) { slider.value = v; slider.style.setProperty('--k-in-p', ((v - k.min) / (k.max - k.min) * 100) + '%'); slider.setAttribute('aria-valuetext', fmt(v) + (unit ? ' ' + unit : '')); });
            ctl = E('div', { class: 'k-in-sl' }, [slider, field]);
          }
        } else if (t === 'text') {
          text = E('input', Object.assign({ class: 'k-in-txt', type: 'text', autocomplete: 'off' }, common));
          text.addEventListener('change', function () { set(text.value, true); });
          paints.push(function (v) { text.value = v; });
          ctl = text;
        } else if (t === 'select') {
          var sel = E('select', Object.assign({ class: 'k-in-sel' }, common), opts.map(function (o) { return E('option', { value: S(o.value), text: S(o.label != null ? o.label : o.value) }); }));
          sel.addEventListener('change', function () { set(opts[sel.selectedIndex].value, true); });
          paints.push(function (v) { sel.selectedIndex = Math.max(-1, opts.findIndex(function (o) { return S(o.value) === S(v); })); });
          ctl = sel;
        } else if (t === 'switch') {
          var sw = E('button', Object.assign({ class: 'k-in-tg', type: 'button', role: 'switch' }, common), E('span', { class: 'k-in-knob' }));
          sw.addEventListener('click', function () { set(!cur(), true); });
          paints.push(function (v) { sw.setAttribute('aria-checked', v ? 'true' : 'false'); });
          ctl = sw;
        } else if (grouped) {
          var sc = t === 'swatch', btns = opts.map(function (o) {
            var lab = S(o.label != null ? o.label : o.value);
            var b = E('button', { class: sc ? 'k-in-chip' : 'k-in-opt', type: 'button', role: 'radio', title: lab, 'aria-label': sc ? lab : null, disabled: common.disabled, style: sc ? { '--k-in-c': S(o.value) } : null }, sc ? null : E('span', { text: lab }));
            b.addEventListener('click', function () { if (S(cur()) !== S(o.value)) set(o.value, true); });
            return b;
          });
          ctl = E('div', { class: sc ? 'k-in-chips' : 'k-in-seg', role: 'radiogroup', 'aria-labelledby': id + '-l', 'aria-describedby': common['aria-describedby'] }, btns);
          if (!common.disabled) roving(ctl, 'button');
          paints.push(function (v) { var on = btns.findIndex(function (b, i) { return S(opts[i].value).toLowerCase() === S(v).toLowerCase(); }); btns.forEach(function (b, i) { b.setAttribute('aria-checked', i === on ? 'true' : 'false'); b.tabIndex = i === on || (on < 0 && i === 0) ? 0 : -1; }); });
        } else if (t === 'swatch') {
          var pick = E('input', Object.assign({ class: 'k-in-color', type: 'color' }, common)), rd = E('span', { class: 'k-in-hex k-b-nw' });
          pick.addEventListener('input', function () { paints.forEach(function (p) { p(pick.value); }); });
          pick.addEventListener('change', function () { set(pick.value, true); });
          paints.push(function (v) { pick.value = v; rd.textContent = v; });
          ctl = E('span', { class: 'k-in-fld k-in-pick' }, [pick, rd]);
        } else { h.warn('control "' + key + '": unknown type ' + t); }
        set(st.vals[vk], false);
        var lab = grouped ? E('span', { class: 'k-in-l', id: id + '-l', title: name }, E('span', { text: name })) : E('label', { class: 'k-in-l', for: id, id: id + '-l', title: name }, E('span', { text: name }));
        row = E('div', { class: 'k-in-row' + (k.disabled ? ' k-in-dis' : ''), 'data-type': t, 'data-key': key }, [lab, E('div', { class: 'k-in-c' }, ctl), hint || errEl ? E('div', { class: 'k-in-m' }, [hint, errEl]) : null]);
        ctls.push(c0);
        sec.ctls.push(c0);
        return row;
      };
      var sync = function (sec) { if (sec.reset) sec.reset.disabled = !sec.ctls.some(function (x) { return st.vals[x.vk] !== x.tgt; }); };

      // header
      var kind = sub.kind != null && sub.kind !== '' ? S(sub.kind) : '', sid0 = sub.id != null && sub.id !== '' ? S(sub.id) : '';
      var head = E('div', { class: 'k-in-head' }, [E('h' + lvl, { class: 'k-in-name' }, h.line(S(sub.name))), kind || sid0 ? E('p', { class: 'k-in-meta' }, [kind ? E('span', { class: 'k-in-kind k-b-nw', text: kind }) : null, sid0 ? h.line(sid0, { class: 'k-in-id' }) : null]) : null]);
      var root = E('div', { class: 'k-in', role: 'group', 'aria-label': c.title != null ? S(c.title) : S(sub.name) + ' properties' }, head);
      var panel = E('div', { class: 'k-in-panel', id: uid + '-p', role: tabs.length ? 'tabpanel' : null }), none = E('p', { class: 'k-in-none', text: 'Nothing to edit here', hidden: true });

      // sections
      (c.sections || []).forEach(function (s, i) {
        var sid = s.id != null && s.id !== '' ? S(s.id) : 'section-' + (i + 1), sec = { sid: sid, ctls: [], tab: null }, bid = uid + '-s' + i;
        if (s.tab != null && tabs.length) { if (tabIds.indexOf(S(s.tab)) < 0) h.warn('section "' + sid + '" has tab "' + S(s.tab) + '" that is not in tabs; shown on every tab'); else sec.tab = S(s.tab); }
        if (!(sid in st.open)) st.open[sid] = s.open !== false;
        var body = E('div', { class: 'k-in-body', id: bid }), title = S(s.title != null ? s.title : sid);
        (s.controls || []).forEach(function (k) { body.appendChild(control(sec, k)); });
        if (!body.firstChild) body.appendChild(E('p', { class: 'k-in-none', text: 'No controls' }));
        var tg = E('button', { class: 'k-in-toggle', type: 'button', 'aria-controls': bid, title: title }, [E('span', { class: 'k-in-chev', 'aria-hidden': 'true' }), h.line(title, { class: 'k-in-st' })]);
        var paint = function () { tg.setAttribute('aria-expanded', st.open[sid] ? 'true' : 'false'); body.hidden = !st.open[sid]; };
        tg.addEventListener('click', function () { st.open[sid] = !st.open[sid]; paint(); go('onToggleSection', sid, st.open[sid]); });
        if (s.resettable) {
          sec.reset = E('button', { class: 'k-in-reset', type: 'button', 'aria-label': 'Reset ' + title, text: 'Reset' });
          sec.reset.addEventListener('click', function () { sec.ctls.forEach(function (x) { x.set(x.tgt, false); }); sync(sec); go('onReset', sid); });
        }
        sec.node = E('section', { class: 'k-in-sec', 'data-section': sid }, [E('div', { class: 'k-in-sh' }, [E('h' + (lvl + 1), { class: 'k-in-sht' }, tg), sec.reset]), body]);
        paint(); sync(sec);
        secs.push(sec);
        panel.appendChild(sec.node);
      });
      panel.appendChild(none);

      // tabs
      var showTab = function (id) {
        st.tab = id;
        tabBtns.forEach(function (b, i) { var on = tabIds[i] === id; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on) panel.setAttribute('aria-labelledby', b.id); });
        var shown = 0;
        secs.forEach(function (x) { var on = !x.tab || x.tab === id; x.node.hidden = !on; if (on) shown++; });
        none.hidden = shown > 0;
      };
      if (tabs.length) {
        var list = E('div', { class: 'k-in-tabs', role: 'tablist', 'aria-label': 'Property groups' });
        tabs.forEach(function (t, i) {
          var b = E('button', { class: 'k-in-tab', type: 'button', role: 'tab', id: uid + '-t' + i, 'aria-controls': panel.id }, h.line(S(t.label != null ? t.label : t.id)));
          b.addEventListener('click', function () { if (st.tab !== tabIds[i]) { showTab(tabIds[i]); go('onTab', tabIds[i]); } });
          tabBtns.push(b); list.appendChild(b);
        });
        roving(list, '[role=tab]');
        root.appendChild(list);
      }
      root.appendChild(panel);
      el.appendChild(root);
      showTab(st.tab);
    }
  });
})();
