/* @block shell 1.0 -- App shell: top bar (brand, one-line nav with a "More" overflow menu, theme menu, user chip) and the page header (title, subtitle, actions).
 * Use for: the top of every screen of every app (SpudTrack, VoltRoute, Stagehand). One shell per page; the page header changes with the route via update({page}).
 * Pick: The app top bar (brand, one-line nav, theme menu, user) and page header; one per page.
 * Load: blocks.css, core.js, shell.css, shell.js
 * Note: brand.icon draws the app logo from a glyph: film calendar truck leaf music cart chat chart pin bolt ticket mic potato shield heart home book camera wallet plane car cloud gear star users clipboard box rocket paint code (also map, stage, food...). No icon: a logo from the name.
 * Call: K.block.shell('#a-shell', {brand:{name:'SpudTrack',icon:'truck'}, nav:[{label:'Dashboard', href:'#/dashboard'}, {label:'Shipments', href:'#/shipments'}], user:{name:'Ana Ruiz', role:'Logistics'}, page:{title:'Dashboard'}})
 * Config:
 *   brand     object, required  {name (text, required), icon? (a glyph name, see Note), mark? (1-2 characters in a plain square logo; wins over icon), href? (default first nav href)}
 *                               neither icon nor mark: an automatic logo (shape and gradient from the name, its initial)
 *   nav       array, required   [{label, href, id?}] in display order; use 1-2 word labels. Always one line: spacing tightens, then what does not fit moves into a "More" menu
 *                               (the whole nav becomes "Menu" in a narrow container). Items beyond 7 are legal but the first 7 should be the main screens.
 *     label   text, required    link text (ellipsis + title past 14rem)
 *     href    string, required  route ("#/shipments") or page url; the link stays lit on its detail routes (see Active item)
 *     id      string            id on the link (stable a-... anchor)
 *   user      object            {name (text, required), role?}: chip with initials; below 1100 px of shell width only the initials circle (name and role in title)
 *   themes    boolean, default true  theme menu: palette (ops, control, warm) and appearance (system, light, dark; not for control, which is always dark)
 *   page      object            {title (text, required), subtitle?, status? (word with a coloured pill: "Delayed"), back? {label, href}, actions? [{label, href?, onClick?, kind?: 'primary', id?}]}
 *                               top-level title/subtitle/actions are used as page when page is absent
 *   active    string            force the lit item (its href or id); default = automatic
 *   maxWidth  number, default 1200  content width in px of bar and page header (0 = full width); use the same as the screen container
 *   (common)  state, headingLevel (ignored: the page title is the h1)
 * Active item: from location.hash. A <section data-route="#/shipment/SP-2405" data-parent="#/shipments"> (or data-k-nav) names the nav route a detail screen belongs to;
 *   without it the first two segments decide, and a singular detail route still lights its plural list. Updates on hashchange and kit:route, no re-render.
 * States: loading and error replace the whole shell with the core state; bad config shows the inline error.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] shell: load core.js before shell.js'); return; }
  var NS = 'k-shell';
  var THEMES = [['ops', 'Ops'], ['control', 'Control room'], ['warm', 'Warm']];
  var MODES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  var seg = function (r) { return String(r).split('/').slice(0, 2).join('/'); };
  var key = function (r) { return seg(r).replace(/s$/, ''); };
  var clean = function (u) { return String(u).split('?')[0]; };
  var initials = function (name) {
    var w = String(name).trim().split(/\s+/).filter(Boolean);
    var first = function (s) { return Array.from(s)[0] || ''; };
    if (!w.length) return '?';
    return (w.length > 1 ? first(w[0]) + first(w[w.length - 1]) : Array.from(w[0]).slice(0, 2).join('')).toUpperCase();
  };
  var ls = function (k, v) { try { if (v === null) localStorage.removeItem(k); else if (v) localStorage.setItem(k, v); } catch (e) { /* storage may be blocked */ } };

  // the nav route the current screen belongs to
  var currentRoute = function () {
    var hash = clean(location.hash || ''), secs = [].slice.call(document.querySelectorAll('[data-route]'));
    if (secs.length) {
      var rt = function (s) { return clean(s.getAttribute('data-route')); };
      var hit = secs.filter(function (s) { return rt(s) === hash; })[0] || (hash && secs.filter(function (s) { return seg(rt(s)) === seg(hash); })[0]) || secs[0];
      return clean(hit.getAttribute('data-k-nav') || hit.getAttribute('data-parent') || hit.getAttribute('data-route'));
    }
    return hash;
  };
  var activeIndex = function (nav, cur, explicit) {
    var hs = nav.map(function (n) { return clean(n.href); }), find = function (fn) { for (var i = 0; i < hs.length; i++) if (fn(hs[i], i)) return i; return -1; };
    if (explicit) { var e = find(function (x, i) { return nav[i].href === explicit || nav[i].id === explicit; }); if (e >= 0) return e; }
    if (cur) {
      var i = find(function (x) { return x === cur; });
      if (i < 0) i = find(function (x) { return x.charAt(0) === '#' && seg(x) === seg(cur); });
      if (i < 0) i = find(function (x) { return x.charAt(0) === '#' && key(x) === key(cur); });
      return i;
    }
    return find(function (x, j) { try { return nav[j].href.charAt(0) !== '#' && new URL(x, location.href).pathname === location.pathname; } catch (e) { return false; } });
  };

  var icon = function (h, d, fill) {
    return h.svg('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }, d.map(function (p) {
      return h.svg('path', Object.assign({ d: p[0] }, p[1] === 'fill' ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }));
  };
  var ICO = {
    theme: [['M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z'], ['M8 2.5v11a5.5 5.5 0 0 0 0-11z', 'fill']],
    chev: [['M4 6.25l4 3.75 4-3.75']],
    check: [['M3.5 8.5l3 3 6-7']]
  };


  // ---- app logo: no brand.mark -> a hash-picked shape + accent gradient + initial (or a brand.icon glyph); same name, same logo
  var SHAPES = [   // [path, outline width (round joins), letter size, letter dy]
    ['M10 2h12a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V10a8 8 0 0 1 8-8z', 0, 17, 0],
    ['M16 1.5C26.5 1.5 30.5 5.5 30.5 16S26.5 30.5 16 30.5 1.5 26.5 1.5 16 5.5 1.5 16 1.5z', 0, 17, 0],
    ['M16 1.5a14.5 14.5 0 1 1 0 29 14.5 14.5 0 0 1 0-29z', 0, 17, 0],
    ['M16 2.5L27.7 9.25v13.5L16 29.5 4.3 22.75V9.25z', 2, 15.5, 0],
    ['M16 2C24.5 2 30 7.5 30 16S24.5 30 16 30H5a3 3 0 0 1-3-3V16C2 7.5 7.5 2 16 2z', 0, 17, 0],
    ['M16 2.5l11 4v8.5c0 7-5 11.5-11 14-6-2.5-11-7-11-14V6.5z', 2, 15.5, -.5],
    ['M16 2H27a3 3 0 0 1 3 3V16a14 14 0 0 1-14 14H5a3 3 0 0 1-3-3V16A14 14 0 0 1 16 2z', 0, 17, 0],
    ['M10.6 3h10.8L29 10.6v10.8L21.4 29H10.6L3 21.4V10.6z', 2, 15.5, 0]
  ];
  var ANGLE = [[0, 0, 1, 1], [0, 1, 1, 0], [0, 0, 0, 1], [1, 0, 0, 1], [.2, 0, .8, 1], [0, .25, 1, .75]];
  var TONE = ['color-mix(in srgb,var(--k-accent) 62%,var(--k-text))', 'color-mix(in srgb,var(--k-accent) 78%,var(--k-text))', 'color-mix(in oklch,var(--k-accent) 70%,var(--k-cat-4))', 'color-mix(in oklch,var(--k-accent) 72%,var(--k-cat-8))'];
  // glyphs: 24-box paths, stroked; a leading "!" = filled
  var GLYPH = {
    film: ['M4 5h16v14H4z', 'M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4'],
    calendar: ['M4 6.5h16v13H4z', 'M4 11h16M8.5 4v4M15.5 4v4'],
    truck: ['M2.5 6.5h11V16h-11z', 'M13.5 10h4l3 3.5V16h-7', 'M9 17.5a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0zM19 17.5a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0z'],
    leaf: ['M5 19C4 10 10 4 20 4c1 10-4 16-13 15z', 'M5 19l7-7'],
    music: ['M9 17V5l10-2v12', 'M9 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
    cart: ['M3 4h2.5l2 11h10.5l2-8H6.5', 'M10 19.5a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zM18 19.5a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z'],
    chat: ['M4 5h16v11H11l-4.5 4v-4H4z', 'M8 9.5h8M8 12.5h5'],
    chart: ['M3.5 20.5h17', 'M6.5 17v-5M12 17V6M17.5 17v-8'],
    pin: ['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z', 'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
    bolt: ['!M13.5 2.5L5 13.5h6l-1 8 8.5-11.5h-6z'],
    ticket: ['M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z', 'M14.5 7.5v1.5M14.5 11.2v1.6M14.5 15v1.5'],
    mic: ['M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z', 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7'],
    potato: ['M5 12.5C4.5 8 8 5 12.5 5.5 17 6 20 8.5 19.5 13.5 19 18 15 19.5 11 19c-4-.5-5.7-3-6-6.5z', 'M10 10.5h.01M14.5 12h.01M11.5 15h.01'],
    shield: ['M12 3l7.5 3v5.5c0 4.5-3.2 7.7-7.5 9.5-4.3-1.8-7.5-5-7.5-9.5V6z', 'M8.8 12l2.3 2.3 4.2-4.6'],
    heart: ['!M12 20.5s-8-4.7-8-10.8A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.7c0 6.1-8 10.8-8 10.8z'],
    home: ['M3.5 11.5L12 4l8.5 7.5', 'M5.5 10v10h13V10', 'M10 20v-5.5h4V20'],
    book: ['M4 5.5C7 4.5 9.5 4.8 12 6.5c2.5-1.7 5-2 8-1v13c-3-1-5.5-.7-8 1-2.5-1.7-5-2-8-1z', 'M12 6.5v13'],
    camera: ['M3.5 8h4l1.5-2.5h6L16.5 8h4v11h-17z', 'M15.5 13.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z'],
    wallet: ['M4 7.5A2 2 0 0 1 6 5.5h11v3', 'M4 7.5v10a2 2 0 0 0 2 2h14v-11H6a2 2 0 0 1-2-2z', 'M16.5 13.5h.01'],
    plane: ['M21 3L3 10.5l7 2.5 2.5 7z', 'M21 3L10 13'],
    car: ['M3.5 16.5v-4l2-5h13l2 5v4z', 'M3.5 12.5h17', 'M8.5 17.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0zM19.1 17.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z'],
    cloud: ['M7 18.5a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4.2 4.2 0 0 1-.5 8.5z'],
    gear: ['M10.3 5.2L10.7 2.9h2.6l.4 2.3 1.9.8 1.9-1.4 1.9 1.9-1.4 1.9.8 1.9 2.3.4v2.6l-2.3.4-.8 1.9 1.4 1.9-1.9 1.9-1.9-1.4-1.9.8-.4 2.3h-2.6l-.4-2.3-1.9-.8-1.9 1.4-1.9-1.9 1.4-1.9-.8-1.9-2.3-.4v-2.6l2.3-.4.8-1.9-1.4-1.9 1.9-1.9 1.9 1.4z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
    star: ['M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z'],
    users: ['M11 8.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M3 19c0-3.3 2.2-5 5-5s5 1.7 5 5', 'M14.5 5.6a3 3 0 0 1 0 5.8M15.5 14.3c2.8 0 5.5 1.3 5.5 4.7'],
    clipboard: ['M5.5 5h13v15.5h-13z', 'M9 3.5h6v3H9z', 'M8.5 11h7M8.5 14.5h7'],
    box: ['M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z', 'M3.5 7.5L12 12l8.5-4.5M12 12v9'],
    rocket: ['M12 2.5c3 2 4.5 5 4.5 9V15h-9v-3.5c0-4 1.5-7 4.5-9z', 'M13.5 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M7.5 12.5l-3 3.5v2.5l3-1.5M16.5 12.5l3 3.5v2.5l-3-1.5M10.5 18.5L12 22l1.5-3.5'],
    paint: ['M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2-.6-1.3.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.7 16.8 3.5 12 3.5z', 'M8 11h.01M11 7.8h.01M15 8.3h.01'],
    code: ['M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 5l-3 14']
  };
  var ALIAS = { map: 'pin', location: 'pin', place: 'pin', stage: 'mic', microphone: 'mic', food: 'potato', lorry: 'truck', van: 'truck', delivery: 'truck', logistics: 'truck', video: 'film', movie: 'film', cinema: 'film',
    date: 'calendar', schedule: 'calendar', message: 'chat', messages: 'chat', analytics: 'chart', stats: 'chart', energy: 'bolt', flash: 'bolt', electric: 'bolt', security: 'shield', favorite: 'heart', house: 'home',
    photo: 'camera', money: 'wallet', payment: 'wallet', flight: 'plane', travel: 'plane', vehicle: 'car', settings: 'gear', team: 'users', people: 'users', tasks: 'clipboard', package: 'box', launch: 'rocket', design: 'paint', dev: 'code', shop: 'cart', store: 'cart', farm: 'leaf', events: 'ticket' };
  var logoSeq = 0;
  var hash = function (s) {   // FNV-1a + a final mix, so neighbouring names do not pick neighbouring shapes
    var x = 2166136261, i;
    for (i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 15; x = Math.imul(x, 746845933); x ^= x >>> 13;
    return x >>> 0;
  };
  var logo = function (h, name, iconName) {
    var key = String(name).trim().toLowerCase(), hv = hash(key), gl = null, S = h.svg;
    if (iconName != null && iconName !== '') {
      var ik = String(iconName).trim().toLowerCase(); ik = ALIAS[ik] || ik;
      gl = GLYPH.hasOwnProperty(ik) ? GLYPH[ik] : null;
      if (!gl) h.warn('unknown brand.icon "' + iconName + '"');
    }
    var si = hv % SHAPES.length;
    var shape = SHAPES[si], an = ANGLE[(hv >>> 3) % ANGLE.length], tone = TONE[(hv >>> 6) % TONE.length], deco = (hv >>> 9) % 5;
    var id = 'k-shell-g' + (++logoSeq);
    var fill = 'url(#' + id + ')', kids = [
      S('defs', null, [S('linearGradient', { id: id, x1: an[0], y1: an[1], x2: an[2], y2: an[3] }, [
        S('stop', { offset: 0, style: 'stop-color:var(--k-accent)' }), S('stop', { offset: 1, style: 'stop-color:' + tone })]),
        deco === 1 ? S('clipPath', { id: id + 'c' }, S('path', { d: shape[0] })) : null]),
      S('path', Object.assign({ d: shape[0], fill: fill }, shape[1] ? { stroke: fill, 'stroke-width': shape[1], 'stroke-linejoin': 'round' } : {})),
      shape[1] ? null : S('path', { d: shape[0], fill: 'none', class: 'k-shell-rim' })];
    var lift = 0;
    if (!gl) {
      if (deco === 1) kids.push(S('ellipse', { cx: 9, cy: 1, rx: 19, ry: 8, class: 'k-shell-gloss', 'clip-path': 'url(#' + id + 'c)' }));
      if (deco === 2) kids.push(S('path', { d: shape[0], class: 'k-shell-ring', transform: 'translate(16 16) scale(.8) translate(-16 -16)', 'stroke-linejoin': 'round' }));
      if (deco === 3) { kids.push(S('path', { d: 'M12.5 24.5h7', class: 'k-shell-bar' })); lift = -1.5; }
      if (deco === 4) kids.push(S('circle', { cx: 22.5, cy: 9.5, r: 1.8, class: 'k-shell-dot' }));
      kids.push(S('text', { x: 16, y: 16 + shape[3] + lift, dy: '.36em', 'text-anchor': 'middle', 'font-size': shape[2], text: Array.from(String(name).trim())[0].toUpperCase() }));
    } else {
      kids.push(S('g', { class: 'k-shell-glyph', transform: 'translate(6.4 ' + (6.4 + (si === 5 ? -.5 : 0)) + ') scale(.8)' }, gl.map(function (d) {
        return S('path', d.charAt(0) === '!' ? { d: d.slice(1), class: 'k-shell-fill' } : { d: d });
      })));
    }
    return S('svg', { class: 'k-shell-logo', viewBox: '0 0 32 32', width: '100%', height: '100%', 'aria-hidden': 'true', focusable: 'false' }, kids);
  };

  // popover menu: button + role=menu; arrows, Home/End, Esc, outside click; returns {close}
  var popover = function (h, wrap, trig, menu) {
    var open = false;
    var items = function () { return [].filter.call(menu.querySelectorAll('[role^=menuitem]'), function (i) { return !i.hidden && i.getAttribute('aria-disabled') !== 'true'; }); };
    var set = function (v, focus) {
      open = v; menu.hidden = !v; trig.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v && focus) { var it = items(); (it.filter(function (i) { return i.getAttribute('aria-checked') === 'true' || i.getAttribute('aria-current') === 'page'; })[0] || it[0] || trig).focus(); }
    };
    trig.addEventListener('click', function (e) { set(!open, e.detail === 0); });
    trig.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); set(true, true); } });
    menu.addEventListener('keydown', function (e) {
      var it = items(), i = it.indexOf(document.activeElement), go = function (n) { e.preventDefault(); if (it.length) it[(n + it.length) % it.length].focus(); };
      if (e.key === 'ArrowDown') go(i + 1);
      else if (e.key === 'ArrowUp') go(i < 0 ? it.length - 1 : i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(it.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); set(false); trig.focus(); }
      else if (e.key === 'Tab') set(false);
    });
    var out = function (e) { if (open && !wrap.contains(e.target)) set(false); };
    document.addEventListener('click', out);
    h.cleanup(function () { document.removeEventListener('click', out); });
    return { close: function () { set(false); } };
  };

  K.block.define('shell', {
    version: '1.0',
    frame: false,
    emptyText: 'Nothing to show',
    schema: {
      brand: { type: 'object', required: true },
      nav: { type: 'array', required: true, of: { label: { type: 'text', required: true }, href: { type: 'string', required: true }, id: { type: 'string' } } },
      user: { type: 'object' },
      themes: { type: 'boolean', default: true },
      page: { type: 'object' },
      active: { type: 'string' },
      maxWidth: { type: 'number', default: 1200 }
    },
    render: function (el, c, h) {
      var brand = c.brand, user = c.user, nav = c.nav, page = c.page || (c.title != null ? { title: c.title, subtitle: c.subtitle, actions: c.actions } : null);
      if (brand.name == null || brand.name === '') throw new Error('brand.name is required');
      if (user && (user.name == null || user.name === '')) throw new Error('user.name is required');
      if (page && (page.title == null || page.title === '')) throw new Error('page.title is required');
      var E = h.el, mi = [];
      var inner = E('div', { class: NS + '-in', style: c.maxWidth > 0 ? { '--k-shell-max': c.maxWidth / 16 + 'rem' } : { '--k-shell-max': 'none' } });
      var bar = E('header', { class: NS + '-bar' }, inner);

      // brand
      var hasMark = brand.mark != null && brand.mark !== '';
      var markEl = hasMark ? E('span', { class: NS + '-mark', 'aria-hidden': 'true', text: Array.from(String(brand.mark)).slice(0, 2).join('') })
        : E('span', { class: NS + '-mark ' + NS + '-mark-svg', 'aria-hidden': 'true' }, logo(h, brand.name, brand.icon));
      inner.appendChild(E('a', { class: NS + '-brand', href: brand.href || (nav[0] && nav[0].href) || '#/', title: String(brand.name) }, [
        markEl, E('span', { class: NS + '-brand-name' }, E('span', { text: brand.name }))]));

      // nav + More
      var navEl = E('nav', { class: NS + '-nav', 'aria-label': 'Main' });
      var links = nav.map(function (n) {
        return E('a', { class: NS + '-link', href: n.href, id: n.id, title: String(n.label) }, E('span', { class: NS + '-lbl' }, E('span', { text: n.label })));
      });
      links.forEach(function (a) { navEl.appendChild(a); });
      var moreLabel = E('span', { text: 'More' });
      var moreBtn = E('button', { class: NS + '-link ' + NS + '-more-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, [moreLabel, icon(h, ICO.chev)]);
      var moreMenu = E('div', { class: NS + '-pop', role: 'menu', 'aria-label': 'More screens', hidden: true });
      nav.forEach(function (n) {
        var a = E('a', { class: NS + '-mi', role: 'menuitem', href: n.href, title: String(n.label) }, h.line(n.label, { title: String(n.label) }));
        mi.push(a); moreMenu.appendChild(a);
      });
      var more = E('div', { class: NS + '-rel', hidden: true }, [moreBtn, moreMenu]);
      var navWrap = E('div', { class: NS + '-navwrap' }, [navEl, more]);
      inner.appendChild(navWrap);
      var morePop = popover(h, more, moreBtn, moreMenu);
      mi.forEach(function (a) { a.addEventListener('click', function () { morePop.close(); }); });

      // end: theme menu + user chip
      var end = E('div', { class: NS + '-end' });
      if (c.themes) {
        var tBtn = E('button', { class: NS + '-ibtn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Theme', title: 'Theme' }, icon(h, ICO.theme));
        var tMenu = E('div', { class: NS + '-pop ' + NS + '-pop-end', role: 'menu', 'aria-label': 'Theme', hidden: true });
        var tWrap = E('div', { class: NS + '-rel' }, [tBtn, tMenu]);
        var tPop = popover(h, tWrap, tBtn, tMenu);
        var root = document.documentElement, rows = [];
        var addGroup = function (label, list, kind) {
          tMenu.appendChild(E('div', { class: NS + '-mh', role: 'presentation', text: label }));
          list.forEach(function (o) {
            var b = E('button', { class: NS + '-mi', type: 'button', role: 'menuitemradio', 'aria-checked': 'false' }, [h.line(o[1]), icon(h, ICO.check)]);
            b.addEventListener('click', function () {
              if (kind === 'palette') K.theme.set(o[0]);
              else { if (o[0] === 'system') { root.removeAttribute('data-theme'); ls('aidlc-ui-theme', null); } else { root.setAttribute('data-theme', o[0]); ls('aidlc-ui-theme', o[0]); } }
              sync(); tPop.close(); tBtn.focus();
            });
            tMenu.appendChild(b); rows.push({ b: b, kind: kind, v: o[0] });
          });
        };
        addGroup('Theme', THEMES, 'palette');
        addGroup('Appearance', MODES, 'mode');
        var sync = function () {
          var pal = K.theme.get(), mode = root.getAttribute('data-theme') || 'system', dark = pal === 'control';
          rows.forEach(function (r) {
            r.b.setAttribute('aria-checked', String(r.kind === 'palette' ? r.v === pal : r.v === (dark ? 'dark' : mode)));
            if (r.kind === 'mode') { if (dark) r.b.setAttribute('aria-disabled', 'true'); else r.b.removeAttribute('aria-disabled'); r.b.title = dark ? 'Control room is always dark' : ''; }
          });
          var nm = THEMES.filter(function (t) { return t[0] === pal; })[0];
          tBtn.title = 'Theme: ' + (nm ? nm[1] : pal);
        };
        document.addEventListener('k-theme', sync);
        h.cleanup(function () { document.removeEventListener('k-theme', sync); });
        sync();
        end.appendChild(tWrap);
      }
      if (user) {
        var ut = String(user.name) + (user.role ? ' \u00b7 ' + user.role : '');
        end.appendChild(E('div', { class: NS + '-user', title: ut }, [
          E('span', { class: NS + '-avatar', 'aria-hidden': 'true', text: initials(user.name) }),
          E('span', { class: NS + '-user-t' }, [E('span', { class: NS + '-user-n' }, E('span', { text: user.name })), user.role ? E('span', { class: NS + '-user-r' }, E('span', { text: user.role })) : null])]));
      }
      inner.appendChild(end);
      el.appendChild(bar);

      // page header
      if (page) {
        var acts = Array.isArray(page.actions) ? page.actions.filter(Boolean) : [];
        var pin = E('div', { class: NS + '-in ' + NS + '-page-in', style: c.maxWidth > 0 ? { '--k-shell-max': c.maxWidth / 16 + 'rem' } : { '--k-shell-max': 'none' } });
        var kind = page.status != null && page.status !== '' ? h.statusKind(page.status) : '';
        var titles = E('div', { class: NS + '-titles' }, [
          page.back && page.back.href ? E('a', { class: NS + '-back', href: page.back.href }, [E('span', { 'aria-hidden': 'true', text: '\u2190' }), E('span', { text: page.back.label || 'Back' })]) : null,
          E('div', { class: NS + '-h1row' }, [E('h1', { class: NS + '-h1', id: 'a-page-title', title: String(page.title) }, E('span', { text: page.title })),
            kind ? E('span', { class: 'k-b-pill k-s-' + kind, text: page.status }) : null]),
          page.subtitle != null && page.subtitle !== '' ? E('p', { class: NS + '-sub', title: String(page.subtitle), text: page.subtitle }) : null]);
        pin.appendChild(titles);
        if (acts.length) pin.appendChild(E('div', { class: NS + '-acts' }, acts.map(function (a) {
          return E(a.href ? 'a' : 'button', { class: 'k-b-btn' + (a.kind === 'primary' ? ' k-b-btn-primary' : ''), href: a.href, type: a.href ? null : 'button', id: a.id, text: a.label, on: a.onClick ? { click: a.onClick } : null });
        })));
        el.appendChild(E('div', { class: NS + '-page' }, pin));
      }

      // active item (no re-render on route change)
      var shown = links.length;
      var applyActive = function () {
        var ix = activeIndex(nav, currentRoute(), c.active);
        links.forEach(function (a, i) { if (i === ix) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        mi.forEach(function (a, i) { if (i === ix) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        if (ix >= shown) moreBtn.setAttribute('aria-current', 'true'); else moreBtn.removeAttribute('aria-current');
      };
      // one line, always: normal spacing, then tight, then the rest moves into More
      var layout = function () {
        if (!navWrap.clientWidth || !links.length) return;
        inner.classList.remove(NS + '-tight');
        links.forEach(function (a) { a.hidden = false; });
        more.hidden = true;
        var avail = navWrap.clientWidth - 1, gap = parseFloat(getComputedStyle(navEl).columnGap) || 0;
        var widths = function () { return links.map(function (a) { return a.getBoundingClientRect().width; }); };
        var total = function (w) { return w.reduce(function (s, x) { return s + x; }, 0) + gap * (w.length - 1); };
        var w = widths();
        shown = links.length;
        if (total(w) > avail) {
          inner.classList.add(NS + '-tight');
          w = widths();
          if (total(w) > avail) {
            more.hidden = false;
            var n = 0, used = 0, budget = avail - more.getBoundingClientRect().width - gap;
            for (var i = 0; i < w.length; i++) { var add = w[i] + (n ? gap : 0); if (used + add > budget) break; used += add; n++; }
            // hidden links after More is shown: nav becomes narrower, More sits right after it
            links.forEach(function (a, j) { a.hidden = j >= n; });
            shown = n;
            moreLabel.textContent = n ? 'More' : 'Menu';
          }
        }
        mi.forEach(function (a, j) { a.hidden = j < shown; });
        applyActive();
      };
      layout();
      h.resizeObserver(el, layout);
      var onRoute = function () { applyActive(); morePop.close(); };
      window.addEventListener('hashchange', onRoute);
      window.addEventListener('kit:route', onRoute);
      h.cleanup(function () { window.removeEventListener('hashchange', onRoute); window.removeEventListener('kit:route', onRoute); });
      if (document.fonts && document.fonts.ready) { var alive = true; h.cleanup(function () { alive = false; }); document.fonts.ready.then(function () { if (alive) layout(); }); }
    }
  });
})();
