/* @block tracks 1.0 -- Multi-track timeline: named tracks with clips placed in seconds, ruler, draggable playhead, trim handles, zoom and snapping.
 * Use for: video and audio editors (clips on tracks), podcast editing, a stage run-of-show (cues per channel), a rollout timeline with a scrubber.
 * Pick: Multi-track timeline with a draggable playhead, trimmable clips, zoom and snap; editors, run-of-show, rollouts (lanes = clock-time gantt).
 * Load: blocks.css, core.js, media.lib.css, media.lib.js, tracks.css, tracks.js
 * Call: K.block.tracks('#a-tl', {duration: 60, tracks: [{id: 'v1', label: 'Video 1', clips: [{id: 'c1', start: 2, length: 12, label: 'Intro'}]}], playhead: 4, onSeek: function (s) {}})
 * Config:
 *   duration   number, required   seconds
 *   tracks     array, required    [{id, label?, kind?, locked?, hidden?, muted?, clips[{id, start, length, label?, kind?, cat?, status?, thumb?}]}] in seconds; cat = colour key (default the track id); kind = icon (video audio image cue marker text); status = dot, word in the tooltip; thumb = image src behind the label
 *   fps        number, default 30   arrows move 1 frame, times round to frames
 *   timecode   'hms'|'frames'|'seconds', default 'hms'
 *   playhead   number, default 0    selected  text (clip id)    zoom  number, px per second (default and minimum: fit the container; maximum 40 px per frame)
 *   snap       boolean, default false   snap to playhead, clip edges, ruler ticks within 6 px (Alt while dragging = off)    trim  boolean, default true   handles on both clip ends
 *   onSeek(s) on every playhead change, onSelect(id), onTrim(id, {start, length}, 'start'|'end') and onMove(id, {start, track}) on release, onZoom(pxPerSec),
 *   onToggle(trackId, 'lock'|'hide'|'mute', value)   a track shows each button only when its flag is given; locked = clips selectable but not movable or trimmable
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * The block keeps local state (playhead, selection, trims, moves, toggles, zoom) and calls the callbacks; a changed `tracks` replaces it, a changed playhead/selected/zoom moves only that.
 * Keyboard: Left/Right playhead 1 frame (Shift 1 s), Up/Down select the clip at the playhead on the next track, [ and ] trim the selected clip to the playhead, + - zoom, Enter selects. Delete is left to the app.
 * States: empty (no tracks), loading, error, bad config; clips under 24 px show no label.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] tracks: load core.js before tracks.js'); return; }
  var KIND = { video: 'play', audio: 'volume', music: 'volume', image: 'image', cue: 'bookmark', marker: 'pin', text: 'comment' };
  var EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', SPK = 'M11 5 6 9H3v6h3l5 4z';
  var TOG = { lock: ['Lock', 'M7 11V8a5 5 0 0 1 9.5-1.6M5 11h14v10H5z', 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z'], hide: ['Hide', EYE, EYE + 'M3 3l18 18'], mute: ['Mute', SPK + 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13', SPK + 'M22 9l-6 6M16 9l6 6'] };
  var STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200], PX = 8;
  var cl = function (v, a, b) { return Math.min(Math.max(v, a), b); }, r6 = function (n) { return Math.round(n * 1e6) / 1e6; }, p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var hms = function (s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + p2(m) : m) + ':' + p2(Math.floor(s % 60)); };
  // time -> text; d = decimals (frames mode: d > 0 adds the frame number)
  var tc = function (t, mode, F, d) {
    t = Math.max(0, t);
    if (mode === 'seconds') return t.toFixed(d) + 's';
    if (mode === 'frames') { var n = Math.round(t * F); return hms(Math.floor(n / F)) + (d ? ':' + p2(n % F) : ''); }
    var k = Math.pow(10, d), w; t = Math.round(t * k) / k; w = Math.floor(t + 1e-9);
    return hms(w) + (d ? '.' + ('00' + Math.round((t - w) * k)).slice(-d) : '');
  };
  var edge = ['start', 'end'];

  K.block.define('tracks', {
    version: '1.0',
    resize: true,
    emptyText: 'No tracks yet',
    schema: {
      duration: { type: 'number', required: true },
      tracks: { type: 'array', required: true, of: {
        id: { type: 'text', required: true }, label: { type: 'text' }, kind: { type: 'string' }, locked: { type: 'boolean' }, hidden: { type: 'boolean' }, muted: { type: 'boolean' },
        clips: { type: 'array', of: { id: { type: 'text', required: true }, start: { type: 'number', required: true }, length: { type: 'number', required: true }, label: { type: 'text' },
          kind: { type: 'string' }, cat: { type: 'text' }, status: { type: 'text' }, thumb: { type: 'string' } } } } },
      fps: { type: 'number', default: 30 },
      timecode: { type: 'string', enum: ['hms', 'frames', 'seconds'], default: 'hms' },
      playhead: { type: 'number', default: 0 }, selected: { type: 'text' }, zoom: { type: 'number' },
      snap: { type: 'boolean', default: false }, trim: { type: 'boolean', default: true },
      onSeek: { type: 'function' }, onSelect: { type: 'function' }, onTrim: { type: 'function' }, onMove: { type: 'function' }, onToggle: { type: 'function' }, onZoom: { type: 'function' }
    },
    empty: function (c) { return !c.tracks.length; },
    render: function (el, c, h) {
      var dur = c.duration, F = c.fps > 0 ? c.fps : 30, mode = c.timecode, M = K.media, m1 = 1 / F;
      if (!(dur > 0)) throw new Error('duration must be greater than 0');
      var fr = function (t) { return cl(r6(Math.round(t * F) / F), 0, dur); }, ft = function (t, d) { return tc(t, mode, F, d); };
      var sig = JSON.stringify([dur, F, c.tracks]), st = h._kTr;
      if (!st || st.sig !== sig) {
        var seen = {}, fix = 0, dup = 0;
        st = h._kTr = { sig: sig, T: [], C: [] };
        c.tracks.forEach(function (t) {
          var tr = { id: t.id, label: t.label != null ? String(t.label) : String(t.id), kind: t.kind, lock: t.locked, hide: t.hidden, mute: t.muted };
          st.T.push(tr);
          (t.clips || []).forEach(function (k) {
            var s = cl(k.start, 0, dur - m1), l = cl(k.length, m1, dur - s);
            if (s !== k.start || l !== k.length) fix++;
            if (seen[k.id]) dup++;
            seen[k.id] = 1;
            st.C.push({ id: k.id, s: s, l: l, label: k.label != null ? String(k.label) : '', kind: k.kind, cat: k.cat, status: k.status, thumb: k.thumb, tr: tr });
          });
        });
        if (fix) h.warn(fix + ' clip(s) outside 0..duration or shorter than one frame were clamped', 'fix');
        if (dup) h.warn(dup + ' duplicate clip id(s): selection and callbacks use the first', 'dup');
      }
      if (st.cph !== c.playhead) { st.cph = c.playhead; st.ph = fr(c.playhead); }
      if (st.csel !== c.selected) { st.csel = c.selected; st.sel = c.selected != null ? String(c.selected) : null; }
      if (st.cz !== c.zoom) { st.cz = c.zoom; if (c.zoom > 0) { st.z = c.zoom; st.zoomed = true; } }
      var T = st.T, C = st.C;
      var byId = function (id) { return C.filter(function (k) { return String(k.id) === id; })[0]; };
      var go = function (n, a, b, d) {
        var f = c[n];
        if (typeof f !== 'function') return;
        try { f(a, b, d); } catch (e) { h.warn(n + ' threw: ' + String((e && e.message) || e).slice(0, 120)); }
      };

      var root = h.el('div', { class: 'k-tracks', role: 'group', 'aria-label': c.title != null ? String(c.title) : 'Timeline' });
      var sc = h.el('div', { class: 'k-tracks-sc' }), inn = h.el('div', { class: 'k-tracks-in' }), hc = h.el('div', { class: 'k-tracks-hc' });
      var btn = function (cls, label, text) { return h.el('button', { class: cls, type: 'button', 'aria-label': label, title: label, text: text }); };
      var zo = btn('k-tracks-z', 'Zoom out', '\u2212'), zi = btn('k-tracks-z', 'Zoom in', '+'), cur = h.el('span', { class: 'k-tracks-cur k-b-nw' });
      var ruler = h.el('div', { class: 'k-tracks-lane k-tracks-ruler' });
      var pl = h.el('i', { class: 'k-tracks-pl' }), sg = h.el('i', { class: 'k-tracks-sg' }), bub = h.el('span', { class: 'k-tracks-bub k-b-nw', 'aria-hidden': 'true' });
      var pk = h.el('span', { class: 'k-tracks-pk', role: 'slider', tabindex: 0, 'aria-label': 'Playhead', 'aria-valuemin': 0, 'aria-valuemax': dur });
      var ph = h.el('div', { class: 'k-tracks-ph' }, [sg, pl, bub, pk]);
      hc.appendChild(h.el('div', { class: 'k-tracks-hd k-tracks-rr' }, [zo, zi, cur]));
      inn.appendChild(h.el('div', { class: 'k-tracks-row k-tracks-rr' }, ruler));
      inn.appendChild(ph);
      var flags = function (t) { ['lock', 'hide', 'mute'].forEach(function (k) { t.row.toggleAttribute('data-' + k, !!t[k]); }); };
      var tog = function (t, k) {
        var b = btn('k-tracks-t', TOG[k][0] + ' track ' + t.label), p = h.svg('path', {});
        var paint = function () { b.setAttribute('aria-pressed', t[k] ? 'true' : 'false'); p.setAttribute('d', TOG[k][t[k] ? 2 : 1]); };
        b.appendChild(h.svg('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, p));
        paint();
        b.addEventListener('click', function () { t[k] = !t[k]; paint(); flags(t); go('onToggle', t.id, k, t[k]); });
        return b;
      };
      T.forEach(function (t) {
        t.lane = h.el('div', { class: 'k-tracks-lane', role: 'group', 'aria-label': t.label + ' clips' });
        hc.appendChild(h.el('div', { class: 'k-tracks-hd' }, [t.kind && M && KIND[t.kind] ? M.icon(h, KIND[t.kind], { size: 14 }) : null,
          h.line(t.label, { class: 'k-tracks-tn' })].concat(['lock', 'hide', 'mute'].filter(function (k) { return t[k] != null; }).map(function (k) { return tog(t, k); }))));
        t.row = h.el('div', { class: 'k-tracks-row', 'data-track': String(t.id) }, t.lane);
        flags(t);
        inn.appendChild(t.row);
      });
      var info = function (k) {
        var s = (k.label || 'Clip ' + k.id) + ', ' + ft(k.s, 2) + ' to ' + ft(k.s + k.l, 2) + (k.status ? ', ' + k.status : '');
        k.el.setAttribute('aria-label', s); k.el.title = s; k.lb.title = s;
      };
      C.forEach(function (k) {
        var ic = k.kind && M && KIND[k.kind] ? M.icon(h, KIND[k.kind], { size: 12 }) : null;
        k.lb = h.line(k.label, { class: 'k-tracks-lb' });
        k.el = h.el('div', { class: 'k-tracks-c', id: String(k.id), role: 'button', tabindex: -1, style: { '--k-ic': h.catFor(k.cat != null ? k.cat : k.tr.id) } }, [
          k.thumb ? h.el('img', { class: 'k-tracks-th', src: k.thumb, alt: '', draggable: 'false', on: { error: function () { this.remove(); } } }) : null,
          c.trim ? h.el('span', { class: 'k-tracks-hs', 'aria-hidden': 'true' }) : null, ic,
          k.status ? h.el('i', { class: 'k-b-dot ' + h.status(k.status), 'aria-hidden': 'true' }) : null, k.lb,
          c.trim ? h.el('span', { class: 'k-tracks-he', 'aria-hidden': 'true' }) : null]);
        k.el._k = k;
        info(k);
        k.tr.lane.appendChild(k.el);
      });
      sc.appendChild(inn); root.appendChild(hc); root.appendChild(sc); el.appendChild(root);

      st.fit = Math.max(40, Math.floor(sc.clientWidth - 2 * PX) - 1) / dur;
      st.max = Math.max(st.fit, 40 * F);
      st.z = st.z > 0 && st.zoomed ? cl(st.z, st.fit, st.max) : st.fit;
      var place = function (k) {
        var w = k.l * st.z;
        k.el.style.left = k.s * st.z + 'px'; k.el.style.width = Math.max(w, 2) + 'px';
        k.el.toggleAttribute('data-xs', w < 24);
      };
      var phPaint = function (nr) {
        var x = st.ph * st.z + PX, v = ft(st.ph, 2);
        pl.style.left = pk.style.left = bub.style.left = x + 'px';
        bub.style.transform = x < 40 ? 'none' : x > st.lw - 22 ? 'translateX(-100%)' : 'translateX(-50%)';
        pk.setAttribute('aria-valuenow', r6(st.ph)); pk.setAttribute('aria-valuetext', v);
        cur.textContent = bub.textContent = v;
        if (!nr) rul();
      };
      var rul = function () {
        var z = st.z, px = st.ph * z, sl = sc.scrollLeft - PX, t0 = Math.max(0, sl / z - 1), t1 = Math.min(dur, (sl + sc.clientWidth) / z + 1);
        var s = STEPS.filter(function (x) { return x * z >= 76; })[0] || STEPS[STEPS.length - 1], mn = s / 5, dd = s >= 1 ? 0 : s >= 0.1 ? 1 : 2, fg = document.createDocumentFragment();
        st.step = s;
        inn.style.setProperty('--k-tr-gs', s * z + 'px');
        for (var i = Math.ceil(t0 / mn - 1e-6), n = 0; i * mn <= t1 + 1e-6 && n < 400; i++, n++) {
          var t = r6(i * mn), maj = i % 5 === 0, tx = maj ? ft(t, dd) : '';
          fg.appendChild(h.el('i', { class: 'k-tracks-tk' + (maj ? '' : ' k-tracks-tm'), style: { left: t * z + 'px' } }, maj && t * z + tx.length * 6.5 + 8 <= st.lw && !(px > t * z + 2 && px < t * z + tx.length * 6.5 + 8) ? h.el('span', { text: tx }) : null));
        }
        ruler.textContent = '';
        ruler.appendChild(fg);
      };
      var layout = function (ct) {
        var z = st.z, lw = st.lw = Math.ceil(dur * z - 1e-6);
        inn.style.width = lw + 2 * PX + 'px';
        ruler.style.width = lw + 'px';
        T.forEach(function (t) { t.lane.style.width = lw + 'px'; });
        C.forEach(place);
        zo.disabled = z <= st.fit * 1.0001; zi.disabled = z >= st.max * 0.9999;
        phPaint(1);
        if (ct != null) sc.scrollLeft = ct * z + PX - sc.clientWidth / 2;
        rul();
      };
      var reveal = function () { var x = st.ph * st.z + PX, vw = sc.clientWidth; if (x < sc.scrollLeft || x > sc.scrollLeft + vw) sc.scrollLeft = Math.max(0, x - vw / 2); };
      layout();
      if (st.sl == null) reveal(); else sc.scrollLeft = st.sl;
      sc.addEventListener('scroll', function () { st.sl = sc.scrollLeft; rul(); });

      var paintSel = function () {
        var s = byId(st.sel), tab = s || C[0];
        C.forEach(function (k) { k.el.setAttribute('aria-pressed', k === s ? 'true' : 'false'); k.el.tabIndex = k === tab ? 0 : -1; });
      };
      var select = function (k, quiet) {
        st.sel = String(k.id); paintSel();
        k.el.focus(quiet ? { preventScroll: true } : undefined);
        go('onSelect', k.id);
      };
      var seek = function (t) { t = fr(t); if (t === st.ph) return; st.ph = t; phPaint(); go('onSeek', t); };
      var trim = function (k, ed, t) {
        var e = k.s + k.l;
        if (ed === 'start') { t = cl(t, 0, e - m1); k.s = r6(t); k.l = r6(e - t); } else { t = cl(t, k.s + m1, dur); k.l = r6(t - k.s); }
        place(k);
      };
      var zoomTo = function (z) {
        z = cl(z, st.fit, st.max);
        if (Math.abs(z - st.z) < 1e-9) return;
        var ct = (sc.scrollLeft + sc.clientWidth / 2 - PX) / st.z;
        st.z = z; st.zoomed = z > st.fit * 1.001;
        layout(ct);
        go('onZoom', r6(z));
      };
      zo.addEventListener('click', function () { zoomTo(st.z / 2); });
      zi.addEventListener('click', function () { zoomTo(st.z * 2); });
      sc.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTo(st.z * (e.deltaY < 0 ? 1.25 : 0.8)); } }, { passive: false });

      // ---- snapping: nearest playhead, clip edge, 0, end or ruler tick within 6 px
      var near = function (t, skip) {
        var tol = 6 / st.z, b = null, bd = tol + 1e-9;
        var tr = function (v) { var d = Math.abs(v - t); if (d < bd) { bd = d; b = v; } };
        if (skip !== 'ph') tr(st.ph);
        tr(0); tr(dur); tr(Math.round(t / st.step) * st.step);
        C.forEach(function (k) { if (k !== skip) { tr(k.s); tr(k.s + k.l); } });
        return b;
      };
      var guide = function (q) { sg.style.left = (q || 0) * st.z + PX + 'px'; sg.toggleAttribute('data-on', q != null); };
      var snapped = function (ev) { return c.snap && !ev.altKey; };
      var snap1 = function (t, k, ev) { var q = snapped(ev) ? near(t, k) : null; guide(q); return q != null ? q : t; };
      var snapMove = function (t, k, ev) {
        var a = snapped(ev) ? near(t, k) : null, b = snapped(ev) ? near(t + k.l, k) : null;
        var da = a == null ? 9e9 : Math.abs(a - t), db = b == null ? 9e9 : Math.abs(b - t - k.l);
        guide(da <= db ? a : b);
        return a != null && da <= db ? a : b != null ? b - k.l : t;
      };

      // ---- pointer: one delegated handler (ruler/playhead seek; clip select, move, trim)
      var drag = function (e, move, end) {
        e.preventDefault();
        try { sc.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer: keep listening on sc */ }
        var up = function (ev) {
          sc.removeEventListener('pointermove', move); sc.removeEventListener('pointerup', up); sc.removeEventListener('pointercancel', up);
          try { sc.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
          end(ev);
        };
        sc.addEventListener('pointermove', move); sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up);
      };
      sc.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        var t = e.target, left = ruler.getBoundingClientRect().left;
        if (t.closest('.k-tracks-ruler,.k-tracks-pk')) {
          var off = pk.contains(t) ? e.clientX - left - st.ph * st.z : 0, mv = function (ev) { seek(cl(snap1((ev.clientX - left - off) / st.z, 'ph', ev), 0, dur)); };
          bub.toggleAttribute('data-on', true);
          mv(e);
          drag(e, mv, function () { bub.removeAttribute('data-on'); guide(null); });
          pk.focus({ preventScroll: true });
          return;
        }
        var ce = t.closest('.k-tracks-c'), k = ce && ce._k;
        if (!k) return;
        select(k, true);
        if (k.tr.lock) return;
        var ed = t.classList.contains('k-tracks-hs') ? 'start' : t.classList.contains('k-tracks-he') ? 'end' : '', s0 = k.s, l0 = k.l, tr0 = k.tr, x0 = e.clientX, y0 = e.clientY, moved = false;
        drag(e, function (ev) {
          var dx = ev.clientX - x0;
          if (!moved && Math.abs(dx) < 3 && Math.abs(ev.clientY - y0) < 3) return;
          moved = true;
          var d = dx / st.z;
          if (ed === 'start') trim(k, 'start', fr(snap1(s0 + d, k, ev)));
          else if (ed === 'end') trim(k, 'end', fr(snap1(s0 + l0 + d, k, ev)));
          else {
            k.el.classList.add('k-tracks-drag');
            k.s = r6(fr(cl(snapMove(cl(s0 + d, 0, dur - l0), k, ev), 0, dur - l0)));
            var row = T.filter(function (q) { var r = q.lane.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY < r.bottom; })[0];
            if (row && row !== k.tr && !row.lock) { k.tr = row; row.lane.appendChild(k.el); k.el.focus({ preventScroll: true }); }
            place(k);
          }
        }, function () {
          k.el.classList.remove('k-tracks-drag'); guide(null);
          if (!moved) return;
          if (ed) { if (k.s !== s0 || k.l !== l0) { info(k); go('onTrim', k.id, { start: k.s, length: k.l }, ed); } }
          else if (k.s !== s0 || k.tr !== tr0) { info(k); go('onMove', k.id, { start: k.s, track: k.tr.id }); }
        });
      });

      root.addEventListener('keydown', function (e) {
        var key = e.key, t = e.target, s = byId(st.sel);
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (key === 'ArrowLeft' || key === 'ArrowRight') { seek(st.ph + (key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : m1)); reveal(); }
        else if (key === '[' || key === ']') {
          if (s && !s.tr.lock) {
            var s0 = s.s, l0 = s.l, ed = edge[key === '[' ? 0 : 1];
            trim(s, ed, st.ph);
            if (s.s !== s0 || s.l !== l0) { info(s); go('onTrim', s.id, { start: s.s, length: s.l }, ed); }
          }
        } else if (key === '+' || key === '=') zoomTo(st.z * 2);
        else if (key === '-') zoomTo(st.z / 2);
        else if (key === 'ArrowUp' || key === 'ArrowDown') {
          var dir = key === 'ArrowDown' ? 1 : -1, dist = function (k) { return st.ph >= k.s && st.ph <= k.s + k.l ? 0 : Math.min(Math.abs(k.s - st.ph), Math.abs(k.s + k.l - st.ph)); };
          for (var j = (s ? T.indexOf(s.tr) : -1) + dir; j >= 0 && j < T.length; j += dir) {
            var q = C.filter(function (k) { return k.tr === T[j]; }).sort(function (a, b) { return dist(a) - dist(b); })[0];
            if (q) { select(q); break; }
          }
        } else if ((key === 'Enter' || key === ' ') && t._k) select(t._k);
        else return;
        e.preventDefault();
      });

      paintSel();
    }
  });
})();
