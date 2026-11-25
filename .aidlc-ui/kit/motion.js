/* AI-DLC UI kit motion 1.0 (MIT-0). Opt-in animations: nothing moves unless an element asks for it (data-k-anim, data-k-stagger, data-k-countup,
   data-k-progress, data-k-ring, data-k-load, data-k-confetti, data-k-motion). Vanilla JS + Web Animations, no network, works from file://.
   Motion only runs when the user allows it: with prefers-reduced-motion: reduce (or <html data-k-reduce>) every element stays in its final state.
   API: window.kitMotion (README, "Motion"). */
(() => {
  'use strict';
  if (window.kitMotion) return;
  const d = document, root = d.documentElement;
  const $$ = (s, r) => [...(r || d).querySelectorAll(s)];
  const mk = (tag, cls, text) => { const e = d.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const sv = (tag, a) => { const e = d.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const num = (v, f) => { const n = parseFloat(v); return Number.isFinite(n) ? n : f; };
  const EASE = 'cubic-bezier(.22,1,.36,1)', SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const allowed = () => !(mq.matches || root.hasAttribute('data-k-reduce'));
  const recs = new Set();
  const FROM = { fade: 'none', 'fade-up': 'translateY(18px)', 'fade-down': 'translateY(-18px)', 'fade-left': 'translateX(-24px)', scale: 'scale(.92)', blur: 'scale(.98)' };
  const KIND = { 'count-up': 'count', draw: 'draw', type: 'text', words: 'text', marquee: 'marquee', indicator: 'indicator', check: 'check', skeleton: 'load' };
  const toks = (el) => (el.dataset.kAnim || '').split(/\s+/).filter(Boolean);
  const opt = (el) => ({ delay: num(el.dataset.kDelay, 0), dur: num(el.dataset.kDuration, 600) });
  const kill = (el) => { try { el.getAnimations({ subtree: true }).forEach((a) => a.cancel()); } catch (e) { /* old engines */ } };

  /* one entrance of el: opacity + transform (blur also filter); the element is hidden by .k-m-pend until it plays */
  const enter = (el, name, delay, dur) => {
    const from = { opacity: 0, transform: FROM[name] || 'none' }, to = { opacity: 1, transform: 'none' };
    if (name === 'blur') { from.filter = 'blur(8px)'; to.filter = 'blur(0)'; }
    const a = el.animate([from, to], { duration: dur, delay, easing: EASE, fill: 'backwards' });
    el.classList.remove('k-m-pend');
    return a;
  };

  /* ---- number parsing for count-up: "1,284" "98.6%" "EUR 12.5k" -> { pre, suf, to, dec, group, loc } */
  const parseNum = (s) => {
    const m = /^(\D*?)(\d[\d.,\s\u00a0\u202f]*)(\D*)$/.exec(s.trim());
    if (!m) return null;
    const trail = (/[\s\u00a0\u202f]+$/.exec(m[2]) || [''])[0], spaced = /\d[\s\u00a0\u202f]\d/.test(m[2]);
    const n = m[2].replace(/[\s\u00a0\u202f]/g, '');
    const c = n.lastIndexOf(','), p = n.lastIndexOf('.'), i = Math.max(c, p);
    let dec = 0, whole = n, frac = '';
    if (i >= 0) {
      const sep = n[i], tail = n.length - i - 1, many = n.split(sep).length > 2;
      const eu = /^(es|de|it|pt|nl|tr|id|da|el)/i.test(root.lang || '');
      if (c >= 0 && p >= 0) dec = tail; else if (!many && (tail !== 3 || (sep === '.' && !eu))) dec = tail;
      if (dec) { whole = n.slice(0, i); frac = n.slice(i + 1); }
    }
    const to = parseFloat(whole.replace(/[.,]/g, '') + (frac ? '.' + frac : ''));
    if (!Number.isFinite(to)) return null;
    const group = /[.,]\d{3}/.test(whole + (dec ? '' : '.')) || /\d[.,]\d{3}/.test(n.slice(0, dec ? i : n.length));
    return { pre: m[1], suf: trail + m[3], to, dec, group: group || spaced, loc: spaced ? 'fr-FR' : (dec && n[i] === ',') || (!dec && n.includes('.')) ? 'de-DE' : 'en-US' };
  };

  const K = {};  // kinds: build (once), prep (before state), play, done (final state)
  const parts = (host) => ({ line: $$('.k-line,.k-ser-line:not(.k-ser-over)', host), area: $$('.k-area,.k-ser-area', host), dot: $$('.k-pt,.k-ser-dot', host),
    bar: $$('.k-bar', host), hbar: $$('.k-bars-fill,.k-bars-seg', host), donut: $$('.k-donut', host) });

  /* entrance on scroll: fade, fade-up, fade-down, fade-left, scale, blur */
  K.reveal = {
    prep: (r) => r.el.classList.add('k-m-pend'),
    play: (r) => { const o = opt(r.el); enter(r.el, toks(r.el).find((t) => FROM[t]), o.delay, o.dur); },
    done: (r) => { kill(r.el); r.el.classList.remove('k-m-pend'); }
  };

  /* staggered children: data-k-stagger[=ms] [data-k-anim=<effect>] [data-k-stagger-of=<selector>] */
  const kids = (h) => (h.dataset.kStaggerOf ? $$(h.dataset.kStaggerOf, h) : [...h.children]);
  K.stagger = {
    prep: (r) => { if (!r.played) kids(r.el).forEach((k) => k.classList.add('k-m-pend')); },
    play: (r) => {
      const ks = kids(r.el), step = Math.min(num(r.el.dataset.kStagger, 70), 900 / Math.max(1, ks.length - 1)), o = opt(r.el), name = toks(r.el).find((t) => FROM[t]) || 'fade-up';
      ks.forEach((k, i) => enter(k, name, o.delay + i * step, o.dur));
    },
    done: (r) => kids(r.el).forEach((k) => { kill(k); k.classList.remove('k-m-pend'); })
  };

  /* number count-up: data-k-countup[=target] or data-k-anim="count-up" on a container (KPI numbers, [data-k-countup]); optional data-k-from, data-k-duration */
  const cTargets = (el) => (el.matches('[data-k-countup]') || !el.firstElementChild ? [el] : $$('[data-k-countup],.k-kpi-num', el));
  K.count = {
    prep: (r) => cTargets(r.el).forEach((t) => {
      if (!t._kc) { const p = parseNum(t.dataset.kCountup && !/^\s*$/.test(t.dataset.kCountup) ? t.dataset.kCountup : t.textContent); if (!p) return; p.text = t.textContent; t._kc = p; }
      t.classList.add('k-m-num');
      t.textContent = fmt(t._kc, num(r.el.dataset.kFrom, 0));
    }),
    play: (r) => {
      const o = opt(r.el), dur = num(r.el.dataset.kDuration, 1200), from = num(r.el.dataset.kFrom, 0), ts = cTargets(r.el).filter((t) => t._kc), t0 = performance.now() + o.delay;
      r.stop = false;
      const tick = (now) => {
        if (r.stop) return;
        const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
        ts.forEach((t) => { t.textContent = p >= 1 ? t._kc.text : fmt(t._kc, from + (t._kc.to - from) * e); });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    done: (r) => { r.stop = true; cTargets(r.el).forEach((t) => { if (t._kc) t.textContent = t._kc.text; }); }
  };
  const fmt = (c, v) => c.pre + new Intl.NumberFormat(c.loc, { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec, useGrouping: c.group }).format(v) + c.suf;

  /* progress bar: <div data-k-progress="72" aria-label="Upload"></div> (0-100, data-k-max) and ring: <div data-k-ring="72"></div> */
  const prog = (r, ring) => { const el = r.el, max = num(el.dataset.kMax, 100), v = Math.max(0, Math.min(max, num(el.dataset[ring ? 'kRing' : 'kProgress'], 0))); r.v = v / max; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-valuemin', 0); el.setAttribute('aria-valuemax', max); el.setAttribute('aria-valuenow', v); };
  K.bar = {
    build: (r) => { r.el.classList.add('k-m-bar'); prog(r); },
    prep: (r) => r.el.style.setProperty('--k-p', 0),
    play: (r) => { r.el.style.setProperty('--k-delay', opt(r.el).delay + 'ms'); r.el.style.setProperty('--k-p', r.v); },
    done: (r) => r.el.style.setProperty('--k-p', r.v)
  };
  K.ring = {
    build: (r) => {
      const el = r.el; prog(r, true); el.classList.add('k-m-ring');
      if (el.querySelector('svg')) return;
      const s = sv('svg', { viewBox: '0 0 44 44', 'aria-hidden': 'true', focusable: 'false' });
      s.append(sv('circle', { class: 'k-m-ring-bg', cx: 22, cy: 22, r: 19 }), sv('circle', { class: 'k-m-ring-fg', cx: 22, cy: 22, r: 19, pathLength: 100 }));
      const t = mk('span', 'k-m-ring-val', el.dataset.kRingText || Math.round(r.v * 100) + '%');
      t.setAttribute('data-k-countup', '');
      el.prepend(s, t);
    },
    prep: (r) => r.el.style.setProperty('--k-p', 0),
    play: (r) => { r.el.style.setProperty('--k-delay', opt(r.el).delay + 'ms'); r.el.style.setProperty('--k-p', r.v); },
    done: (r) => r.el.style.setProperty('--k-p', r.v)
  };

  /* chart draw-in: lines draw, bars grow from the baseline, areas, dots and donuts fade in (kit charts and the series/bars blocks) */
  K.draw = {
    prep: (r) => r.el.classList.add('k-m-pend'),
    play: (r) => {
      const h = r.el, p = parts(h), o = opt(h), dur = num(h.dataset.kDuration, 1000), opts = (delay) => ({ duration: dur, delay: o.delay + delay, easing: EASE, fill: 'backwards' });
      p.line.forEach((l, i) => {
        l.setAttribute('pathLength', 1);
        const a = l.animate([{ strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDasharray: 1, strokeDashoffset: 0 }], opts(i * 120));
        a.onfinish = a.oncancel = () => l.removeAttribute('pathLength');
      });
      p.area.forEach((e) => e.animate([{ opacity: 0 }], opts(dur * .4)));
      p.dot.forEach((e, i) => e.animate([{ opacity: 0, transform: 'scale(.4)', transformBox: 'fill-box', transformOrigin: 'center' }], opts(dur * .5 + Math.min(i, 12) * 30)));
      p.bar.forEach((e, i) => e.animate([{ transform: 'scaleY(0)', transformBox: 'fill-box', transformOrigin: '50% 100%' }], opts(Math.min(i, 20) * 45)));
      p.hbar.forEach((e, i) => e.animate([{ transform: 'scaleX(0)', transformOrigin: '0 50%' }], opts(Math.min(i, 20) * 45)));
      p.donut.forEach((e) => e.animate([{ opacity: 0, transform: 'rotate(-60deg) scale(.88)' }], opts(0)));
      if (!h.querySelector('svg,.k-bars')) h.animate([{ opacity: 0, transform: 'translateY(12px)' }], opts(0));
      h.classList.remove('k-m-pend');
    },
    done: (r) => { kill(r.el); r.el.classList.remove('k-m-pend'); }
  };

  /* text: data-k-anim="type" (typewriter with caret) or "words" (word by word); the full text stays readable for assistive tech */
  K.text = {
    build: (r) => {
      const el = r.el, txt = el.textContent.replace(/\s+/g, ' ').trim(); r.txt = txt;
      const sr = mk('span', 'k-sr', txt), vis = mk('span', 'k-m-txt'); vis.setAttribute('aria-hidden', 'true');
      const words = txt.split(' '), chars = [];
      words.forEach((w, i) => {
        const ws = mk('span', 'k-m-w'); ws.style.setProperty('--k-i', i);
        [...w].forEach((c) => { const s = mk('span', 'k-m-c', c); ws.append(s); chars.push(s); });
        vis.append(ws, i < words.length - 1 ? d.createTextNode(' ') : '');
      });
      r.chars = chars; r.words = [...vis.querySelectorAll('.k-m-w')];
      el.textContent = ''; el.append(sr, vis);
    },
    prep: (r) => r.el.classList.add('k-m-pend-txt'),
    play: (r) => {
      const el = r.el, o = opt(el), mode = toks(el).includes('words') ? 'words' : 'type';
      r.t = r.t || []; r.t.forEach(clearTimeout); r.t.length = 0;
      if (mode === 'words') {
        const step = Math.min(num(el.dataset.kSpeed, 70), 900 / Math.max(1, r.words.length - 1));
        r.words.forEach((w, i) => w.animate([{ opacity: 0, transform: 'translateY(.5em)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: o.delay + i * step, easing: EASE, fill: 'backwards' }));
        el.classList.remove('k-m-pend-txt'); return;
      }
      const speed = num(el.dataset.kSpeed, 28), caret = mk('span', 'k-m-caret'); caret.setAttribute('aria-hidden', 'true');
      el.classList.remove('k-m-pend-txt'); el.classList.add('k-m-typing');
      r.chars.forEach((c) => c.classList.remove('k-m-on'));
      r.chars.forEach((c, i) => r.t.push(setTimeout(() => { c.classList.add('k-m-on'); c.after(caret); }, o.delay + i * speed)));
      r.t.push(setTimeout(() => { caret.remove(); el.classList.remove('k-m-typing'); }, o.delay + r.chars.length * speed + 900));
    },
    done: (r) => { (r.t || []).forEach(clearTimeout); kill(r.el); r.el.classList.remove('k-m-pend-txt', 'k-m-typing'); (r.chars || []).forEach((c) => c.classList.add('k-m-on')); const c = r.el.querySelector('.k-m-caret'); if (c) c.remove(); }
  };

  /* success check: data-k-anim="check" on an empty span; circle and tick draw themselves */
  K.check = {
    build: (r) => {
      if (r.el.querySelector('svg')) return;
      const s = sv('svg', { class: 'k-m-check-svg', viewBox: '0 0 52 52', 'aria-hidden': 'true', focusable: 'false' });
      s.append(sv('circle', { class: 'k-m-check-halo', cx: 26, cy: 26, r: 24 }), sv('circle', { class: 'k-m-check-ring', cx: 26, cy: 26, r: 23, pathLength: 1 }), sv('path', { class: 'k-m-check-tick', d: 'M15 27.5l8 8 15-17', pathLength: 1 }));
      r.el.classList.add('k-m-check'); r.el.append(s);
    },
    prep: (r) => r.el.classList.add('k-m-pend'),
    play: (r) => {
      const s = r.el.querySelector('svg'), q = (c) => s.querySelector(c), o = opt(r.el);
      q('.k-m-check-halo').animate([{ opacity: 0, transform: 'scale(.4)' }], { duration: 700, delay: o.delay, easing: EASE, fill: 'backwards' });
      q('.k-m-check-ring').animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: o.delay, easing: 'ease-out', fill: 'backwards' });
      q('.k-m-check-tick').animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 360, delay: o.delay + 420, easing: 'ease-out', fill: 'backwards' });
      s.animate([{ transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 520, delay: o.delay + 380, easing: SPRING, fill: 'backwards' });
      r.el.classList.remove('k-m-pend');
    },
    done: (r) => { kill(r.el); r.el.classList.remove('k-m-pend'); }
  };

  /* skeleton to content: <div data-k-load="1200"><div data-k-skel>...shapes...</div><div data-k-content>...</div></div>; kitMotion.loaded(host) swaps by hand */
  const swap = (r, anim) => {
    const h = r.el, sk = h.querySelector('[data-k-skel]'), ct = h.querySelector('[data-k-content]');
    clearTimeout(r.timer); h.removeAttribute('aria-busy');
    if (sk) { if (anim) sk.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = () => { sk.hidden = true; }; else sk.hidden = true; }
    if (ct) { ct.hidden = false; if (anim) ct.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: EASE, fill: 'backwards' }); }
  };
  K.load = {
    prep: (r) => { const h = r.el, sk = h.querySelector('[data-k-skel]'), ct = h.querySelector('[data-k-content]'); clearTimeout(r.timer); if (sk) { sk.hidden = false; sk.setAttribute('aria-hidden', 'true'); kill(sk); } if (ct) { ct.hidden = true; kill(ct); } h.setAttribute('aria-busy', 'true'); },
    play: (r) => { const ms = r.el.dataset.kLoad; if (ms !== '' && ms != null) r.timer = setTimeout(() => swap(r, true), num(ms, 1200)); },
    done: (r) => swap(r, false)
  };

  /* marquee: data-k-anim="marquee" [data-k-speed=px per second]; pauses on hover and focus, has its own Pause button */
  K.marquee = {
    prep: (r) => {
      const el = r.el; if (el._kmq) return;
      const track = mk('div', 'k-m-track'), a = mk('div', 'k-m-set'), b = mk('div', 'k-m-set');
      while (el.firstChild) a.append(el.firstChild);
      b.append(...[...a.children].map((c) => c.cloneNode(true))); b.setAttribute('aria-hidden', 'true'); b.querySelectorAll('a,button,input,[tabindex]').forEach((x) => { x.tabIndex = -1; });
      track.append(a, b); el.append(track); el.classList.add('k-m-marquee');
      const btn = mk('button', 'k-btn k-btn-sm k-btn-ghost k-m-pause', 'Pause'); btn.type = 'button'; btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => { const p = el.toggleAttribute('data-paused'); btn.setAttribute('aria-pressed', p); btn.textContent = p ? 'Play' : 'Pause'; });
      el.after(btn); el._kmq = { track, a, btn };
      const w = a.getBoundingClientRect().width || 600;
      track.style.setProperty('--k-dur', Math.max(8, w / num(el.dataset.kSpeed, 40)).toFixed(1) + 's');
    },
    done: (r) => {
      const el = r.el, q = el._kmq; if (!q) return;
      while (q.a.firstChild) el.append(q.a.firstChild);
      q.track.remove(); q.btn.remove(); el.classList.remove('k-m-marquee'); el.removeAttribute('data-paused'); el._kmq = null;
    },
    now: true
  };

  /* sliding indicator under tabs, segmented controls and nav links: data-k-anim="indicator" on (or around) a tablist / radiogroup / .k-seg */
  const IND = '[aria-selected=true],[aria-checked=true],[aria-pressed=true],[aria-current=page],[aria-current=true]';
  K.indicator = {
    prep: (r) => {
      const h = r.el, g = h.matches('[role=tablist],[role=radiogroup],.k-tabs,.k-seg,.k-nav') ? h : h.querySelector('[role=tablist],[role=radiogroup],.k-tabs,.k-seg,.k-nav');
      if (!g || !g.isConnected) return;
      let ind = g.querySelector(':scope > .k-m-ind'), fresh = !ind;
      if (fresh) { ind = mk('span', 'k-m-ind'); ind.setAttribute('aria-hidden', 'true'); g.append(ind); g.classList.add('k-m-ind-on'); }
      const place = (anim) => {
        const sel = g.querySelector(IND); if (!sel) return;
        const gr = g.getBoundingClientRect(), s = sel.getBoundingClientRect(); if (!gr.width || !s.width) return;
        const v = { x: s.left - gr.left - g.clientLeft + g.scrollLeft, y: s.top - gr.top - g.clientTop, w: s.width, h: s.height };
        const set = (o) => { ind.style.setProperty('--k-ix', o.x + 'px'); ind.style.setProperty('--k-iy', o.y + 'px'); ind.style.setProperty('--k-iw', o.w + 'px'); ind.style.setProperty('--k-ih', o.h + 'px'); };
        if (!anim) { ind.style.transition = 'none'; set(h._kLast && fresh ? h._kLast : v); void ind.offsetWidth; ind.style.transition = ''; }
        set(v); h._kLast = v; g.classList.add('k-m-ind-ready');
      };
      place(false);
      if (!g._kio) {
        g._kio = true;
        new MutationObserver((ms) => { if (ms.some((m) => m.type === 'attributes')) place(true); }).observe(g, { attributes: true, subtree: true, attributeFilter: ['aria-selected', 'aria-checked', 'aria-pressed', 'aria-current'] });
        if (typeof ResizeObserver === 'function') new ResizeObserver(() => place(false)).observe(g);
      }
    },
    done: (r) => { $$('.k-m-ind', r.el).forEach((i) => { i.parentElement.classList.remove('k-m-ind-on', 'k-m-ind-ready'); i.remove(); }); },
    now: true,
    live: true
  };

  /* ---- records, scanning, visibility */
  const X = {};  // kinds added by kit/motion-fx.js (kitMotion.define): attribute -> kind
  const kindOf = (el) => {
    const a = toks(el);
    for (const at in X) if (el.hasAttribute(at)) return X[at];
    if ('kStagger' in el.dataset) return 'stagger';
    if ('kRing' in el.dataset) return 'ring';
    if ('kProgress' in el.dataset) return 'bar';
    if ('kLoad' in el.dataset) return 'load';
    for (const t of a) if (KIND[t]) return KIND[t];
    if (a.some((t) => FROM[t])) return 'reveal';
    if ('kCountup' in el.dataset) return 'count';
    return null;
  };
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const r = e.target._km; if (r && r.on && !r.played) { r.played = true; if (K[r.kind].play) K[r.kind].play(r); }
  }), { rootMargin: '0px 0px -8% 0px' }) : null;
  const start = (r) => {
    const k = K[r.kind]; r.played = false; r.on = true;
    if (k.prep) k.prep(r);
    if (k.now || !io) { r.played = true; if (k.play) k.play(r); } else io.observe(r.el);
  };
  const stop = (r) => { const k = K[r.kind]; r.on = false; if (io) io.unobserve(r.el); if (k.done) k.done(r); };
  const register = (el) => {
    if (el._km) return;
    const kind = kindOf(el); if (!kind) return;
    if (kind === 'count' && el.parentElement && el.parentElement.closest('[data-k-anim~=count-up]')) return;
    const r = (el._km = { el, kind, on: false, played: false });
    recs.add(r);
    if (K[kind].build) K[kind].build(r);
    if (allowed()) start(r); else stop(r);
  };
  let SEL = '[data-k-anim],[data-k-stagger],[data-k-countup],[data-k-progress],[data-k-ring],[data-k-load]';
  const scan = (scope) => {
    const s = scope || d;
    if (s.nodeType === 1 && s.matches(SEL)) register(s);
    $$(SEL, s).forEach(register);
    for (const r of recs) if (!r.el.isConnected) recs.delete(r);
    fx();
  };

  /* ---- page-level effects: data-k-motion="toast dialog page press" (or "all") on any element switches them on for the whole page */
  const fx = () => {
    const set = new Set();
    $$('[data-k-motion]').concat(root.hasAttribute('data-k-motion') ? [root] : []).forEach((e) => e.dataset.kMotion.split(/\s+/).forEach((t) => t && set.add(t)));
    (kitMotion._fx || []).forEach((t) => set.add(t));
    if (set.has('all')) ['toast', 'dialog', 'page', 'press'].forEach((t) => set.add(t));
    if (set.size) root.setAttribute('data-k-fx', [...set].join(' ')); else root.removeAttribute('data-k-fx');
  };
  const has = (t) => (root.getAttribute('data-k-fx') || '').split(' ').includes(t) && allowed();

  const ripple = (e) => {
    if (e.button || !allowed()) return;
    const t = e.target.closest && e.target.closest('[data-k-anim~=ripple],.k-btn:not(:disabled)');
    if (!t || (!t.matches('[data-k-anim~=ripple]') && !has('press'))) return;
    const r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, rp = mk('span', 'k-m-rip');
    rp.style.cssText = 'left:' + (e.clientX - r.left || r.width / 2) + 'px;top:' + (e.clientY - r.top || r.height / 2) + 'px;width:' + s + 'px;height:' + s + 'px';
    t.classList.add('k-m-rip-host'); t.append(rp);
    rp.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: .35 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 620, easing: 'ease-out' }).onfinish = () => rp.remove();
  };
  d.addEventListener('pointerdown', ripple);

  const COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--ok'];
  const confetti = (from, n) => {
    if (!allowed()) return 0;
    n = n || 40;
    let x = innerWidth / 2, y = innerHeight * .35;
    const el = typeof from === 'string' ? d.querySelector(from) : from;
    if (el && el.getBoundingClientRect) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } else if (from && from.x != null) { x = from.x; y = from.y; }
    const box = mk('div', 'k-m-confetti'); box.setAttribute('aria-hidden', 'true');
    const done = [];
    for (let i = 0; i < n; i++) {
      const p = mk('span', 'k-m-piece' + (i % 3 === 0 ? ' k-m-round' : '')), ang = (-90 + (Math.random() - .5) * 140) * Math.PI / 180, v = 90 + Math.random() * 170;
      const dx = Math.cos(ang) * v, up = -Math.sin(ang) * v * .75, fall = 120 + Math.random() * 180, rot = (Math.random() - .5) * 900;
      p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--c:var(' + COLORS[i % COLORS.length] + ')';
      box.append(p);
      done.push(p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + dx * .7 + 'px,' + -up + 'px) rotate(' + rot * .5 + 'deg)', opacity: 1, offset: .38 },
        { transform: 'translate(' + dx + 'px,' + (fall - up * .2) + 'px) rotate(' + rot + 'deg)', opacity: 0 }], { duration: 1100 + Math.random() * 700, delay: Math.random() * 90, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }).finished);
    }
    d.body.append(box);
    Promise.allSettled(done).then(() => box.remove());
    return n;
  };
  d.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-k-confetti]'); if (b) confetti(b, num(b.dataset.kConfetti, 40)); });

  /* spotlight on .k-glow cards: the glow follows the pointer */
  d.addEventListener('pointermove', (e) => { const g = e.target.closest && e.target.closest('.k-glow'); if (g && allowed()) { const r = g.getBoundingClientRect(); g.style.setProperty('--k-mx', e.clientX - r.left + 'px'); g.style.setProperty('--k-my', e.clientY - r.top + 'px'); } });

  /* page transition: the screen that becomes visible slides in */
  let first = true;
  addEventListener('kit:route', (e) => {
    if (first) { first = false; return; }
    const s = e.detail && e.detail.section;
    if (s && has('page')) s.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE });
  });

  /* ---- live updates: new nodes (blocks render after load), and the reduced-motion preference changing at run time */
  if (typeof MutationObserver === 'function') {
    let pend = [], queued = false;
    new MutationObserver((ms) => {
      ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !(n.classList && (n.classList.contains('k-m-rip') || n.classList.contains('k-m-piece')))) pend.push(n); }));
      if (pend.length && !queued) {
        queued = true;
        requestAnimationFrame(() => {
          const l = pend; pend = []; queued = false;
          l.forEach((n) => {
            if (!n.isConnected) return;
            const h = n.closest && n.closest('[data-k-stagger],[data-k-anim~=count-up],[data-k-anim~=draw],[data-k-anim~=indicator],[data-k-countup]');
            if (h && h._km && h._km.on && (h._km.kind === 'indicator' || !h._km.played) && !n.closest('.k-m-ind')) K[h._km.kind].prep(h._km);
            scan(n);
          });
        });
      }
    }).observe(d.body, { childList: true, subtree: true });
  }
  const sync = () => {
    const on = allowed();
    if (on) root.setAttribute('data-k-m', ''); else root.removeAttribute('data-k-m');
    recs.forEach((r) => { if (on && !r.on) start(r); else if (!on && r.on) stop(r); });
  };
  mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);
  addEventListener('beforeprint', () => recs.forEach((r) => r.on && K[r.kind].done && K[r.kind].done(r)));
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-k-reduce'] });

  const replay = (t) => {
    const el = typeof t === 'string' ? d.querySelector(t) : t; if (!el) return;
    const list = [el, ...$$(SEL, el)].map((e) => e._km).filter(Boolean);
    list.forEach(stop);
    requestAnimationFrame(() => list.forEach((r) => { if (allowed()) start(r); }));
  };
  const kitMotion = window.kitMotion = {
    version: '1.0',
    scan, replay, confetti,
    reduced: () => !allowed(),
    define: (kind, def) => { K[kind] = def; if (def.attr) { X[def.attr] = kind; SEL += ',[' + def.attr + ']'; } scan(d); },
    _h: { $$, mk, sv, num, allowed, EASE, toks, opt },
    loaded: (t) => { const el = typeof t === 'string' ? d.querySelector(t) : t; if (el && el._km && el._km.kind === 'load') swap(el._km, allowed()); },
    enable: (...names) => { kitMotion._fx = (kitMotion._fx || []).concat(names); fx(); },
    pause: () => root.setAttribute('data-k-paused', ''),
    resume: () => root.removeAttribute('data-k-paused')
  };
  sync();
  scan(d);
})();
