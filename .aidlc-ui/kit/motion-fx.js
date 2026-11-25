/* AI-DLC UI kit motion-fx 1.0 (MIT-0). The "wow" pack on top of motion.js: morph between screens, 3D tilt card, aurora background, text scramble, drag with physics,
   particles, scroll story, magnetic button, shatter, cursor trail, 3D carousel, page flip, spotlight, fireworks. Opt-in by attribute (README "Motion", second table).
   Rules: requestAnimationFrame only while something moves (an idle page costs nothing), heavy effects (aurora, particles) run for one element at a time and pause when off screen
   or when the tab is hidden, particle counts are capped, and under prefers-reduced-motion (or <html data-k-reduce>) nothing moves: every effect shows its final state. */
(() => {
  'use strict';
  const M = window.kitMotion;
  if (!M || !M.define || M.fx) return;
  M.fx = '1.0';
  const { $$, mk, sv, num, allowed, EASE } = M._h;
  const d = document, root = d.documentElement, raf = requestAnimationFrame;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const $ = (s, r) => (r || d).querySelector(s);
  const pick = (el) => (typeof el === 'string' ? $(el) : el);
  const colors = (names) => { const p = mk('span'); p.style.cssText = 'position:absolute;visibility:hidden'; d.body.append(p); const out = names.map((n) => { p.style.color = 'var(' + n + ')'; return getComputedStyle(p).color; }); p.remove(); return out; };
  const PAL = ['--c1', '--c2', '--c3', '--c4', '--c5', '--ok'];
  const fit = (cv, w, h) => { const k = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k)); cv.style.width = w + 'px'; cv.style.height = h + 'px'; return k; };

  /* ---- visibility (IntersectionObserver) and the heavy-effect manager: one running at a time, none while hidden or off screen */
  const cbs = new WeakMap();
  const vio = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => es.forEach((e) => { const c = cbs.get(e.target); if (c) { c.ratio = e.isIntersecting ? e.intersectionRatio : 0; c.fn(); } }), { threshold: [0, .1, .25, .5, .75, 1] }) : null;
  const watch = (el, fn) => { const c = { ratio: vio ? 0 : 1, fn }; cbs.set(el, c); if (vio) vio.observe(el); else fn(); return c; };
  const unwatch = (el) => { if (vio) vio.unobserve(el); cbs.delete(el); };
  const heavy = new Set();
  const choose = () => {
    let best = null;
    heavy.forEach((r) => { if (r.c.ratio > 0 && !d.hidden && (!best || r.c.ratio > best.c.ratio)) best = r; });
    heavy.forEach((r) => { if (r === best) { if (!r.running) { r.running = true; r.fx.run(r); } } else if (r.running) { r.running = false; r.fx.idle(r); } });
  };
  d.addEventListener('visibilitychange', choose);
  const addHeavy = (r, fx) => { r.fx = fx; r.running = false; heavy.add(r); r.c = watch(r.el, choose); };
  const dropHeavy = (r) => { if (r.running) { r.running = false; r.fx.idle(r); } heavy.delete(r); unwatch(r.el); };
  M.heavy = () => [...heavy].filter((r) => r.running).length;

  /* ---- 2 tilt: data-k-tilt[=max degrees], children with data-k-z="30" float above the card */
  M.define('tilt', {
    attr: 'data-k-tilt', now: true,
    prep: (r) => {
      const el = r.el, max = num(el.dataset.kTilt, 10);
      el.classList.add('k-fx-tilt');
      const gl = el.querySelector(':scope>.k-fx-glare') || el.appendChild(mk('span', 'k-fx-glare')); gl.setAttribute('aria-hidden', 'true');
      $$('[data-k-z]', el).forEach((c) => c.style.setProperty('--z', num(c.dataset.kZ, 20) + 'px'));
      let f = 0, px = .5, py = .5;
      const paint = () => { f = 0; el.style.setProperty('--k-rx', ((.5 - py) * 2 * max).toFixed(2) + 'deg'); el.style.setProperty('--k-ry', ((px - .5) * 2 * max).toFixed(2) + 'deg'); el.style.setProperty('--k-gx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--k-gy', (py * 100).toFixed(1) + '%'); };
      const move = (e) => { const b = el.getBoundingClientRect(); px = clamp((e.clientX - b.left) / b.width, 0, 1); py = clamp((e.clientY - b.top) / b.height, 0, 1); el.classList.add('is-tilting'); if (!f) f = raf(paint); };
      const out = () => { el.classList.remove('is-tilting'); cancelAnimationFrame(f); f = 0; ['--k-rx', '--k-ry'].forEach((k) => el.style.removeProperty(k)); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerleave', out);
      r.off = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', out); out(); };
    },
    done: (r) => { if (r.off) r.off(); r.off = null; r.el.classList.remove('k-fx-tilt', 'is-tilting'); }
  });

  /* ---- 3 aurora: data-k-aurora on a container; blobs drift (CSS transforms only), paused off screen, one at a time */
  const AUR = { run: (r) => r.el.classList.add('is-live'), idle: (r) => r.el.classList.remove('is-live') };
  M.define('aurora', {
    attr: 'data-k-aurora', now: true,
    build: (r) => { const el = r.el, bg = mk('div', 'k-fx-aurora-bg'); bg.setAttribute('aria-hidden', 'true'); for (let i = 1; i <= 5; i++) { const b = mk('i'); b.style.setProperty('--n', i); bg.append(b); } el.classList.add('k-fx-aurora'); el.prepend(bg); },
    prep: (r) => addHeavy(r, AUR),
    done: (r) => { if (r.fx) dropHeavy(r); r.el.classList.remove('is-live'); }
  });

  /* ---- 4 scramble: data-k-scramble[=hover]; random glyphs settle into the text from left to right */
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+<>/=';
  const scr = (r) => {
    cancelAnimationFrame(r.f);
    const t = r.txt, n = t.length, step = Math.min(70, 1100 / Math.max(n, 1)), set = [...t].map((c, i) => i * step + rnd(160, 460)), vis = r.vis;
    vis.textContent = t; vis.style.minWidth = vis.offsetWidth + 'px';
    const t0 = performance.now() + num(r.el.dataset.kDelay, 0); let last = 0;
    r.el.classList.remove('k-m-pend');
    const tick = (now) => {
      const e = now - t0; if (now - last < 42 && e < set[n - 1]) { r.f = raf(tick); return; } last = now;
      let out = '', left = false;
      for (let i = 0; i < n; i++) { const c = t[i]; if (c === ' ' || e >= set[i]) out += c; else { left = true; out += GL[(Math.random() * GL.length) | 0]; } }
      vis.textContent = out;
      if (left) r.f = raf(tick); else { vis.textContent = t; vis.style.minWidth = ''; r.f = 0; }
    };
    r.f = raf(tick);
  };
  M.define('scramble', {
    attr: 'data-k-scramble',
    build: (r) => {
      const el = r.el, txt = el.textContent.replace(/\s+/g, ' ').trim(); r.txt = txt;
      const sr = mk('span', 'k-sr', txt), vis = mk('span', 'k-fx-scr', txt); vis.setAttribute('aria-hidden', 'true');
      el.textContent = ''; el.append(sr, vis); r.vis = vis;
      if (el.dataset.kScramble === 'hover') { const again = () => { if (allowed() && !r.f) scr(r); }; el.addEventListener('pointerenter', again); el.addEventListener('focus', again); }
    },
    prep: (r) => r.el.classList.add('k-m-pend'),
    play: (r) => scr(r),
    done: (r) => { cancelAnimationFrame(r.f); r.f = 0; r.vis.textContent = r.txt; r.vis.style.minWidth = ''; r.el.classList.remove('k-m-pend'); }
  });

  /* ---- 5 drag with physics: data-k-drag[=free|snap|home] [data-k-drag-grid=64] [data-k-drag-of=selector]; inertia, bounce off the container, snap or spring home */
  M.define('drag', {
    attr: 'data-k-drag', now: true,
    build: (r) => {
      const host = r.el, mode = host.dataset.kDrag || 'free', grid = num(host.dataset.kDragGrid, 64), S = new WeakMap(); let z = 5, last = 0, active = new Set();
      host.classList.add('k-fx-drag');
      const items = () => (host.dataset.kDragOf ? $$(host.dataset.kDragOf, host) : [...host.children]);
      items().forEach((it) => { if (!it.hasAttribute('tabindex')) it.tabIndex = 0; });
      const st = (it) => S.get(it) || (S.set(it, { x: 0, y: 0, vx: 0, vy: 0, mode: 'rest' }), S.get(it));
      const apply = (it) => { const s = st(it), rot = clamp(s.vx * .012, -9, 9); it.style.transform = s.x || s.y || s.g ? 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + (s.g ? 1.05 : 1) + ')' : ''; };
      const lim = (it) => { const h = host.getBoundingClientRect(), b = it.getBoundingClientRect(), s = st(it), bl = b.left - s.x, bt = b.top - s.y; return { x0: h.left - bl, x1: h.right - (bl + b.width), y0: h.top - bt, y1: h.bottom - (bt + b.height) }; };
      const target = (it, L) => { const s = st(it); if (mode === 'home') return [0, 0]; if (mode === 'snap') return [clamp(Math.round(s.x / grid) * grid, L.x0, L.x1), clamp(Math.round(s.y / grid) * grid, L.y0, L.y1)]; return null; };
      const loop = (now) => {
        const dt = Math.min(.034, (now - last) / 1000); last = now;
        active.forEach((it) => {
          const s = st(it), L = lim(it);
          if (s.mode === 'spring') {
            s.vx += ((s.tx - s.x) * 190 - s.vx * 19) * dt; s.vy += ((s.ty - s.y) * 190 - s.vy * 19) * dt; s.x += s.vx * dt; s.y += s.vy * dt;
            if (Math.abs(s.tx - s.x) < .4 && Math.abs(s.ty - s.y) < .4 && Math.abs(s.vx) + Math.abs(s.vy) < 12) { s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0; s.mode = 'rest'; active.delete(it); }
          } else {
            const f = Math.exp(-dt * 3.2); s.vx *= f; s.vy *= f; s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.x < L.x0) { s.x = L.x0; s.vx = Math.abs(s.vx) * .62; } else if (s.x > L.x1) { s.x = L.x1; s.vx = -Math.abs(s.vx) * .62; }
            if (s.y < L.y0) { s.y = L.y0; s.vy = Math.abs(s.vy) * .62; } else if (s.y > L.y1) { s.y = L.y1; s.vy = -Math.abs(s.vy) * .62; }
            if (Math.hypot(s.vx, s.vy) < 14) { const t = target(it, L); if (t) { s.mode = 'spring'; s.tx = t[0]; s.ty = t[1]; } else { s.vx = s.vy = 0; s.mode = 'rest'; active.delete(it); } }
          }
          apply(it); if (s.mode === 'rest' && !s.x && !s.y) it.style.transform = '';
        });
        r.f = active.size ? raf(loop) : 0;
      };
      const go = (it) => { active.add(it); if (!r.f) { last = performance.now(); r.f = raf(loop); } };
      host.addEventListener('pointerdown', (e) => {
        if (e.button || e.target.closest('input,textarea,select,[contenteditable]')) return;
        const it = items().find((x) => x.contains(e.target)); if (!it) return;
        const s = st(it); s.mode = 'drag'; s.g = true; active.delete(it); s.vx = s.vy = 0;
        s.d = { px: e.clientX, py: e.clientY, x0: s.x, y0: s.y, smp: [{ t: performance.now(), x: s.x, y: s.y }], L: lim(it) };
        it.setPointerCapture(e.pointerId); it.classList.add('is-grabbed'); it.style.zIndex = ++z; apply(it);
      });
      host.addEventListener('pointermove', (e) => {
        const it = items().find((x) => st(x).mode === 'drag'); if (!it) return;
        const s = st(it), g = s.d, now = performance.now();
        s.x = clamp(g.x0 + e.clientX - g.px, g.L.x0, g.L.x1); s.y = clamp(g.y0 + e.clientY - g.py, g.L.y0, g.L.y1);
        g.smp.push({ t: now, x: s.x, y: s.y }); while (g.smp.length > 2 && now - g.smp[0].t > 90) g.smp.shift();
        apply(it);
      });
      const up = (e) => {
        const it = items().find((x) => st(x).mode === 'drag'); if (!it) return;
        const s = st(it), g = s.d, a = g.smp[0], b = g.smp[g.smp.length - 1], dt = Math.max(16, b.t - a.t);
        s.g = false; it.classList.remove('is-grabbed'); s.mode = 'rest'; s.d = null;
        if (allowed()) { s.vx = (b.x - a.x) / dt * 1000; s.vy = (b.y - a.y) / dt * 1000; if (performance.now() - b.t > 80) s.vx = s.vy = 0; s.mode = 'inertia'; go(it); }
        else { const t = target(it, lim(it)); if (t) { s.x = t[0]; s.y = t[1]; } apply(it); if (!s.x && !s.y) it.style.transform = ''; }
      };
      host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
      host.addEventListener('keydown', (e) => {
        const it = items().find((x) => x === e.target); if (!it) return;
        const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key], s = st(it);
        if (k) { e.preventDefault(); const L = lim(it), n = e.shiftKey ? 48 : 16; s.x = clamp(s.x + k[0] * n, L.x0, L.x1); s.y = clamp(s.y + k[1] * n, L.y0, L.y1); s.mode = 'rest'; apply(it); }
        else if (e.key === 'Home') { s.mode = 'spring'; s.tx = s.ty = 0; if (allowed()) go(it); else { s.x = s.y = 0; apply(it); } }
      });
    }
  });

  /* ---- 6 particles: data-k-particles="word" (host needs a height; the dots gather into the word and flee the pointer) */
  const PAR = {
    run: (r) => { if (!r.gathered) { r.pts.forEach((p) => { p.x = rnd(0, r.w); p.y = rnd(0, r.h); p.vx = p.vy = 0; }); r.gathered = true; } r.f = r.f || raf(r.step); },
    idle: (r) => { cancelAnimationFrame(r.f); r.f = 0; r.pts.forEach((p) => { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }); draw(r); }
  };
  const draw = (r) => {
    const c = r.ctx, k = r.k; c.clearRect(0, 0, r.cv.width, r.cv.height); c.fillStyle = getComputedStyle(r.el).color; c.beginPath();
    r.pts.forEach((p) => { c.moveTo((p.x + p.s) * k, p.y * k); c.arc(p.x * k, p.y * k, p.s * k, 0, 6.2832); }); c.fill();
  };
  const layout = (r) => {
    const el = r.el, w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    r.w = w; r.h = h; r.k = fit(r.cv, w, h);
    const o = mk('canvas'); o.width = w; o.height = h; const c = o.getContext('2d', { willReadFrequently: true });
    c.font = '800 100px system-ui,sans-serif'; const fs = Math.min(h * .6, 100 * (w * .84) / Math.max(1, c.measureText(r.word).width)); c.font = '800 ' + fs + 'px system-ui,sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(r.word, w / 2, h / 2 + fs * .04);
    const data = c.getImageData(0, 0, w, h).data; let gap = 3, tg = [];
    for (let pass = 0; pass < 6; pass++) { tg = []; for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) if (data[(y * w + x) * 4 + 3] > 140) tg.push([x, y]); if (tg.length <= 720) break; gap = Math.ceil(gap * Math.sqrt(tg.length / 720)) + 1; }
    const old = r.pts || [];
    r.pts = tg.map((t, i) => ({ tx: t[0], ty: t[1], x: old[i] ? old[i].x : rnd(0, w), y: old[i] ? old[i].y : rnd(0, h), vx: 0, vy: 0, s: gap > 4 ? 1.9 : 1.5 }));
    if (!r.running) { r.pts.forEach((p) => { p.x = p.tx; p.y = p.ty; }); }
    draw(r);
  };
  M.define('particles', {
    attr: 'data-k-particles', now: true,
    build: (r) => {
      const el = r.el; r.word = el.dataset.kParticles || 'Kit'; el.classList.add('k-fx-particles'); el.setAttribute('role', 'img'); if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', r.word);
      r.cv = mk('canvas'); r.cv.setAttribute('aria-hidden', 'true'); r.ctx = r.cv.getContext('2d'); el.append(r.cv); r.mouse = { x: -1e4, y: -1e4, t: 0 }; let last = 0;
      r.step = (now) => {
        const dt = Math.min(.034, (now - (last || now)) / 1000); last = now; let moving = 0; const m = r.mouse, R = 78;
        r.pts.forEach((p) => {
          let ax = (p.tx - p.x) * 42 - p.vx * 7.5, ay = (p.ty - p.y) * 42 - p.vy * 7.5;
          const dx = p.x - m.x, dy = p.y - m.y, d2 = dx * dx + dy * dy;
          if (d2 < R * R && now - m.t < 1500) { const dist = Math.sqrt(d2) || 1, f = (1 - dist / R) * 5200; ax += dx / dist * f; ay += dy / dist * f; }
          p.vx += ax * dt; p.vy += ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; moving += Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.tx - p.x);
        });
        draw(r);
        if (moving / Math.max(1, r.pts.length) > .35 || now - m.t < 1500) r.f = raf(r.step); else { r.f = 0; last = 0; }
      };
      const move = (e) => { const b = el.getBoundingClientRect(); r.mouse.x = e.clientX - b.left; r.mouse.y = e.clientY - b.top; r.mouse.t = performance.now(); if (r.running && !r.f) r.f = raf(r.step); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerleave', () => { r.mouse.x = r.mouse.y = -1e4; });
      layout(r); if (typeof ResizeObserver === 'function') new ResizeObserver(() => layout(r)).observe(el);
    },
    prep: (r) => { r.gathered = false; addHeavy(r, PAR); },
    done: (r) => { if (r.fx) dropHeavy(r); cancelAnimationFrame(r.f); r.f = 0; r.fx = null; if (r.pts) { r.pts.forEach((p) => { p.x = p.tx; p.y = p.ty; }); draw(r); } }
  });

  /* ---- 7 scroll story: data-k-story; [data-k-depth="-1..1"] layers drift (parallax), svg path [data-k-draw] draws itself while the section scrolls through the screen */
  M.define('story', {
    attr: 'data-k-story', now: true,
    build: (r) => { r.layers = $$('[data-k-depth]', r.el); r.paths = $$('[data-k-draw]', r.el); r.paths.forEach((p) => { p.setAttribute('pathLength', 1); p.style.strokeDasharray = 1; p.style.strokeDashoffset = 0; }); },
    prep: (r) => {
      let f = 0, on = false;
      const upd = () => {
        f = 0; const b = r.el.getBoundingClientRect(), vh = innerHeight, p = clamp((vh - b.top) / (vh + b.height), 0, 1), q = clamp((p - .12) / .62, 0, 1);
        r.layers.forEach((l) => { l.style.transform = 'translate3d(0,' + ((p - .5) * -num(l.dataset.kDepth, .3) * 180).toFixed(1) + 'px,0)'; });
        r.paths.forEach((l) => { l.style.strokeDashoffset = (1 - q).toFixed(4); });
      };
      const sch = () => { if (!f) f = raf(upd); };
      r.c = watch(r.el, () => { const vis = r.c.ratio > 0; if (vis && !on) { on = true; addEventListener('scroll', sch, { passive: true }); addEventListener('resize', sch); upd(); } else if (!vis && on) { on = false; removeEventListener('scroll', sch); removeEventListener('resize', sch); } });
      r.off = () => { removeEventListener('scroll', sch); removeEventListener('resize', sch); cancelAnimationFrame(f); unwatch(r.el); };
    },
    done: (r) => { if (r.off) r.off(); r.off = null; (r.layers || []).forEach((l) => { l.style.transform = ''; }); (r.paths || []).forEach((l) => { l.style.strokeDashoffset = 0; }); }
  });

  /* ---- 8 magnetic: data-k-magnetic[=strength .35] [data-k-radius=70]; pulled toward the pointer when it is near, springs back */
  const mags = new Set(); let mf = 0, mx = -1e4, my = -1e4, mon = false;
  const mpaint = () => {
    mf = 0;
    mags.forEach((r) => {
      const el = r.el, b = el.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(el).transform), cx = b.left + b.width / 2 - m.m41, cy = b.top + b.height / 2 - m.m42, dx = mx - cx, dy = my - cy, R = Math.max(b.width, b.height) / 2 + num(el.dataset.kRadius, 70), s = num(el.dataset.kMagnetic, .35);
      if (Math.hypot(dx, dy) < R) { r.px = dx * s; r.py = dy * s; el.style.setProperty('--k-mx', r.px.toFixed(1) + 'px'); el.style.setProperty('--k-my', r.py.toFixed(1) + 'px'); el.classList.add('is-pulled'); }
      else if (el.classList.contains('is-pulled')) { r.px = r.py = 0; el.classList.remove('is-pulled'); el.style.removeProperty('--k-mx'); el.style.removeProperty('--k-my'); }
    });
  };
  const mmove = (e) => { mx = e.clientX; my = e.clientY; if (!mf) mf = raf(mpaint); };
  const mleave = () => { mx = my = -1e4; if (!mf) mf = raf(mpaint); };
  M.define('magnetic', {
    attr: 'data-k-magnetic', now: true,
    prep: (r) => { r.el.classList.add('k-fx-mag'); mags.add(r); if (!mon) { mon = true; d.addEventListener('pointermove', mmove, { passive: true }); root.addEventListener('pointerleave', mleave); } },
    done: (r) => { mags.delete(r); r.px = r.py = 0; r.el.classList.remove('k-fx-mag', 'is-pulled'); r.el.style.removeProperty('--k-mx'); r.el.style.removeProperty('--k-my'); if (!mags.size && mon) { mon = false; d.removeEventListener('pointermove', mmove); root.removeEventListener('pointerleave', mleave); } }
  });

  /* ---- 9 shatter: data-k-shatter="<selector of what breaks>" on a button (default: the closest [data-k-shatter-item]); kitMotion.shatter(el, {remove, restore, x, y}) */
  const shatter = (el, o) => {
    o = o || {};
    const b = el && el.getBoundingClientRect();
    if (!allowed() || !b || !b.width) { if (o.remove && el) el.remove(); return Promise.resolve(false); }
    const cols = o.cols || 4, rows = o.rows || 3, cw = b.width / cols, ch = b.height / rows, ox = o.x != null ? o.x : b.left + b.width / 2, oy = o.y != null ? o.y : b.top + b.height / 2;
    const box = mk('div', 'k-fx-shatter'); box.setAttribute('aria-hidden', 'true'); const cs = getComputedStyle(el), anims = [], V = [];
    for (let j = 0; j <= rows; j++) { V[j] = []; for (let i = 0; i <= cols; i++) V[j][i] = [i * cw + (i && i < cols ? rnd(-.28, .28) * cw : 0), j * ch + (j && j < rows ? rnd(-.28, .28) * ch : 0)]; }
    const tris = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = V[j][i], bb = V[j][i + 1], c = V[j + 1][i + 1], dd = V[j + 1][i]; if ((i + j) % 2) { tris.push([a, bb, c]); tris.push([a, c, dd]); } else { tris.push([a, bb, dd]); tris.push([bb, c, dd]); } }
    tris.forEach((t) => {
      const cl = el.cloneNode(true); cl.removeAttribute('id'); cl.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); cl.setAttribute('inert', '');
      const gx = (t[0][0] + t[1][0] + t[2][0]) / 3, gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      cl.style.cssText = 'position:absolute;margin:0;box-sizing:border-box;left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px;color:' + cs.color + ';font:' + cs.font + ';clip-path:polygon(' + t.map((p) => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ');transform-origin:' + gx.toFixed(1) + 'px ' + gy.toFixed(1) + 'px;pointer-events:none';
      const dx = (b.left + gx - ox) * rnd(.5, 1.3), dy = (b.top + gy - oy) * rnd(.3, 1), rot = rnd(-160, 160), dist = Math.hypot(b.left + gx - ox, b.top + gy - oy);
      anims.push(cl.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx * .45 + 'px,' + (dy * .45 - rnd(18, 60)) + 'px) rotate(' + rot * .35 + 'deg)', opacity: 1, offset: .28 }, { transform: 'translate(' + dx + 'px,' + (dy + rnd(260, 520)) + 'px) rotate(' + rot + 'deg)', opacity: 0 }], { duration: rnd(900, 1350), delay: dist * .5, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' }).finished);
      box.append(cl);
    });
    el.style.visibility = 'hidden'; d.body.append(box);
    return Promise.allSettled(anims).then(() => { box.remove(); if (o.remove) el.remove(); else if (o.restore != null) el.style.visibility = ''; dispatchEvent(new CustomEvent('kit:shatter', { detail: { el } })); return true; });
  };
  M.shatter = shatter;
  d.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-k-shatter]'); if (!b) return;
    const sel = b.dataset.kShatter, t = sel ? $(sel) : b.closest('[data-k-shatter-item]'); if (!t) return;
    const rs = b.dataset.kShatterRestore;
    shatter(t, rs != null ? { restore: num(rs, 0), x: e.clientX, y: e.clientY } : { remove: true, x: e.clientX, y: e.clientY });
  });

  /* ---- 10 cursor trail: data-k-trail on a container, data-k-trail="page" for the whole page, kitMotion.trail(true|false) for party mode */
  const trail = (host, page) => {
    const cv = mk('canvas', 'k-fx-trail' + (page ? ' is-page' : '')); cv.setAttribute('aria-hidden', 'true'); (page ? d.body : host).append(cv);
    const c = cv.getContext('2d'), pts = [], cols = colors(PAL); let k = 1, f = 0, w = 0, h = 0, n = 0;
    const size = () => { const b = page ? { width: innerWidth, height: innerHeight } : host.getBoundingClientRect(); w = b.width; h = b.height; k = fit(cv, w, h); };
    const frame = (now) => {
      c.clearRect(0, 0, cv.width, cv.height);
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], a = 1 - (now - p.t) / 700; if (a <= 0) { pts.splice(i, 1); continue; } c.globalAlpha = a * .85; c.fillStyle = p.c; c.beginPath(); c.arc(p.x * k, p.y * k, (3 + 9 * a) * k, 0, 6.2832); c.fill(); }
      f = pts.length ? raf(frame) : 0; if (!f) c.clearRect(0, 0, cv.width, cv.height);
    };
    const move = (e) => { if (!allowed()) return; const b = page ? { left: 0, top: 0 } : host.getBoundingClientRect(); pts.push({ x: e.clientX - b.left, y: e.clientY - b.top, t: performance.now(), c: cols[(n++ >> 1) % cols.length] }); if (pts.length > 80) pts.shift(); if (!f) f = raf(frame); };
    size(); const tgt = page ? d : host; tgt.addEventListener('pointermove', move); addEventListener('resize', size);
    return () => { tgt.removeEventListener('pointermove', move); removeEventListener('resize', size); cancelAnimationFrame(f); cv.remove(); };
  };
  M.define('trail', {
    attr: 'data-k-trail', now: true,
    prep: (r) => { r.el.classList.add('k-fx-trail-host'); r.off = trail(r.el, r.el.dataset.kTrail === 'page'); },
    done: (r) => { if (r.off) r.off(); r.off = null; }
  });
  let party = null;
  M.trail = (on) => { if (on === undefined) on = !party; if (on && !party && allowed()) party = trail(null, true); else if (!on && party) { party(); party = null; } return !!party; };

  /* ---- 11 3D carousel: data-k-carousel[=auto]; children are the cards; buttons, arrow keys and drag turn the ring */
  M.define('carousel', {
    attr: 'data-k-carousel', now: true,
    build: (r) => {
      const el = r.el, items = [...el.children], n = items.length, stage = mk('div', 'k-fx-stage'), ring = mk('div', 'k-fx-ring'), nav = mk('div', 'k-fx-cnav'), live = mk('span', 'k-sr');
      live.setAttribute('role', 'status'); items.forEach((it) => { it.classList.add('k-fx-c-item'); ring.append(it); }); stage.append(ring);
      const btn = (t, l) => { const b = mk('button', 'k-btn k-btn-sm', t); b.type = 'button'; b.setAttribute('aria-label', l); return b; };
      const prev = btn('\u2039', 'Previous'), next = btn('\u203a', 'Next'); nav.append(prev, next, live);
      el.classList.add('k-fx-carousel'); el.setAttribute('role', 'group'); el.setAttribute('aria-roledescription', 'carousel'); if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Carousel'); el.tabIndex = 0; el.append(stage, nav);
      let a = 0; const step = n ? 360 / n : 360;
      const geometry = () => { const w = items[0] ? items[0].offsetWidth : 200, h = items[0] ? items[0].offsetHeight : 160, R = n > 2 ? (w / 2 / Math.tan(Math.PI / n)) * 1.28 + 22 : 0; stage.style.height = h + 48 + 'px'; ring.style.setProperty('--k-R', R.toFixed(0) + 'px'); items.forEach((it, i) => { it.style.transform = 'rotateY(' + i * step + 'deg) translateZ(' + R.toFixed(0) + 'px)'; }); };
      const show = () => {
        const R = parseFloat(ring.style.getPropertyValue('--k-R')) || 0; ring.style.transform = 'translateZ(' + -R + 'px) rotateY(' + -a + 'deg)';
        const cur = ((Math.round(a / step) % n) + n) % n;
        items.forEach((it, i) => { let dl = ((i * step - a) % 360 + 540) % 360 - 180; it.style.setProperty('--o', (.32 + .68 * Math.max(0, Math.cos(dl * Math.PI / 180))).toFixed(2)); it.toggleAttribute('inert', i !== cur); it.setAttribute('aria-hidden', i !== cur); if (i === cur) it.setAttribute('aria-current', 'true'); else it.removeAttribute('aria-current'); });
        live.textContent = 'Item ' + (cur + 1) + ' of ' + n;
      };
      const go = (dir) => { a = Math.round(a / step) * step + dir * step; ring.classList.remove('is-drag'); show(); };
      r.go = go; prev.addEventListener('click', () => { r.user = true; go(-1); }); next.addEventListener('click', () => { r.user = true; go(1); });
      el.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); r.user = true; go(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); r.user = true; go(1); } });
      let g = null;
      stage.addEventListener('pointerdown', (e) => { if (e.button) return; g = { x: e.clientX, a }; ring.classList.add('is-drag'); stage.setPointerCapture(e.pointerId); r.user = true; });
      stage.addEventListener('pointermove', (e) => { if (!g) return; a = g.a - (e.clientX - g.x) * .45; show(); });
      const end = () => { if (!g) return; g = null; a = Math.round(a / step) * step; ring.classList.remove('is-drag'); show(); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
      geometry(); show(); if (typeof ResizeObserver === 'function') new ResizeObserver(geometry).observe(el);
    },
    prep: (r) => {
      if (r.el.dataset.kCarousel !== 'auto') return;
      let t = 0, hover = false; const on = () => { if (!t && !hover && !r.user && r.c.ratio > 0 && !d.hidden) t = setInterval(() => r.go(1), 3200); }, off = () => { clearInterval(t); t = 0; };
      const enter = () => { hover = true; off(); }, leave = () => { hover = false; on(); };
      r.el.addEventListener('pointerenter', enter); r.el.addEventListener('pointerleave', leave); r.el.addEventListener('focusin', enter); r.el.addEventListener('focusout', leave);
      r.c = watch(r.el, () => { if (r.c.ratio > 0) on(); else off(); }); r.off = () => { off(); unwatch(r.el); r.el.removeEventListener('pointerenter', enter); r.el.removeEventListener('pointerleave', leave); r.el.removeEventListener('focusin', enter); r.el.removeEventListener('focusout', leave); };
    },
    done: (r) => { if (r.off) r.off(); r.off = null; }
  });

  /* ---- 12 flip / fold between steps: data-k-flip[=fold]; steps are [data-k-step], buttons [data-k-flip-next] [data-k-flip-prev]; kitMotion.flip(host, index) */
  const flip = (host, to) => {
    const r = host._km; if (!r) return Promise.resolve();
    const steps = r.steps(), cur = steps.findIndex((s) => !s.hidden); to = clamp(to, 0, steps.length - 1);
    if (to === cur || r.busy) return Promise.resolve();
    const a = steps[cur], b = steps[to], dir = to > cur ? 1 : -1, fold = host.dataset.kFlip === 'fold';
    const swap = () => {
      a.hidden = true; b.hidden = false;
      $$('[data-k-flip-count]', host).forEach((c) => { c.textContent = to + 1 + ' / ' + steps.length; });
      $$('[data-k-flip-prev]', host).forEach((x) => { x.disabled = to === 0; }); $$('[data-k-flip-next]', host).forEach((x) => { x.disabled = to === steps.length - 1; });
      const h = $('h2,h3,[tabindex]', b); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      dispatchEvent(new CustomEvent('kit:flip', { detail: { host, index: to } }));
    };
    if (!allowed()) { swap(); return Promise.resolve(); }
    r.busy = true; host.style.height = host.offsetHeight + 'px';
    const out = fold ? [{ transform: 'rotateX(0)', transformOrigin: '50% 0' }, { transform: 'rotateX(' + -88 * dir + 'deg)', transformOrigin: '50% 0', opacity: .4 }] : [{ transform: 'rotateY(0)' }, { transform: 'rotateY(' + -90 * dir + 'deg)' }];
    const inn = fold ? [{ transform: 'rotateX(' + 88 * dir + 'deg)', transformOrigin: '50% 0', opacity: .4 }, { transform: 'rotateX(0)', transformOrigin: '50% 0' }] : [{ transform: 'rotateY(' + 90 * dir + 'deg)' }, { transform: 'rotateY(0)' }];
    const A = a.animate(out, { duration: 240, easing: 'ease-in', fill: 'forwards' });
    return A.finished.then(() => { swap(); A.cancel(); host.style.height = ''; return b.animate(inn, { duration: 360, easing: EASE }).finished; }).finally(() => { r.busy = false; host.style.height = ''; });
  };
  M.flip = (host, to) => flip(pick(host), to);
  M.define('flip', {
    attr: 'data-k-flip', now: true,
    build: (r) => {
      const host = r.el; r.steps = () => $$('[data-k-step]', host); host.classList.add('k-fx-flip'); const s = r.steps(); s.forEach((x, i) => { x.hidden = i !== 0; x.classList.add('k-fx-step'); });
      $$('[data-k-flip-count]', host).forEach((c) => { c.textContent = '1 / ' + s.length; }); $$('[data-k-flip-prev]', host).forEach((x) => { x.disabled = true; });
      host.addEventListener('click', (e) => { const b = e.target.closest('[data-k-flip-next],[data-k-flip-prev]'); if (!b || !host.contains(b)) return; const i = r.steps().findIndex((q) => !q.hidden); flip(host, i + (b.hasAttribute('data-k-flip-next') ? 1 : -1)); });
    }
  });

  /* ---- 13 spotlight: data-k-spotlight (pointer follows, the rest dims) or data-k-spotlight="tour" with [data-k-tour][data-k-tour-text] steps and a [data-k-spotlight-start] button */
  M.define('spotlight', {
    attr: 'data-k-spotlight', now: true,
    build: (r) => {
      const el = r.el, tour = el.dataset.kSpotlight === 'tour'; r.tour = tour; el.classList.add('k-fx-spot-host');
      const ov = mk('div', 'k-fx-spot' + (tour ? ' is-tour' : '')); ov.setAttribute('aria-hidden', 'true'); r.ov = ov;
      if (!tour) { el.append(ov); return; }
      const hole = mk('div', 'k-fx-hole'), cap = mk('div', 'k-fx-cap'); cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-label', 'Guided tour'); cap.hidden = true;
      const txt = mk('p'), nav = mk('div', 'k-row'), bk = mk('button', 'k-btn k-btn-sm', 'Back'), nx = mk('button', 'k-btn k-btn-sm k-btn-primary', 'Next'), cl = mk('button', 'k-btn k-btn-sm k-btn-ghost', 'Close'), cnt = mk('span', 'k-muted');
      [bk, nx, cl].forEach((b) => { b.type = 'button'; }); nav.append(bk, nx, cl, cnt); cap.append(txt, nav); ov.append(hole); el.append(ov, cap);
      let i = 0; const stepsOf = () => $$('[data-k-tour]', el).sort((a, b) => num(a.dataset.kTour, 0) - num(b.dataset.kTour, 0));
      const place = () => {
        const s = stepsOf(), t = s[i]; if (!t) return; const h = el.getBoundingClientRect(), b = t.getBoundingClientRect(), pad = 8;
        hole.style.cssText = 'left:' + (b.left - h.left - pad) + 'px;top:' + (b.top - h.top - pad) + 'px;width:' + (b.width + pad * 2) + 'px;height:' + (b.height + pad * 2) + 'px';
        txt.textContent = t.dataset.kTourText || ''; cnt.textContent = i + 1 + ' / ' + s.length; bk.disabled = i === 0; nx.textContent = i === s.length - 1 ? 'Done' : 'Next';
        const ch = cap.offsetHeight || 120, room = h.height - (b.bottom - h.top) - pad - 8; cap.style.left = clamp(b.left - h.left, 8, Math.max(8, h.width - 280)) + 'px'; cap.style.top = (room >= ch ? b.bottom - h.top + pad + 8 : b.top - h.top - pad - 8 - ch >= 0 ? b.top - h.top - pad - 8 - ch : Math.max(8, h.height - ch - 8)) + 'px';
      };
      const open = () => { i = 0; ov.classList.add('is-on'); cap.hidden = false; place(); nx.focus({ preventScroll: true }); };
      const close = () => { ov.classList.remove('is-on'); cap.hidden = true; };
      nx.addEventListener('click', () => { if (i >= stepsOf().length - 1) close(); else { i++; place(); } }); bk.addEventListener('click', () => { if (i) { i--; place(); } }); cl.addEventListener('click', close);
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cap.hidden) { e.stopPropagation(); close(); } });
      el.addEventListener('click', (e) => { if (e.target.closest('[data-k-spotlight-start]')) open(); });
      r.open = open;
    },
    prep: (r) => {
      if (r.tour) return; const el = r.el, ov = r.ov; let f = 0, x = 0, y = 0;
      const paint = () => { f = 0; ov.style.setProperty('--k-sx', x + 'px'); ov.style.setProperty('--k-sy', y + 'px'); };
      const mv = (e) => { const b = el.getBoundingClientRect(); x = e.clientX - b.left; y = e.clientY - b.top; ov.classList.add('is-on'); if (!f) f = raf(paint); };
      const lv = () => ov.classList.remove('is-on');
      el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv); r.off = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerleave', lv); cancelAnimationFrame(f); lv(); };
    },
    done: (r) => { if (r.off) r.off(); r.off = null; }
  });
  M.spotlight = (host) => { const el = pick(host); if (el && el._km && el._km.open) el._km.open(); };

  /* ---- 14 fireworks: kitMotion.fireworks({from, shots}) or data-k-fireworks[=shots] on a button */
  let fw = null;
  M.fireworks = (o) => {
    o = o || {}; if (!allowed()) return 0; if (fw) fw();
    const cv = mk('canvas', 'k-fx-fw'); cv.setAttribute('aria-hidden', 'true'); d.body.append(cv);
    const c = cv.getContext('2d'), k = fit(cv, innerWidth, innerHeight), W = innerWidth * k, H = innerHeight * k, cols = colors(PAL), shots = clamp(o.shots || 4, 1, 8);
    const rockets = [], sparks = []; let f = 0, last = performance.now(), launched = 0, timers = [];
    const burst = (x, y, col) => {
      const n = Math.min(80, 450 - sparks.length), ring = Math.random() < .35, hue2 = cols[(Math.random() * cols.length) | 0];
      for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + rnd(-.05, .05), v = (ring ? 3.4 : rnd(1.2, 4.6)) * k; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, dec: rnd(.011, .021), c: i % 5 ? col : hue2 }); }
    };
    const launch = () => {
      launched++; const x0 = o.from && launched === 1 ? o.from.x * k : rnd(.18, .82) * W, ty = rnd(.16, .42) * H, x1 = x0 + rnd(-.08, .08) * W;
      rockets.push({ x: x0, y: H, tx: x1, ty, vx: (x1 - x0) / 55, vy: (ty - H) / 55, c: cols[(Math.random() * cols.length) | 0], trail: [] });
    };
    for (let i = 0; i < shots; i++) timers.push(setTimeout(launch, i * 430 + rnd(0, 120)));
    const stop = () => { timers.forEach(clearTimeout); cancelAnimationFrame(f); cv.remove(); if (fw === stop) fw = null; };
    const frame = (now) => {
      const dt = Math.min(2.2, (now - last) / 16.7); last = now;
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
      for (let i = rockets.length - 1; i >= 0; i--) { const q = rockets[i]; q.trail.push([q.x, q.y]); if (q.trail.length > 7) q.trail.shift(); q.x += q.vx * dt; q.y += q.vy * dt; c.strokeStyle = q.c; c.lineWidth = 2.4 * k; c.beginPath(); q.trail.forEach((p, j) => (j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); if (q.y <= q.ty) { burst(q.x, q.y, q.c); rockets.splice(i, 1); } }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i], px = s.x, py = s.y; s.vx *= .985; s.vy = s.vy * .985 + .045 * k * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= s.dec * dt; if (s.life <= 0) { sparks.splice(i, 1); continue; } c.globalAlpha = s.life; c.strokeStyle = s.c; c.lineWidth = 2.2 * k; c.beginPath(); c.moveTo(px, py); c.lineTo(s.x, s.y); c.stroke(); }
      c.globalAlpha = 1;
      if (launched >= shots && !rockets.length && !sparks.length) stop(); else f = raf(frame);
    };
    f = raf(frame); fw = stop; return shots;
  };
  d.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-k-fireworks]'); if (!b) return; const r = b.getBoundingClientRect(); M.fireworks({ shots: num(b.dataset.kFireworks, 4), from: { x: r.left + r.width / 2 } }); });

  /* ---- 1 morph between screens: a card grows into its detail. data-k-morph="key" + href="#/route" (the target on the new screen carries data-k-morph-target="key", the way back
     data-k-morph-back="key" href="#/list"), or data-k-morph-open="#panel" (a <dialog> or [hidden] panel; data-k-morph-close inside it). View Transitions API, a FLIP fallback otherwise. */
  let mid = 0;
  const visible = (el) => el && (el.offsetParent !== null || el.getClientRects().length);
  const morph = async (src, update, dst) => {
    if (!allowed() || !src) { await update(); return; }
    const name = 'k-m-' + (++mid);
    if (d.startViewTransition) {
      src.style.viewTransitionName = name;
      const t = d.startViewTransition(async () => { src.style.viewTransitionName = ''; await update(); const to = dst(); if (to) to.style.viewTransitionName = name; });
      try { await t.finished; } catch (e) { /* skipped */ }
      const to = dst(); if (to) to.style.viewTransitionName = ''; src.style.viewTransitionName = '';
      return;
    }
    const a = src.getBoundingClientRect(); await update(); const to = dst(); if (!to) return; const b = to.getBoundingClientRect(); if (!b.width) return;
    to.animate([{ transformOrigin: '0 0', transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + a.width / b.width + ',' + a.height / b.height + ')', opacity: .4 }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }], { duration: 520, easing: EASE });
  };
  M.morph = morph;
  const toRoute = (h) => new Promise((res) => { const fin = () => { removeEventListener('kit:route', fin); res(); }; addEventListener('kit:route', fin); location.hash = h; setTimeout(fin, 450); });
  d.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const t = e.target.closest && e.target.closest('[data-k-morph],[data-k-morph-back],[data-k-morph-open],[data-k-morph-close]'); if (!t) return;
    if (t.hasAttribute('data-k-morph-open')) {
      const p = $(t.dataset.kMorphOpen); if (!p) return; e.preventDefault(); p._kmSrc = t;
      morph(t, () => { if (p.showModal) p.showModal(); else p.hidden = false; }, () => p);
    } else if (t.hasAttribute('data-k-morph-close')) {
      const p = t.closest('dialog,[data-k-morph-panel]'); if (!p) return; e.preventDefault(); const s = p._kmSrc;
      morph(p, () => { if (p.close) p.close(); else p.hidden = true; }, () => s);
    } else if (t.hasAttribute('data-k-morph-back')) {
      const key = t.dataset.kMorphBack, h = t.getAttribute('href'); if (!h || h[0] !== '#') return; e.preventDefault();
      morph($('[data-k-morph-target="' + key + '"]'), () => toRoute(h), () => $('[data-k-morph="' + key + '"]'));
    } else {
      const key = t.dataset.kMorph, h = t.getAttribute('href') || t.dataset.kTo; if (!h || h[0] !== '#') return; e.preventDefault();
      morph(t, () => toRoute(h), () => { const x = $$('[data-k-morph-target="' + key + '"]').find(visible); return x || null; });
    }
  });
})();
