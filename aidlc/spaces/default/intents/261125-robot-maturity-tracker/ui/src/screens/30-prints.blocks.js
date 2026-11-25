window.UI_BLOCKS = window.UI_BLOCKS || {};
(function () {
  var STATUSES = ['À préparer', 'En impression', 'Validée', 'À réimprimer'];
  var PRIORITIES = ['Haute', 'Moyenne', 'Basse'];
  var RANK = { 'Haute': 0, 'Moyenne': 1, 'Basse': 2 };
  var fv = {};
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

  if (window.K && K.block && K.block.palette) {
    K.block.palette({ 'À préparer': 0, 'En impression': 1, 'Validée': 2, 'À réimprimer': 3, 'Haute': 4, 'Moyenne': 5, 'Basse': 6 });
  }

  function data() { return window.APP_DATA; }
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sel(v) { return Array.isArray(v) ? v.map(String) : (v == null || v === '' ? [] : [String(v)]); }
  function robotName(D, id) {
    var r = (D.robots || []).filter(function (x) { return x.id === id; })[0];
    return r ? r.id + ' ' + r.name : id;
  }
  function visible(D) {
    var s = sel(fv.status), r = sel(fv.robot), p = sel(fv.priority), q = String(fv.q || '').toLowerCase().trim();
    return D.prints.filter(function (x) {
      if (s.length && s.indexOf(x.status) < 0) return false;
      if (r.length && r.indexOf(x.robotId) < 0) return false;
      if (p.length && p.indexOf(x.priority) < 0) return false;
      return !q || (x.id + ' ' + x.part + ' ' + x.material).toLowerCase().indexOf(q) >= 0;
    });
  }
  function stats(D) {
    var rem = D.prints.filter(function (x) { return x.status !== 'Validée'; });
    var mats = {};
    rem.forEach(function (x) { mats[x.material] = 1; });
    return {
      parts: rem.length,
      grams: rem.reduce(function (s, x) { return s + x.grams; }, 0),
      hours: Math.round(rem.reduce(function (s, x) { return s + x.hours; }, 0) * 10) / 10,
      reprint: rem.filter(function (x) { return x.status === 'À réimprimer'; }).length,
      running: rem.filter(function (x) { return x.status === 'En impression'; }).length,
      materials: Object.keys(mats).length
    };
  }
  function count(D, key, value) { return D.prints.filter(function (x) { return String(x[key]) === String(value); }).length; }

  function refreshHeader() {
    var D = data(), p = byId('prints-context');
    if (!D || !p) return;
    var s = stats(D);
    p.textContent = 'Mercredi 25/11, 10:00 · ' + s.parts + ' pièces restent à imprimer';
  }
  function filterGroups(D) {
    return [
      { key: 'status', label: 'Statut', options: STATUSES.map(function (v) { return { value: v, count: count(D, 'status', v) }; }) },
      { key: 'robot', label: 'Robot', options: D.robots.map(function (r) { return { value: r.id, label: r.id + ' ' + r.name, count: count(D, 'robotId', r.id) }; }) },
      { key: 'priority', label: 'Priorité', options: PRIORITIES.map(function (v) { return { value: v, count: count(D, 'priority', v) }; }) }
    ];
  }

  // Dialog: change the status of one print
  function syncStatus() {
    var D = data(), pick = byId('prints-dlg-print'), st = byId('prints-dlg-status'), cur = byId('prints-dlg-current');
    if (!D || !pick || !st) return;
    var p = D.prints.filter(function (x) { return x.id === pick.value; })[0];
    if (!p) return;
    st.value = p.status;
    if (cur) cur.textContent = 'Statut actuel : ' + p.status;
  }
  function fillDialog() {
    var D = data(), pick = byId('prints-dlg-print');
    if (!D || !pick) return;
    var keep = pick.value;
    pick.innerHTML = D.prints.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.id + ' ' + p.part + ' (' + p.robotId + ')') + '</option>';
    }).join('');
    if (keep) pick.value = keep;
    else {
      var first = D.prints.filter(function (p) { return p.status !== 'Validée'; })[0];
      if (first) pick.value = first.id;
    }
    syncStatus();
  }
  function openFor(row) {
    var dlg = byId('dlg-prints-status'), pick = byId('prints-dlg-print');
    if (!dlg || !pick) return;
    fillDialog();
    pick.value = row.id;
    syncStatus();
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  }

  function refreshAll() {
    ['prints-table', 'prints-status-bars', 'prints-summary'].forEach(function (key) {
      var host = byId({ 'prints-table': 'a-prints-table', 'prints-status-bars': 'a-prints-status-bars', 'prints-summary': 'a-prints-summary' }[key]);
      if (host && host._kBlock) host._kBlock.update(window.UI_BLOCKS[key]());
    });
    var fb = byId('a-prints-filters');
    if (fb && fb._kBlock) fb._kBlock.update({ groups: filterGroups(data()) });
  }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'prints-dlg-print') syncStatus();
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.id !== 'prints-status-form') return;
    if (!e.submitter || e.submitter.value !== 'ok') return;
    var D = data(), pick = byId('prints-dlg-print'), st = byId('prints-dlg-status');
    var p = D.prints.filter(function (x) { return x.id === pick.value; })[0];
    if (!p) return;
    if (p.status === st.value) { if (window.kitToast) window.kitToast(p.id + ' est déjà ' + p.status, 'info'); return; }
    p.status = st.value;
    refreshAll();
    syncStatus();
    if (window.kitToast) window.kitToast(p.id + ' : statut changé en « ' + p.status + ' »', 'ok');
  });

  // ---- 3D conformity check: rotate the part, mark the broken zone, add a photo
  var BOXES = [
    { id: 'embase', label: 'Embase', b: [-2, 2, -1, -0.5, -1, 1] },
    { id: 'bras', label: 'Bras', b: [-2, -1.2, -0.5, 1.5, -0.6, 0.6] },
    { id: 'nervure', label: 'Nervure', b: [-1.2, 0.2, -0.5, 0.4, -0.15, 0.15] },
    { id: 'ergot', label: 'Ergot', b: [-2.3, -0.9, 1.5, 1.9, -0.8, 0.8] }
  ];
  var FACES = [
    { q: [1, 3, 7, 5], n: [1, 0, 0] }, { q: [0, 4, 6, 2], n: [-1, 0, 0] },
    { q: [2, 6, 7, 3], n: [0, 1, 0] }, { q: [0, 1, 5, 4], n: [0, -1, 0] },
    { q: [4, 5, 7, 6], n: [0, 0, 1] }, { q: [0, 2, 3, 1], n: [0, 0, -1] }
  ];
  var CAM = 10, SCALE = 85, CENTER = [-0.15, 0.2, 0];
  var view = { yaw: 35, pitch: 22 };
  var states = {};
  var drawn = [];
  var drag = null, pen = null;

  function st3d(id) { return states[id] || (states[id] = { zones: {}, strokes: [], img: null }); }
  function curId() { var s = byId('prints3d-print'); return s ? s.value : ''; }
  function cur3d() { return st3d(curId()); }
  function tok(name) {
    var host = byId('dlg-prints-3d'), s = document.createElement('span');
    s.style.color = 'var(--' + name + ')';
    host.appendChild(s);
    var c = getComputedStyle(s).color;
    host.removeChild(s);
    return c;
  }
  function zoneLabels(s) {
    return BOXES.filter(function (b) { return s.zones[b.id]; }).map(function (b) { return b.label; });
  }

  function draw3d() {
    var cv = byId('prints3d-view');
    if (!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height, s = cur3d();
    var ya = view.yaw * Math.PI / 180, pa = view.pitch * Math.PI / 180;
    var cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
    function rot(v) {
      var x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy;
      return [x, v[1] * cp - z * sp, v[1] * sp + z * cp];
    }
    var cAccent = tok('accent'), cBad = tok('bad'), cOnBad = tok('on-bad'), cLine = tok('text'), cBg = tok('surface-2');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, W, H);
    var list = [];
    BOXES.forEach(function (box) {
      var b = box.b, pts = [];
      for (var i = 0; i < 8; i++) {
        var v = rot([[b[0], b[1]][i & 1] - CENTER[0], [b[2], b[3]][(i >> 1) & 1] - CENTER[1], [b[4], b[5]][(i >> 2) & 1] - CENTER[2]]);
        var k = CAM / (CAM - v[2]);
        pts.push({ x: W / 2 + SCALE * v[0] * k, y: H / 2 - SCALE * v[1] * k, z: v[2] });
      }
      FACES.forEach(function (f) {
        var n = rot(f.n), c = { x: 0, y: 0, z: 0 };
        f.q.forEach(function (i) { c.x += pts[i].x; c.y += pts[i].y; c.z += pts[i].z; });
        c.z /= 4;
        // visible when the face looks toward the camera
        var cx3 = (f.n[0] ? (f.n[0] > 0 ? b[1] : b[0]) : (b[0] + b[1]) / 2) - CENTER[0];
        var cy3 = (f.n[1] ? (f.n[1] > 0 ? b[3] : b[2]) : (b[2] + b[3]) / 2) - CENTER[1];
        var cz3 = (f.n[2] ? (f.n[2] > 0 ? b[5] : b[4]) : (b[4] + b[5]) / 2) - CENTER[2];
        var rc = rot([cx3, cy3, cz3]);
        if (n[0] * (0 - rc[0]) + n[1] * (0 - rc[1]) + n[2] * (CAM - rc[2]) <= 0) return;
        list.push({ box: box, poly: f.q.map(function (i) { return pts[i]; }), n: n, depth: c.z });
      });
    });
    list.sort(function (a, b) { return a.depth - b.depth; });
    drawn = list;
    list.forEach(function (f) {
      var broken = !!s.zones[f.box.id];
      ctx.beginPath();
      f.poly.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.closePath();
      ctx.fillStyle = broken ? cBad : cAccent;
      ctx.fill();
      var light = Math.max(0, f.n[0] * -0.4 + f.n[1] * 0.8 + f.n[2] * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.5 * (1 - Math.min(1, light))).toFixed(2) + ')';
      ctx.fill();
      if (broken) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = cOnBad;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        for (var x = -H; x < W + H; x += 10) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
        ctx.restore();
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = cLine;
      ctx.lineWidth = broken ? 2.5 : 1.2;
      ctx.stroke();
    });
  }

  function inPoly(poly, x, y) {
    var ins = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ins = !ins;
    }
    return ins;
  }

  function drawShot() {
    var cv = byId('prints3d-shot');
    if (!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height, s = cur3d();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = tok('surface-2');
    ctx.fillRect(0, 0, W, H);
    if (s.img) {
      var r = Math.min(W / s.img.width, H / s.img.height), w = s.img.width * r, h = s.img.height * r;
      ctx.drawImage(s.img, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      ctx.fillStyle = tok('text-muted');
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune photo pour cette pièce', W / 2, H / 2);
    }
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = tok('warn');
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    s.strokes.forEach(function (st) {
      ctx.beginPath();
      st.forEach(function (p, i) { if (i) ctx.lineTo(p[0] * W, p[1] * H); else ctx.moveTo(p[0] * W, p[1] * H); });
      if (st.length === 1) ctx.lineTo(st[0][0] * W + 0.1, st[0][1] * H);
      ctx.stroke();
    });
    ctx.restore();
  }

  function summary3d() {
    var s = cur3d(), el = byId('prints3d-summary'), z = zoneLabels(s), parts = [];
    BOXES.forEach(function (b) { var c = byId('prints3d-zone-' + b.id); if (c) c.checked = !!s.zones[b.id]; });
    parts.push(z.length ? 'Zones surlignées : ' + z.join(', ') : 'Aucune zone surlignée');
    parts.push(s.img ? (s.strokes.length ? 'photo surlignée' : 'photo ajoutée') : 'pas de photo');
    if (el) el.textContent = parts.join(' · ') + '.';
  }
  function redraw3d() { draw3d(); drawShot(); summary3d(); }

  function fill3d() {
    var D = data(), pick = byId('prints3d-print');
    if (!D || !pick) return;
    var keep = pick.value;
    pick.innerHTML = D.prints.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.id + ' ' + p.part + ' (' + p.status + ')') + '</option>';
    }).join('');
    if (keep) pick.value = keep;
    else {
      var first = D.prints.filter(function (p) { return p.status === 'À réimprimer'; })[0] || D.prints[0];
      pick.value = first.id;
    }
  }
  function open3d() {
    var dlg = byId('dlg-prints-3d');
    if (!dlg) return;
    fill3d();
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    redraw3d();
  }
  function setView() {
    var y = byId('prints3d-yaw'), p = byId('prints3d-pitch');
    if (y) y.value = Math.round(view.yaw);
    if (p) p.value = Math.round(view.pitch);
  }
  function canvasPoint(cv, e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height, nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height };
  }
  function wrap(a) { return ((a + 180) % 360 + 360) % 360 - 180; }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    var dlg = byId('dlg-prints-3d');
    if (t.id === 'prints3d-open') open3d();
    else if (t.id === 'prints3d-close') { if (dlg && dlg.open) dlg.close(); }
    else if (t.id === 'prints3d-reset') { view.yaw = 35; view.pitch = 22; setView(); draw3d(); }
    else if (t.id === 'prints3d-clear') { cur3d().strokes = []; redraw3d(); }
    else if (t.id === 'prints3d-save') {
      var D = data(), s = cur3d(), p = D.prints.filter(function (x) { return x.id === curId(); })[0];
      if (!p) return;
      if (!zoneLabels(s).length && !s.strokes.length) {
        if (window.kitToast) window.kitToast('Surlignez une zone sur la pièce ou sur la photo avant d\'enregistrer', 'info');
        return;
      }
      p.status = 'À réimprimer';
      p.breakZones = zoneLabels(s);
      refreshAll();
      if (dlg && dlg.open) dlg.close();
      if (window.kitToast) window.kitToast(p.id + ' : casse signalée' + (p.breakZones.length ? ' (' + p.breakZones.join(', ') + ')' : '') + ', pièce à réimprimer', 'ok');
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'prints3d-yaw') { view.yaw = Number(t.value); draw3d(); }
    else if (t.id === 'prints3d-pitch') { view.pitch = Number(t.value); draw3d(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'prints3d-print') redraw3d();
    else if (t.id && t.id.indexOf('prints3d-zone-') === 0) { cur3d().zones[t.value] = t.checked; redraw3d(); }
    else if (t.id === 'prints3d-photo') {
      var f = t.files && t.files[0];
      if (!f || !/^image\//.test(f.type)) return;
      var rd = new FileReader(), s = cur3d();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () { s.img = img; s.strokes = []; redraw3d(); if (window.kitToast) window.kitToast('Photo ajoutée : surlignez la zone cassée', 'ok'); };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    }
  });
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'prints3d-view') {
      drag = { x: e.clientX, y: e.clientY, moved: false };
      if (t.setPointerCapture) t.setPointerCapture(e.pointerId);
    } else if (t.id === 'prints3d-shot') {
      var s = cur3d();
      if (!s.img) { if (window.kitToast) window.kitToast('Ajoutez d\'abord une photo', 'info'); return; }
      var p = canvasPoint(t, e);
      pen = [[p.nx, p.ny]];
      s.strokes.push(pen);
      if (t.setPointerCapture) t.setPointerCapture(e.pointerId);
      drawShot();
    }
  });
  document.addEventListener('pointermove', function (e) {
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      view.yaw = wrap(view.yaw + dx * 0.6);
      view.pitch = Math.max(-80, Math.min(80, view.pitch - dy * 0.6));
      drag.x = e.clientX; drag.y = e.clientY;
      setView();
      draw3d();
    } else if (pen) {
      var cv = byId('prints3d-shot');
      var p = canvasPoint(cv, e);
      pen.push([p.nx, p.ny]);
      drawShot();
    }
  });
  document.addEventListener('pointerup', function (e) {
    if (drag) {
      var d = drag, cv = byId('prints3d-view');
      drag = null;
      if (!d.moved && cv) {
        var p = canvasPoint(cv, e), hit = null;
        for (var i = drawn.length - 1; i >= 0; i--) {
          if (inPoly(drawn[i].poly, p.x, p.y)) { hit = drawn[i]; break; }
        }
        if (hit) { var z = cur3d().zones; z[hit.box.id] = !z[hit.box.id]; redraw3d(); }
      }
    }
    if (pen) { pen = null; summary3d(); }
  });

  window.UI_BLOCKS['prints-summary'] = function () {
    var D = data(), s = stats(D);
    refreshHeader();
    return {
      columns: 1, minWidth: 320,
      items: [
        { label: 'Pièces à imprimer', value: String(s.parts), unit: 'pièces', status: s.reprint ? 'warn' : 'ok', hint: 'dont ' + s.reprint + ' à réimprimer' },
        { label: 'Matière restante', value: nf.format(s.grams), unit: 'g', hint: s.materials + ' matières à prévoir' },
        { label: 'Temps d\'impression restant', value: nf.format(s.hours), unit: 'h', hint: s.running + ' pièces déjà en impression' }
      ]
    };
  };

  window.UI_BLOCKS['prints-status-bars'] = function () {
    var D = data();
    return {
      headingLevel: 2,
      title: 'Pièces par statut',
      orientation: 'h',
      unit: 'pièces',
      total: D.prints.length,
      totalLabel: 'Total de la file',
      items: STATUSES.map(function (s) { return { label: s, value: count(D, 'status', s), cat: s }; })
    };
  };

  window.UI_BLOCKS['prints-filters'] = function () {
    var D = data();
    return {
      groups: filterGroups(D),
      search: { placeholder: 'Chercher une pièce ou un identifiant' },
      value: {},
      onChange: function (v) { fv = v || {}; var t = byId('a-prints-table'); if (t && t._kBlock) t._kBlock.update(window.UI_BLOCKS['prints-table']()); }
    };
  };

  window.UI_BLOCKS['prints-table'] = function () {
    var D = data();
    fillDialog();
    refreshHeader();
    var rows = visible(D).map(function (p) {
      return {
        id: p.id, part: p.part, robot: robotName(D, p.robotId), material: p.material,
        priority: p.priority, priorityRank: RANK[p.priority], grams: p.grams,
        estimate: nf.format(p.grams) + ' g, ' + nf.format(p.hours) + ' h',
        status: p.status
      };
    });
    return {
      headingLevel: 2,
      title: 'File d\'impression',
      noun: 'impressions',
      rowKey: 'id',
      pageSize: 25,
      maxColumns: 7,
      sort: { key: 'priority', dir: 'asc' },
      columns: [
        { key: 'id', label: 'Id', type: 'id', priority: 1 },
        { key: 'part', label: 'Pièce', type: 'text', priority: 1 },
        { key: 'robot', label: 'Robot', type: 'text', priority: 1 },
        { key: 'material', label: 'Matière', type: 'badge', priority: 1 },
        { key: 'priority', label: 'Priorité', type: 'badge', cat: true, priority: 1, sortKey: 'priorityRank' },
        { key: 'estimate', label: 'Estimation (g, h)', type: 'num', priority: 1, sortKey: 'grams' },
        { key: 'status', label: 'Statut', type: 'badge', cat: true, priority: 1 }
      ],
      rows: rows,
      onRow: openFor,
      emptyText: 'Aucune impression dans la file',
      noMatchText: 'Aucune impression ne correspond à ces filtres'
    };
  };
})();
