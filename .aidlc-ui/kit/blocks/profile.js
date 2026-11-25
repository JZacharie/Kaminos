/* @block profile 1.0 -- Profile header: avatar, name, handle, bio, meta, stats, action buttons and a tab strip, in three layouts.
 * Use for: social profile, artist page, channel header, store or team page, user card in a sidebar (compact, 320 px).
 * Pick: Header of a person, artist, channel, store or team page: avatar, name, bio, stats, Follow/Message buttons, tab strip.
 * Load: blocks.css, core.js, media.lib.css, media.lib.js, profile.css, profile.js
 * Call: K.block.profile('#a-profile', {name: 'Marta Silva', handle: '@marta', verified: true, stats: [{label: 'Followers', value: 12400}], actions: [{id: 'follow', label: 'Follow', pressedLabel: 'Following', pressed: false, kind: 'primary'}], tabs: [{value: 'posts', label: 'Posts'}]})
 * Config:
 *   name       text, required   heading (headingLevel + 1); 2 lines, then ellipsis + title
 *   handle     text             "@marta.silva" or a tagline; as given, one line
 *   verified   boolean          check badge after the name (verifiedLabel, default "Verified", = its accessible name)
 *   src, key   text             avatar image (data URI or app file; initials tint when absent or broken); key = tint key
 *   cover      object           {src?, key?, glyph?} banner; absent = tint banner; ignored in compact
 *   bio        text             3 lines; a "more" button (moreLabel, lessLabel) only when cut
 *   meta       array            [{label, icon?, href?}] icon pin|link|calendar|mail (place, website, joined); href = link
 *   stats      array            [{label, value, href?}] value as given; a number from 1000 up is compacted (12.4k; full number in title)
 *   actions    array            [{id?, label, kind?, icon?, pressed?, pressedLabel?}] kind primary|secondary (default)|icon (label = aria-label)
 *                               a boolean pressed (or pressedLabel) = toggle: aria-pressed flips locally, label becomes pressedLabel
 *   tabs       array            [{value, label, count?}] real tablist; only the strip, the app swaps the content; tab = current value (default first)
 *   layout     'banner'|'compact'|'center', default 'banner'  banner = cover + overlapping avatar; compact = avatar left, no cover (sidebar card);
 *                               center = centred artist/page style (cover optional). Under 480 px wide the actions go under the name.
 *   onAction(id, pressed)  pressed = new state for toggles, else undefined;  onTab(value)
 *   (common)   headingLevel, state, emptyText, errorText; leave frame off (actions would show twice)
 * States: loading, error, bad config (inline error).
 * Keyboard: Tab to each button and the tab strip; Left/Right/Home/End move between tabs.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define || !K.media) { console.warn('[K.block] profile: load core.js and media.lib.js before profile.js'); return; }
  var M = K.media, warned = {};
  var cb = function (name, fn, a, b) {
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (e) { var m = '[K.block] profile: ' + name + ' threw: ' + String((e && e.message) || e).slice(0, 120); if (!warned[m]) { warned[m] = 1; console.warn(m); } }
  };
  var isT = function (a) { return typeof a.pressed === 'boolean' || a.pressedLabel != null; };
  var ICONS = { pin: 1, link: 1, calendar: 1, mail: 1 };
  K.block.define('profile', {
    version: '1.0',
    frame: false,
    resize: true,
    schema: {
      name: { type: 'text', required: true }, handle: { type: 'text' }, verified: { type: 'boolean' }, verifiedLabel: { type: 'text', default: 'Verified' },
      src: { type: 'text' }, key: { type: 'text' }, cover: { type: 'object' }, bio: { type: 'text' },
      moreLabel: { type: 'text', default: 'more' }, lessLabel: { type: 'text', default: 'less' },
      meta: { type: 'array', of: { label: { type: 'text', required: true }, icon: { type: 'string' }, href: { type: 'string' } } },
      stats: { type: 'array', of: { label: { type: 'text', required: true }, value: { type: 'text', required: true }, href: { type: 'string' } } },
      actions: { type: 'array', of: { id: { type: 'text' }, label: { type: 'text', required: true }, kind: { type: 'string', enum: ['primary', 'secondary', 'icon'] },
        icon: { type: 'string' }, pressed: { type: 'boolean' }, pressedLabel: { type: 'text' } } },
      tabs: { type: 'array', of: { value: { type: 'text', required: true }, label: { type: 'text', required: true }, count: { type: 'text' } } },
      tab: { type: 'text' }, onAction: { type: 'function' }, onTab: { type: 'function' },
      layout: { type: 'string', enum: ['banner', 'compact', 'center'], default: 'banner' }
    },
    render: function (el, c, h) {
      var w = el.clientWidth || 720, narrow = w < 480, layout = c.layout, acts = c.actions || [], tabs = c.tabs || [], cv = c.cover && typeof c.cover === 'object' ? c.cover : null;
      var lvl = Math.min(6, Math.max(1, c.headingLevel | 0) + 1), name = String(c.name), key = c.key != null ? c.key : name;
      var aid = function (a, i) { return a.id != null ? String(a.id) : 'act-' + (i + 1); };
      var sig = JSON.stringify([c.tab, acts.map(function (a, i) { return [aid(a, i), a.pressed]; })]), st = h._kPro;
      if (!st || st.sig !== sig) {
        st = h._kPro = { sig: sig, tab: c.tab != null ? String(c.tab) : tabs.length ? String(tabs[0].value) : null, on: {}, open: false };
        acts.forEach(function (a, i) { st.on[aid(a, i)] = !!a.pressed; });
      }
      var hasCover = layout === 'banner' || (layout === 'center' && !!cv), lead = layout === 'compact';
      var root = h.el('div', { class: 'k-pro k-pro-' + layout + (narrow ? ' k-pro-narrow' : '') + (hasCover ? ' k-pro-hascover' : '') + (tabs.length ? ' k-pro-has-tabs' : '') });

      if (hasCover) {
        var cov = M.cover(h, { title: name, key: cv && cv.key != null ? cv.key : key, src: cv && cv.src, glyph: cv && cv.glyph, alt: '' });
        cov.style.setProperty('aspect-ratio', narrow ? '2/1' : '4/1');
        cov.setAttribute('aria-hidden', 'true');
        root.appendChild(h.el('div', { class: 'k-pro-cover' }, cov));
      }

      //actions
      var fill = function (b, a, i) {
        var id = aid(a, i), tog = isT(a), on = tog && !!st.on[id], kind = a.kind || 'secondary';
        var label = on && a.pressedLabel != null ? String(a.pressedLabel) : String(a.label), ic = a.icon || (kind === 'icon' ? 'more' : on ? 'check' : null);
        b.textContent = '';
        b.className = 'k-b-btn k-pro-btn' + (kind === 'primary' && !on ? ' k-b-btn-primary' : '') + (kind === 'icon' ? ' k-pro-icon' : '') + (on ? ' k-pro-on' : '');
        if (tog) b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (kind === 'icon') { b.setAttribute('aria-label', label); b.setAttribute('title', label); } else b.removeAttribute('aria-label');
        if (ic) b.appendChild(M.icon(h, ic, { size: 16 }));
        if (kind !== 'icon') b.appendChild(h.line(label, { class: 'k-pro-bt' }));
        return b;
      };
      var actsEl = null;
      if (acts.length) {
        actsEl = h.el('div', { class: 'k-pro-acts', role: 'group', 'aria-label': name }, acts.map(function (a, i) {
          var b = h.el('button', { type: 'button', id: a.id != null ? String(a.id) : null });
          b.addEventListener('click', function () {
            var id = aid(a, i), tog = isT(a);
            if (tog) { st.on[id] = !st.on[id]; fill(b, a, i); }
            cb('onAction', c.onAction, id, tog ? !!st.on[id] : undefined);
          });
          return fill(b, a, i);
        }));
      }

      //identity
      var av = h.el('div', { class: 'k-pro-av' }, M.avatar(h, { name: name, src: c.src, key: key, size: lead ? 'lg' : 'xl' }));
      var idEl = h.el('div', { class: 'k-pro-id' }, [
        h.el('h' + lvl, { class: 'k-pro-name' }, [h.el('span', { class: 'k-pro-nt', title: name }, h.el('span', { text: name })),
          c.verified ? h.el('span', { class: 'k-pro-ver', role: 'img', 'aria-label': String(c.verifiedLabel), title: String(c.verifiedLabel) }, M.icon(h, 'check', { size: 12 })) : null]),
        c.handle != null && c.handle !== '' ? h.line(c.handle, { class: 'k-pro-handle' }) : null]);
      var body = h.el('div', { class: 'k-pro-body' });
      if (lead) body.appendChild(h.el('div', { class: 'k-pro-top' }, [av, idEl, narrow ? null : actsEl]));
      else { body.appendChild(h.el('div', { class: 'k-pro-head' }, [av, narrow || layout === 'center' ? null : actsEl])); body.appendChild(idEl); }
      if (actsEl && (narrow || layout === 'center')) body.appendChild(actsEl);

      //bio (3 lines, then "more" only when the text is really cut)
      var bioBtn = null, bioP = null;
      if (c.bio != null && c.bio !== '') {
        bioP = h.el('p', { class: 'k-pro-bio-t' }, h.el('span', { text: c.bio }));
        body.appendChild(h.el('div', { class: 'k-pro-bio' + (st.open ? ' k-pro-open' : '') }, [bioP]));
        bioBtn = h.el('button', { type: 'button', class: 'k-pro-more', 'aria-expanded': st.open ? 'true' : 'false', hidden: true, text: st.open ? c.lessLabel : c.moreLabel });
        bioBtn.addEventListener('click', function () {
          st.open = !st.open;
          bioBtn.parentNode.classList.toggle('k-pro-open', st.open);
          bioBtn.setAttribute('aria-expanded', st.open ? 'true' : 'false');
          bioBtn.textContent = st.open ? c.lessLabel : c.moreLabel;
        });
        bioP.parentNode.appendChild(bioBtn);
      }
      if (c.meta && c.meta.length) body.appendChild(h.el('ul', { class: 'k-pro-meta', role: 'list' }, c.meta.map(function (m) {
        var inner = [ICONS[m.icon] ? M.icon(h, m.icon, { size: 16 }) : null, h.line(m.label)];
        return h.el('li', { class: 'k-pro-mi' }, m.href ? h.el('a', { class: 'k-pro-link', href: m.href, title: String(m.label) }, inner) : h.el('span', { class: 'k-pro-ml' }, inner));
      })));
      if (c.stats && c.stats.length) body.appendChild(h.el('ul', { class: 'k-pro-stats', role: 'list' }, c.stats.map(function (s) {
        var big = typeof s.value === 'number' && Math.abs(s.value) >= 1e3, inner = [h.el('span', { class: 'k-pro-sv k-b-nw', title: big ? h.num(s.value) : null, text: typeof s.value === 'number' ? M.count(s.value) : s.value }),
          h.line(s.label, { class: 'k-pro-sl' })];
        return h.el('li', { class: 'k-pro-stat' }, s.href ? h.el('a', { class: 'k-pro-stat-a', href: s.href }, inner) : inner);
      })));
      root.appendChild(body);

      //tab strip (only the strip: the app swaps the content)
      if (tabs.length) {
        var vals = tabs.map(function (t) { return String(t.value); });
        if (vals.indexOf(st.tab) < 0) st.tab = vals[0];
        var strip = h.el('div', { class: 'k-pro-tabs', role: 'tablist', 'aria-label': c.title != null ? String(c.title) : 'Sections' }), btns = [];
        var paint = function () { btns.forEach(function (b, i) { var on = vals[i] === st.tab; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }); };
        tabs.forEach(function (t, i) {
          var b = h.el('button', { type: 'button', role: 'tab', class: 'k-pro-tab', 'data-tab': vals[i] }, [h.el('span', { class: 'k-pro-tl', text: t.label }),
            t.count != null && t.count !== '' ? h.el('span', { class: 'k-pro-tn k-b-nw', text: typeof t.count === 'number' ? M.count(t.count) : t.count }) : null]);
          btns.push(b);
          strip.appendChild(b);
          b.addEventListener('click', function () { pick(i, false); });
          b.addEventListener('keydown', function (e) {
            var n = tabs.length, to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
            if (to < 0) return;
            e.preventDefault();
            pick(to, true);
          });
        });
        var pick = function (i, focus) {
          var ch = st.tab !== vals[i];
          st.tab = vals[i];
          paint();
          if (focus) btns[i].focus();
          if (ch) cb('onTab', c.onTab, vals[i]);
        };
        paint();
        root.appendChild(strip);
      }
      el.appendChild(root);
      if (bioP && (bioP.scrollHeight > bioP.clientHeight + 1 || st.open)) bioBtn.hidden = false;
    }
  });
})();
