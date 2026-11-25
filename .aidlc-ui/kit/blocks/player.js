/* @block player 1.0 -- Media player: now-playing bar or card with transport buttons, seek and volume; video adds a 16:9 stage.
 * Use for: music players (Night Drive, a playlist footer bar), podcast players (episode card with speed), a video control strip under a poster.
 * Pick: Now-playing bar, podcast card or video control strip: play/pause, seek, volume, shuffle/repeat, like; works without app glue.
 * Load: blocks.css, core.js, media.lib.css, media.lib.js, player.css, player.js
 * Call: K.block.player('#a-player', {track: {title: 'Night Drive', artist: 'Harbour Lights'}, duration: 225, position: 83, playing: true, onPause: function () {}})
 * Config:
 *   track      object             {title, artist?, album?, cover?: {src?, glyph?, key?}}; missing or no title = the "no track" empty state
 *   kind       'audio'|'video', default 'audio'  video adds a 16:9 stage (cover/poster) above the controls
 *   playing    boolean, default false   playback state (`state` stays the core loading/empty/error option)
 *   position   number, default 0   seconds
 *   duration   number, default 0   seconds; 0 = unknown (seek disabled, "\u2014")
 *   volume     number 0-100       shows the mute button and volume slider (also when only `muted` is given)
 *   muted, shuffle, liked   boolean   each one given shows its toggle button
 *   repeat     'off'|'all'|'one'  shows the repeat button (cycles)
 *   speed      number             shows a speed button (0.75, 1, 1.25, 1.5, 2; cycles)
 *   queueCount number             quiet "N in queue" chip
 *   layout     'bar'|'card'|'auto', default 'auto'  bar/auto = one row from 720 px container width, stacked below (cover+title, seek, buttons, extras); card = always stacked with a bigger cover
 *   live       boolean, default false  advance position once a second while playing, stops at duration (default off = deterministic)
 *   onPlay(), onPause(), onSeek(seconds), onPrev(), onNext(), onVolume(v), onToggle(name, value)   name: shuffle|repeat|like|mute|speed
 *   (common)   title (accessible name of the group; frame is off), state, emptyText, errorText
 * States: no track (empty), loading, error, bad config, playing, paused, no duration, video stage.
 * Keyboard: Tab through the buttons; Seek and Volume are sliders (arrows, Home/End, PageUp/PageDown).
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] player: load core.js before player.js'); return; }
  if (!K.media) { console.warn('[K.block] player: load media.lib.js before player.js'); return; }
  var M = K.media, SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  K.block.define('player', {
    version: '1.0',
    frame: false,
    emptyText: 'No track selected',
    schema: {
      track: { type: 'object' },
      kind: { type: 'string', enum: ['audio', 'video'], default: 'audio' },
      playing: { type: 'boolean', default: false },
      position: { type: 'number', default: 0 }, duration: { type: 'number', default: 0 },
      volume: { type: 'number' }, muted: { type: 'boolean' }, shuffle: { type: 'boolean' }, liked: { type: 'boolean' },
      repeat: { type: 'string', enum: ['off', 'all', 'one'] },
      speed: { type: 'number' }, queueCount: { type: 'number' },
      layout: { type: 'string', enum: ['bar', 'card', 'auto'], default: 'auto' },
      live: { type: 'boolean', default: false },
      onPlay: { type: 'function' }, onPause: { type: 'function' }, onSeek: { type: 'function' }, onPrev: { type: 'function' }, onNext: { type: 'function' },
      onVolume: { type: 'function' }, onToggle: { type: 'function' }
    },
    empty: function (c) { return !c.track || c.track.title == null || c.track.title === ''; },
    render: function (el, c, h) {
      var tr = c.track, video = c.kind === 'video', dur = c.duration > 0 ? c.duration : 0;
      var txt = function (v, f) {
        if (v == null || v === '') return '';
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        h.warn('track.' + f + ' must be a string or number; shown as "\u2014"');
        return '\u2014';
      };
      var title = txt(tr.title, 'title'), sub = [txt(tr.artist, 'artist'), txt(tr.album, 'album')].filter(Boolean).join(' \u00b7 ');
      var cov = tr.cover && typeof tr.cover === 'object' ? tr.cover : {};
      el.style.maxWidth = video ? '36rem' : '';
      var warned = {};
      var go = function (name, a, b) {
        var fn = c[name];
        if (typeof fn !== 'function') return;
        try { fn(a, b); } catch (e) { if (!warned[name]) { warned[name] = 1; h.warn(name + ' threw: ' + String((e && e.message) || e).slice(0, 120)); } }
      };
      // local state survives re-renders of the same config; a changed config (the app's update) replaces it
      var sig = [c.playing, c.position, dur, c.volume, c.muted, c.shuffle, c.repeat, c.liked, c.speed, title].join('|'), st = el._kPl;
      if (!st || st.sig !== sig) st = el._kPl = { sig: sig, playing: c.playing, pos: Math.max(0, Math.min(dur || Infinity, c.position)), vol: c.volume, muted: !!c.muted, shuffle: !!c.shuffle, repeat: c.repeat || 'off', liked: !!c.liked, speed: c.speed };

      var ic = function (b, name, size) { if (b._ic !== name) { b._ic = name; var s = b.querySelector('svg'), n = M.icon(h, name, { size: size }); if (s) b.replaceChild(n, s); else b.insertBefore(n, b.firstChild); } };
      var btn = function (cls, icon, onclick) {
        var b = h.el('button', { class: 'k-player-b ' + cls, type: 'button' });
        ic(b, icon);
        b.addEventListener('click', onclick);
        return b;
      };
      var label = function (b, text) { b.setAttribute('aria-label', text); b.setAttribute('title', text); };
      var pressed = function (b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
      var range = function (cls, name, min, max, val, input, change) {
        var r = h.el('input', { class: 'k-player-range ' + cls, type: 'range', min: min, max: max, step: 1, value: val, 'aria-label': name });
        r.addEventListener('input', input);
        if (change) r.addEventListener('change', change);
        return r;
      };

      var root = h.el('div', { class: 'k-player k-player-' + c.kind + (c.layout === 'card' ? ' k-player-card' : video ? '' : ' k-player-bar'), role: 'group', 'aria-label': c.title != null ? String(c.title) : 'Media player' });
      var play = btn('k-player-play', 'play', function () {
        if (!st.playing && dur && st.pos >= dur) st.pos = 0;
        st.playing = !st.playing;
        paint();
        go(st.playing ? 'onPlay' : 'onPause');
      });
      var seek = range('k-player-seek', 'Seek', 0, dur || 1, 0, function () { st.pos = +seek.value; paint(true); }, function () { go('onSeek', st.pos); });
      if (!dur) seek.disabled = true;
      var tl = h.el('span', { class: 'k-player-time k-b-nw k-player-tl' }), tr2 = h.el('span', { class: 'k-player-time k-b-nw' });
      var shuffle = c.shuffle != null ? btn('', 'shuffle', function () { st.shuffle = !st.shuffle; paint(); go('onToggle', 'shuffle', st.shuffle); }) : null;
      var repeat = c.repeat != null ? btn('k-player-rep', 'repeat', function () { st.repeat = st.repeat === 'off' ? 'all' : st.repeat === 'all' ? 'one' : 'off'; paint(); go('onToggle', 'repeat', st.repeat); }) : null;
      var like = c.liked != null ? btn('k-player-like', 'heart', function () { st.liked = !st.liked; paint(); go('onToggle', 'like', st.liked); }) : null;
      var prev = btn('', 'prev', function () { go('onPrev'); }), next = btn('', 'next', function () { go('onNext'); });
      label(prev, 'Previous'); label(next, 'Next');
      var hasVol = c.volume != null || c.muted != null;
      var mute = null, vol = null, speed = null;
      if (hasVol) {
        mute = btn('', 'volume', function () { st.muted = !st.muted; paint(); go('onToggle', 'mute', st.muted); });
        if (st.vol == null) st.vol = 100;
        vol = range('k-player-vol', 'Volume', 0, 100, 0, function () {
          st.vol = +vol.value;
          if (st.muted && st.vol > 0) { st.muted = false; go('onToggle', 'mute', false); }
          paint(true);
          go('onVolume', st.vol);
        });
      }
      if (c.speed != null) speed = h.el('button', { class: 'k-player-b k-player-sp k-b-nw', type: 'button' });
      if (speed) speed.addEventListener('click', function () {
        var i = 0, d = 1e9;
        SPEEDS.forEach(function (s, k) { if (Math.abs(s - st.speed) < d) { d = Math.abs(s - st.speed); i = k; } });
        st.speed = SPEEDS[(i + 1) % SPEEDS.length];
        paint();
        go('onToggle', 'speed', st.speed);
      });

      var paint = function (light) {
        var on = st.playing;
        pressed(play, on); label(play, on ? 'Pause' : 'Play'); ic(play, on ? 'pause' : 'play', 24);
        root.setAttribute('data-playing', on ? 'true' : 'false');
        seek.value = st.pos;
        seek.style.setProperty('--k-pl-p', (dur ? Math.min(100, st.pos / dur * 100) : 0) + '%');
        seek.setAttribute('aria-valuetext', 'Position ' + M.clock(st.pos) + (dur ? ' of ' + M.clock(dur) : ''));
        tl.textContent = M.clock(st.pos); tr2.textContent = dur ? M.clock(dur) : '\u2014';
        if (vol) {
          var v = st.muted ? 0 : st.vol;
          vol.value = v; vol.style.setProperty('--k-pl-p', v + '%');
          vol.setAttribute('aria-valuetext', st.muted ? 'Muted' : 'Volume ' + st.vol + ' percent');
        }
        if (light) return;
        if (shuffle) { pressed(shuffle, st.shuffle); label(shuffle, 'Shuffle'); }
        if (repeat) {
          pressed(repeat, st.repeat !== 'off'); label(repeat, 'Repeat ' + st.repeat);
          var one = repeat.querySelector('.k-player-1');
          if (st.repeat === 'one' && !one) repeat.appendChild(h.el('span', { class: 'k-player-1', 'aria-hidden': 'true', text: '1' }));
          if (st.repeat !== 'one' && one) repeat.removeChild(one);
        }
        if (like) { pressed(like, st.liked); label(like, 'Like'); }
        if (mute) { pressed(mute, st.muted); label(mute, 'Mute'); ic(mute, st.muted ? 'mute' : 'volume'); }
        if (speed) { speed.textContent = h.num(st.speed) + '\u00d7'; label(speed, 'Playback speed ' + h.num(st.speed) + '\u00d7, change'); }
      };

      // layout
      var info = h.el('div', { class: 'k-player-info' }, [
        video ? null : h.el('div', { class: 'k-player-cov' }, [M.cover(h, { title: title, src: cov.src, alt: '', key: cov.key, glyph: cov.glyph, ratio: '1/1' })]),
        h.el('div', { class: 'k-player-meta' }, [h.line(title, { class: 'k-player-t' }), sub ? h.line(sub, { class: 'k-player-sub' }) : null]),
        like]);
      if (video) {
        var stage = h.el('div', { class: 'k-player-stage' }, [M.cover(h, { title: title, src: cov.src, alt: '', key: cov.key, glyph: cov.glyph, ratio: '16/9' }),
          h.el('span', { class: 'k-player-ov', 'aria-hidden': 'true' }, [M.icon(h, 'play', { size: 28 })])]);
        stage.addEventListener('click', function () { play.click(); });
        root.appendChild(stage);
      }
      root.appendChild(info);
      root.appendChild(h.el('div', { class: 'k-player-seekrow', style: { '--k-pl-tw': (M.clock(dur).length + 0.5) + 'ch' } }, [tl, seek, tr2]));
      root.appendChild(h.el('div', { class: 'k-player-tr' }, [shuffle, prev, play, next, repeat]));
      var ex = [speed, c.queueCount != null ? h.el('span', { class: 'k-player-q k-b-nw', title: M.count(c.queueCount) + ' in queue', text: M.count(c.queueCount) + ' in queue' }) : null, mute, vol].filter(Boolean);
      if (ex.length) root.appendChild(h.el('div', { class: 'k-player-ex' }, ex));
      else root.classList.add('k-player-noex');
      el.appendChild(root);
      paint();

      if (c.live) {
        var id = setInterval(function () {
          if (!st.playing || seek.matches(':active')) return;
          st.pos = dur ? Math.min(dur, st.pos + 1) : st.pos + 1;
          if (dur && st.pos >= dur) st.playing = false;
          paint();
        }, 1000);
        h.cleanup(function () { clearInterval(id); });
      }
    }
  });
})();
