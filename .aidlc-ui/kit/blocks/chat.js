/* @block chat 1.0 -- Message thread with a composer: grouped bubbles, day separators, replies, reactions, attachments, typing row, send status.
 * Use for: chat apps (Marta and Dev), support inboxes, an AI-assistant conversation, a group chat.
 * Pick: Message thread plus composer: bubbles per person, day separators, reactions, send status, typing row; local echo on send.
 * Load: blocks.css, core.js, media.lib.css, media.lib.js, chat.css, chat.js
 * Call: K.block.chat('#a-chat', {me: 'me', people: [{id: 'marta', name: 'Marta Silva'}], messages: [{id: 'm1', from: 'marta', text: 'Hello', time: '09:12'}], onSend: function (text) {}})
 * Config:
 *   me         text, default 'me'  id of the current user (right side, accent-soft bubbles)
 *   people     array  [{id, name?, src?, status?}] status online|away|busy|offline; an unknown id shows as its id
 *   messages   array, default []  oldest first: [{id?, from, text?, time?, status?, reactions?, replyTo?, attachment?}]; needs text or attachment
 *     from     text, required    person id
 *     time     ISO string | 'HH:MM' | Date  ISO and Date give day separators (Today, Yesterday, date) and the group time; 'HH:MM' is shown as given
 *     status   'sending'|'sent'|'delivered'|'read'|'failed'  mine only: icon + word; failed shows Retry
 *     reactions [{emoji, count?, mine?}]  chips; a click toggles mine locally and calls onReact
 *     replyTo  {text, from?}  quoted line above the bubble
 *     attachment {kind: 'image'|'file', name, size?, src?, glyph?}  image = tinted tile (src over it); file = type tile + name + size
 *   typing     text | array  person id(s): "Marta is typing" row with three dots
 *   composer   {placeholder?, sendLabel?, disabled?} | false  false = read only. Enter sends, Shift+Enter newline, grows to 5 lines
 *   height     number (px)  fixed thread height; default grows to 480 px, then scrolls with the newest message in view
 *   onSend(text), onRetry(message), onReact(message, emoji)   send appends a local message from `me` (sent); an app update() replaces the local list
 *   (common)   title + subtitle (header), emptyText (empty thread note), state, errorText
 * States: empty thread (composer only), loading, error, bad config, typing, failed message.
 */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.block || !K.block.define) { console.warn('[K.block] chat: load core.js before chat.js'); return; }
  if (!K.media) { console.warn('[K.block] chat: load media.lib.js before chat.js'); return; }
  var M = K.media, WORD = { sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed to send' }, GAP = 600000;
  var str = function (v) { return v == null ? '' : String(v); };
  var stamp = function (m) {
    if (typeof m.time$ms === 'number') return m.time$ms;
    if (typeof m.time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.time)) { var t = Date.parse(m.time); return isNaN(t) ? null : t; }
    return null;
  };
  K.block.define('chat', {
    version: '1.0',
    frame: false,
    emptyText: 'No messages yet',
    schema: {
      me: { type: 'text', default: 'me' },
      people: { type: 'array', default: [], of: { id: { type: 'text', required: true }, name: { type: 'text' }, src: { type: 'text' }, status: { type: 'string' } } },
      messages: { type: 'array', default: [], of: {
        id: { type: 'text' }, from: { type: 'text', required: true }, text: { type: 'text' }, time: { type: 'time' },
        status: { type: 'string', enum: ['sending', 'sent', 'delivered', 'read', 'failed'] },
        reactions: { type: 'array', of: { emoji: { type: 'text', required: true }, count: { type: 'number' }, mine: { type: 'boolean' } } },
        replyTo: { type: 'object' }, attachment: { type: 'object' } } },
      typing: { type: 'any' }, composer: { type: 'any' }, height: { type: 'number' },
      onSend: { type: 'function' }, onRetry: { type: 'function' }, onReact: { type: 'function' }
    },
    render: function (el, c, h) {
      var me = str(c.me), people = {}, warned = {};
      c.people.forEach(function (p) { people[str(p.id)] = p; });
      var who = function (id) { var p = people[str(id)]; return p || { id: id, name: str(id) }; };
      var nameOf = function (id) { var p = who(id); return str(p.name != null && p.name !== '' ? p.name : id); };
      var go = function (name, a, b) {
        if (typeof c[name] !== 'function') return;
        try { c[name](a, b); } catch (e) { if (!warned[name]) { warned[name] = 1; h.warn(name + ' threw: ' + String((e && e.message) || e).slice(0, 120)); } }
      };
      var comp = c.composer === false ? null : (c.composer && typeof c.composer === 'object' ? c.composer : {});
      var sig = JSON.stringify(c.messages), st = el._kChat;
      if (!st || st.sig !== sig) st = el._kChat = { sig: sig, local: [], over: {}, rx: {}, n: 0, draft: st ? st.draft : '', focus: st ? st.focus : false };

      // long unbroken words get break opportunities, so a bubble never overflows
      var soft = function (text) {
        var out = [];
        str(text).split(/(\s+)/).forEach(function (t) {
          var a = Array.from(t);
          if (a.length <= 24 || /^\s/.test(t)) { out.push(t); return; }
          for (var i = 0; i < a.length; i += 20) { if (i) out.push(h.el('wbr')); out.push(h.el('span', { class: 'k-b-nw', text: a.slice(i, i + 20).join('') })); }
        });
        return out;
      };
      var dayLabel = function (t) {
        var d = new Date(t), n = new Date(), y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
        return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : h.date(d, { weekday: true });
      };
      var statusIcon = function (s) {
        if (s === 'sending') return h.el('span', { class: 'k-b-spin k-chat-spin', 'aria-hidden': 'true' });
        if (s === 'failed') return M.icon(h, 'close', { size: 14 });
        var ic = h.el('span', { class: 'k-chat-chk', 'aria-hidden': 'true' }, [M.icon(h, 'check', { size: 14 })]);
        if (s === 'delivered' || s === 'read') ic.appendChild(M.icon(h, 'check', { size: 14 }));
        return ic;
      };

      var root = h.el('div', { class: 'k-chat' });
      if (c.title != null) {
        root.appendChild(h.el('div', { class: 'k-chat-head' }, [h.el('h' + Math.min(6, Math.max(2, c.headingLevel | 0)), { class: 'k-chat-title', title: str(c.title) }, h.nowrap(c.title)),
          c.subtitle != null ? h.line(c.subtitle, { class: 'k-chat-sub' }) : null]));
      }
      var list = h.el('ol', { class: 'k-chat-list' });
      var log = h.el('div', { class: 'k-chat-log', role: 'log', 'aria-live': 'polite', tabindex: '0', 'aria-label': c.title != null ? str(c.title) : 'Messages', style: c.height > 0 ? { height: c.height + 'px', 'max-height': 'none' } : null }, [list]);
      root.appendChild(log);

      var typing = [].concat(c.typing == null || c.typing === false ? [] : c.typing).filter(function (x) { return x != null && x !== ''; });

      var msgEl = function (m, mine, orig) {
        var id = str(m.id), status = mine ? (st.over[id] || m.status) : null, att = m.attachment && typeof m.attachment === 'object' ? m.attachment : null, rp = m.replyTo && typeof m.replyTo === 'object' ? m.replyTo : null;
        var kids = [];
        if (rp && rp.text != null) kids.push(h.el('div', { class: 'k-chat-reply' }, [rp.from != null ? h.line(nameOf(rp.from), { class: 'k-chat-rn' }) : null, h.line(str(rp.text), { class: 'k-chat-rt' })]));
        if (att) {
          var nm = str(att.name);
          if (att.kind === 'file') {
            var ext = (/\.([A-Za-z0-9]{1,4})$/.exec(nm) || [0, 'FILE'])[1].toUpperCase();
            kids.push(h.el('div', { class: 'k-chat-file' }, [h.el('span', { class: 'k-chat-ext', 'aria-hidden': 'true', text: att.glyph || ext }),
              h.el('span', { class: 'k-chat-fn' }, [h.line(nm, { class: 'k-chat-fname' }), att.size != null ? h.line(typeof att.size === 'number' ? h.num(att.size) : att.size, { class: 'k-chat-fsize' }) : null])]));
          } else kids.push(h.el('div', { class: 'k-chat-img', role: 'img', 'aria-label': 'Image: ' + nm }, [M.cover(h, { title: nm, src: att.src, alt: '', key: att.key != null ? att.key : nm, glyph: att.glyph, ratio: '16/9' }), nm ? h.line(nm, { class: 'k-chat-cap' }) : null]));
        }
        if (m.text != null && m.text !== '') kids.push(h.el('div', { class: 'k-chat-tx' }, soft(m.text)));
        var node = h.el('div', { class: 'k-chat-m', 'data-id': id, 'data-status': status || null }, [h.el('div', { class: 'k-chat-bub' + (att ? ' k-chat-bub-att' : '') }, kids)]);
        var rx = (m.reactions || []).map(function (r) {
          var k = id + '|' + r.emoji, cur = st.rx[k] || { mine: !!r.mine, count: typeof r.count === 'number' ? r.count : null };
          if (!cur.mine && cur.count === 0) return null;
          var b = h.el('button', { class: 'k-chat-rx', type: 'button', 'aria-pressed': cur.mine ? 'true' : 'false', 'aria-label': str(r.emoji) + (cur.count != null ? ' ' + cur.count : '') + (cur.mine ? ', you reacted' : '') },
            [h.el('span', { 'aria-hidden': 'true', text: str(r.emoji) }), cur.count != null ? h.el('span', { class: 'k-chat-rxn k-b-nw', 'aria-hidden': 'true', text: M.count(cur.count) }) : null]);
          b.addEventListener('click', function () {
            st.rx[k] = { mine: !cur.mine, count: cur.count == null ? null : Math.max(0, cur.count + (cur.mine ? -1 : 1)) };
            draw(false);
            go('onReact', orig, r.emoji);
          });
          return b;
        }).filter(Boolean);
        if (rx.length) node.appendChild(h.el('div', { class: 'k-chat-rxs' }, rx));
        if (status) {
          var meta = h.el('div', { class: 'k-chat-meta k-chat-st-' + status }, [statusIcon(status), h.el('span', { class: 'k-chat-stw', text: WORD[status] })]);
          if (status === 'failed') {
            var rb = h.el('button', { class: 'k-chat-retry', type: 'button', text: 'Retry', 'aria-label': 'Retry sending this message' });
            rb.addEventListener('click', function () { st.over[id] = 'sending'; draw(false); go('onRetry', orig); });
            meta.appendChild(rb);
          }
          node.appendChild(meta);
        }
        return node;
      };

      var draw = function (stick) {
        var top = log.scrollTop, lastDay = null, grp = null, prevT = null, n = 0;
        list.textContent = '';
        c.messages.concat(st.local).forEach(function (m, i) {
          if (m.id == null) m = Object.assign({}, m, { id: 'm' + i });
          if ((m.text == null || m.text === '') && !(m.attachment && typeof m.attachment === 'object')) return;
          var t = stamp(m), day = t != null ? new Date(t).toDateString() : null, mine = str(m.from) === me;
          if (day && day !== lastDay) { lastDay = day; grp = null; list.appendChild(h.el('li', { class: 'k-chat-day' }, [h.el('span', { class: 'k-chat-dayl k-b-nw', text: dayLabel(t) })])); }
          var join = grp && grp.from === str(m.from) && (t == null || prevT == null || t - prevT <= GAP);
          if (!join) {
            var p = who(m.from), shown = t != null ? h.time(new Date(t)) : str(m.time);
            var head = h.el('div', { class: 'k-chat-gh' }, [mine ? null : h.line(nameOf(m.from), { class: 'k-chat-name' }), shown ? h.el('span', { class: 'k-chat-time k-b-nw', text: shown }) : null,
              !mine && p.status ? h.el('span', { class: 'k-chat-sr', text: ', ' + p.status }) : null]);
            var gb = h.el('div', { class: 'k-chat-gb' }, [head]);
            var li = h.el('li', { class: 'k-chat-g', 'data-mine': mine ? 'true' : null }, [mine ? null : M.avatar(h, { name: nameOf(m.from), src: p.src, key: p.id, size: 'md', status: p.status }), gb]);
            list.appendChild(li);
            grp = { from: str(m.from), gb: gb };
          }
          grp.gb.appendChild(msgEl(m, mine, m));
          prevT = t; n++;
        });
        if (typing.length) {
          var names = typing.map(nameOf), say = names.length === 1 ? names[0] + ' is typing' : names.length === 2 ? names[0] + ' and ' + names[1] + ' are typing' : 'Several people are typing';
          list.appendChild(h.el('li', { class: 'k-chat-typing' }, [M.avatar(h, { name: names[0], src: who(typing[0]).src, key: who(typing[0]).id, size: 'sm' }), h.el('span', { class: 'k-chat-dots', 'aria-hidden': 'true' }, [h.el('i'), h.el('i'), h.el('i')]), h.el('span', { class: 'k-chat-tl', text: say })]));
        } else if (!n) list.appendChild(h.el('li', { class: 'k-chat-none', text: c.emptyText != null ? c.emptyText : 'No messages yet' }));
        if (stick) log.scrollTop = log.scrollHeight; else log.scrollTop = top;
      };

      if (comp) {
        var ta = h.el('textarea', { class: 'k-chat-ta', rows: '1', placeholder: comp.placeholder != null ? str(comp.placeholder) : 'Write a message', 'aria-label': comp.placeholder != null ? str(comp.placeholder) : 'Message', disabled: comp.disabled ? true : null });
        var send = h.el('button', { class: 'k-b-btn k-b-btn-primary k-chat-send', type: 'submit', disabled: true }, [M.icon(h, 'send', { size: 18 }), h.el('span', { class: 'k-chat-sendl', text: comp.sendLabel != null ? str(comp.sendLabel) : 'Send' })]);
        var form = h.el('form', { class: 'k-chat-comp' }, [ta, send]);
        var sync = function () { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + ta.offsetHeight - ta.clientHeight) + 'px'; send.disabled = !!comp.disabled || !ta.value.trim(); };
        ta.addEventListener('input', function () { st.draft = ta.value; sync(); });
        ta.addEventListener('focus', function () { st.focus = true; });
        ta.addEventListener('blur', function () { if (ta.isConnected) st.focus = false; });
        ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var text = ta.value.trim();
          if (!text || comp.disabled) return;
          st.local.push({ id: 'local-' + (++st.n), from: me, text: text, time$ms: Date.now(), status: 'sent' });
          ta.value = ''; st.draft = '';
          draw(true); sync(); ta.focus();
          go('onSend', text);
        });
        root.appendChild(form);
        ta.value = st.draft || '';
      }
      el.appendChild(root);
      draw(true);
      if (comp) { sync(); if (st.focus) ta.focus({ preventScroll: true }); }
    }
  });
})();
