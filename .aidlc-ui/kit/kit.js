/* AI-DLC UI kit 1.0 (MIT-0). Vanilla JS, no network. Driven by data- attributes (see README). */
(() => {
  'use strict';
  const d = document, root = d.documentElement;
  const $ = (s, r) => (r || d).querySelector(s);
  const $$ = (s, r) => [...(r || d).querySelectorAll(s)];
  const on = (e, ev, fn) => e.addEventListener(ev, fn);
  const mk = (tag, cls, text) => { const e = d.createElement(tag); e.className = cls || ''; if (text) e.textContent = text; return e; };
  const ls = (k, v) => { try { return v ? localStorage.setItem(k, v) : localStorage.getItem(k); } catch (e) { return null; } };

  /* theme */
  const saved = ls('aidlc-ui-theme');
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const sync = () => $$('[data-k-theme]:not(html)').forEach((b) => b.setAttribute('aria-pressed', isDark()));
  $$('[data-k-theme]:not(html)').forEach((b) => on(b, 'click', () => { root.dataset.theme = isDark() ? 'light' : 'dark'; ls('aidlc-ui-theme', root.dataset.theme); sync(); }));
  sync();

  /* toast */
  const live = d.body.appendChild(mk('div', 'k-toasts'));
  live.setAttribute('role', 'status');
  const toast = (msg, kind, ms) => {
    const t = live.appendChild(mk('div', 'k-toast' + (kind ? ' k-toast-' + kind : ''), msg));
    t.style.setProperty('--k-life', (ms || 4000) + 'ms'); // lets kit/motion.css time the exit
    setTimeout(() => t.remove(), ms || 4000);
  };
  window.kitToast = toast;
  on(d, 'click', (e) => { const b = e.target.closest('[data-k-toast]'); if (b) toast(b.dataset.kToast, b.dataset.kToastKind); });

  /* nav menu */
  const bar = $('.k-topbar'), btns = $$('[data-k-menu]');
  const menu = (open) => { if (bar) { bar.toggleAttribute('data-open', open); btns.forEach((b) => b.setAttribute('aria-expanded', open)); } };
  btns.forEach((b) => on(b, 'click', () => menu(!bar.hasAttribute('data-open'))));
  on(d, 'keydown', (e) => { if (e.key === 'Escape' && bar && bar.hasAttribute('data-open')) { menu(false); btns[0].focus(); } });

  /* hash router (data-route sections, data-k-nav, event kit:route) */
  const seg = (r) => r.split('/').slice(0, 2).join('/');
  let first = true;
  const route = () => {
    const secs = $$('[data-route]');
    if (!secs.length) return;
    const h = location.hash, rt = (s) => s.dataset.route;
    const hit = secs.find((s) => rt(s) === h) || secs.find((s) => h && seg(rt(s)) === seg(h)) || secs[0];
    secs.forEach((s) => { s.hidden = s !== hit; });
    // Nav highlight: data-k-nav / data-parent on the section name the nav route a detail screen belongs to (<section data-route="#/artist/AR-07" data-parent="#/lineup">);
    // without them the first two segments decide, and a singular detail route ("#/shipment/SP-1") still lights its plural list ("#/shipments").
    const cur = hit.dataset.kNav || hit.dataset.parent || rt(hit), h1 = $('h1', hit);
    const key = (r) => seg(r).replace(/s$/, '');
    const links = $$('.k-nav a[href^="#/"]');
    let on_ = links.filter((a) => seg(a.getAttribute('href')) === seg(cur));
    if (!on_.length) on_ = links.filter((a) => key(a.getAttribute('href')) === key(cur));
    links.forEach((a) => (on_.includes(a) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    menu(false);
    if (!first) { scrollTo(0, 0); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
    first = false;
    dispatchEvent(new CustomEvent('kit:route', { detail: { hash: h, route: rt(hit), section: hit } }));
  };
  on(window, 'hashchange', route);

  /* dialogs */
  $$('[data-k-open]').forEach((b) => on(b, 'click', () => { const x = $(b.dataset.kOpen); if (x && x.showModal) x.showModal(); }));
  $$('dialog').forEach((x) => { on(x, 'click', (e) => { if (e.target === x) x.close(); }); $$('[data-k-close]', x).forEach((b) => on(b, 'click', () => x.close())); });

  /* tabs */
  $$('[data-k-tabs]').forEach((box) => {
    const tabs = $$('[role=tab]', box);
    const sel = (i, focus) => {
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1; const p = d.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = i !== j; });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      on(t, 'click', () => sel(i));
      on(t, 'keydown', (e) => { const n = tabs.length, k = { ArrowRight: 1, ArrowLeft: n - 1 }[e.key]; if (k) { e.preventDefault(); sel((i + k) % n, true); } });
    });
    sel(Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')));
  });

  /* forms */
  $$('form[data-k-validate]').forEach((f) => {
    f.noValidate = true;
    on(f, 'submit', (e) => {
      e.preventDefault();
      let bad = null;
      $$('input,select,textarea', f).forEach((c) => {
        const ok = c.checkValidity(), box = c.closest('.k-field'), err = box && $('.k-error', box);
        c.setAttribute('aria-invalid', !ok);
        if (box) box.classList.toggle('is-invalid', !ok);
        if (err && !ok) err.textContent = c.dataset.error || c.validationMessage;
        if (!ok && !bad) bad = c;
      });
      if (bad) bad.focus(); else toast(f.dataset.kSuccess || 'Saved');
    });
  });

  /* tables: sort, filter, count, empty state, pager (attributes: see README) */
  const cell = (r, i) => { const c = r.cells[i]; return c ? (c.dataset.v != null ? c.dataset.v : c.textContent.trim()) : ''; };
  const render = (t) => {
    const st = t._k, size = +t.dataset.kPagesize || 0, id = '[data-k-%="#' + t.id + '"]';
    const all = $$('tbody tr', t);
    const vis = all.filter((r) => (!st.q || r.textContent.toLowerCase().includes(st.q)) && Object.keys(st.cols).every((c) => !st.cols[c] || cell(r, c).toLowerCase() === st.cols[c].toLowerCase()));
    const pages = size ? Math.max(1, Math.ceil(vis.length / size)) : 1;
    st.page = Math.min(st.page, pages - 1);
    all.forEach((r) => { r.hidden = true; });
    vis.forEach((r, i) => { r.hidden = size ? Math.floor(i / size) !== st.page : false; });
    $$(id.replace('%', 'count')).forEach((e) => { e.textContent = vis.length + (vis.length === 1 ? ' result' : ' results'); });
    $$(id.replace('%', 'empty')).forEach((e) => { e.hidden = vis.length > 0; });
    $$(id.replace('%', 'pager')).forEach((p) => {
      const rg = $('[data-k-range]', p), a = $('[data-k-prev]', p), n = $('[data-k-next]', p);
      if (rg) rg.textContent = vis.length ? st.page * size + 1 + '\u2013' + Math.min(vis.length, (st.page + 1) * size) + ' of ' + vis.length : '0 of 0';
      if (a) a.disabled = st.page <= 0;
      if (n) n.disabled = st.page >= pages - 1;
    });
  };
  const sortBy = (t, i, dir) => {
    const ths = $$('thead th', t), num = ths[i].dataset.kSort === 'num', body = $('tbody', t);
    $$('tr', body).sort((a, b) => dir * (num ? parseFloat(cell(a, i)) - parseFloat(cell(b, i)) : cell(a, i).localeCompare(cell(b, i), undefined, { numeric: true }))).forEach((r) => body.appendChild(r));
    ths.forEach((h, j) => h.dataset.kSort && h.setAttribute('aria-sort', j === i ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
    t._k.page = 0;
    render(t);
  };
  $$('table[data-k-table]').forEach((t) => {
    t._k = { q: '', cols: {}, page: 0 };
    $$('thead th', t).forEach((th, i) => {
      if (!th.dataset.kSort) return;
      const b = mk('button', 'k-sort');
      b.type = 'button';
      while (th.firstChild) b.appendChild(th.firstChild);
      th.appendChild(b);
      th.setAttribute('aria-sort', 'none');
      on(b, 'click', () => sortBy(t, i, th.getAttribute('aria-sort') === 'ascending' ? -1 : 1));
    });
    $$('[data-k-pager="#' + t.id + '"]').forEach((p) => {
      on(p, 'click', (e) => { const b = e.target.closest('button'); if (b) { t._k.page += b.hasAttribute('data-k-next') ? 1 : -1; render(t); } });
    });
    render(t);
  });
  $$('[data-k-filter]').forEach((c) => {
    const t = $(c.dataset.kFilter), col = c.dataset.kCol;
    if (!t || !t._k) return;
    const apply = (v) => { if (col == null) t._k.q = v.trim().toLowerCase(); else t._k.cols[col] = v; t._k.page = 0; render(t); };
    if (c.tagName === 'BUTTON') on(c, 'click', () => { $$('[data-k-filter="' + c.dataset.kFilter + '"][data-k-col="' + col + '"]').forEach((o) => o.setAttribute('aria-pressed', o === c)); apply(c.dataset.kValue || ''); });
    else on(c, c.tagName === 'SELECT' ? 'change' : 'input', () => apply(c.value));
  });
  $$('[data-k-sortby]').forEach((s) => { const t = $(s.dataset.kSortby); if (t && t._k) on(s, 'change', () => { const [i, dir] = s.value.split(':'); if (i) sortBy(t, +i, dir === 'desc' ? -1 : 1); }); });

  /* polish: ids and times never wrap, wide tables scroll inside their card, maps keep their marker size (runs now and for everything a script adds later) */
  const TOKEN = /\b[A-Z]{2,5}-\d{1,5}\b|\b\d{1,2}:\d{2}(?:\s?[\u2013-]\s?\d{1,2}:\d{2})?\b/g;
  const SKIP = 'script,style,textarea,option,title,svg,.k-nowrap,.k-break,[contenteditable],input,select,button[data-k-sort]';
  const nowrapText = (node) => {
    const w = d.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.length > 3 && !(t.parentElement && t.parentElement.closest(SKIP)) && /[A-Z]{2,5}-\d|\d:\d{2}/.test(t.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach((t) => {
      const txt = t.nodeValue, frag = d.createDocumentFragment();
      let at = 0, m;
      TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(txt))) { if (m.index > at) frag.appendChild(d.createTextNode(txt.slice(at, m.index))); frag.appendChild(mk('span', 'k-nowrap', m[0])); at = m.index + m[0].length; }
      if (at) { if (at < txt.length) frag.appendChild(d.createTextNode(txt.slice(at))); t.replaceWith(frag); }
    });
  };
  const units = (svg) => { const w = svg.clientWidth, fw = +svg.dataset.fw; if (w && fw) svg.style.setProperty('--k-u', (fw / w).toFixed(3)); };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => es.forEach((e) => units(e.target))) : null;
  const polish = (scope) => {
    nowrapText(scope.nodeType === 1 || scope.nodeType === 11 ? scope : d.body);
    if (scope.querySelectorAll) {
      const within = (sel) => (scope.matches && scope.matches(sel) ? [scope] : []).concat($$(sel, scope));
      within('table.k-table').forEach((t) => { const n = $$('thead th', t).length; if (n >= 7 && !t.classList.contains('k-table-wide')) { t.classList.add('k-table-wide'); t.style.setProperty('--k-cols', n); } });
      within('svg.k-basemap[data-fw]').forEach((s) => { if (!s._ku) { s._ku = 1; units(s); if (ro) ro.observe(s); } });
    }
  };
  polish(d.body);
  if (typeof MutationObserver === 'function') {
    let pend = [], queued = false;
    new MutationObserver((ms) => {
      ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !(n.classList && n.classList.contains('k-nowrap'))) pend.push(n); }));
      if (pend.length && !queued) { queued = true; requestAnimationFrame(() => { const l = pend; pend = []; queued = false; l.forEach((n) => { if (n.isConnected) polish(n); }); }); }
    }).observe(d.body, { childList: true, subtree: true });
  }

  const ready = () => { root.dataset.ready = ''; };
  window.kit = { toast, route, ready, refresh: (sel) => $(sel)._k && render($(sel)) };
  route();
})();
