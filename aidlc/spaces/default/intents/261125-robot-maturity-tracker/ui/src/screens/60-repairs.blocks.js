window.UI_BLOCKS = window.UI_BLOCKS || {};

(function () {
  var state = { severity: '', status: '', q: '' };

  function label(D, id) {
    var r = (D.robots || []).filter(function (x) { return x.id === id; })[0];
    return r ? id + ' · ' + r.name : id;
  }

  function tableRows(D) {
    var needle = state.q.trim().toLowerCase();
    return D.repairs.filter(function (r) {
      if (state.severity && r.severity !== state.severity) return false;
      if (state.status && r.status !== state.status) return false;
      if (needle) {
        var hay = [r.id, r.robotId, r.subsystem, r.part, r.anomaly].join(' ').toLowerCase();
        if (hay.indexOf(needle) < 0) return false;
      }
      return true;
    }).map(function (r) {
      return Object.assign({}, r, { robotLabel: label(D, r.robotId), piece: r.subsystem + ' · ' + r.part });
    });
  }

  function countBy(D, field, value) {
    return D.repairs.filter(function (r) { return r[field] === value; }).length;
  }

  UI_BLOCKS['repairs-filters'] = function () {
    var D = window.APP_DATA;
    var opts = function (field, values) {
      return values.map(function (v) { return { value: v, count: countBy(D, field, v) }; });
    };
    return {
      groups: [
        { key: 'severity', label: 'Gravité', options: opts('severity', ['Critique', 'Majeure', 'Mineure']) },
        { key: 'status', label: 'Statut', options: opts('status', ['Ouverte', 'Correctif en cours', 'À valider', 'Clôturée']) }
      ],
      search: { placeholder: 'Rechercher une pièce ou une anomalie', label: 'Rechercher dans le journal' },
      onChange: function (v) {
        state.severity = v.severity || '';
        state.status = v.status || '';
        state.q = v.q || '';
        var el = document.getElementById('a-repairs-table');
        if (el && el._kBlock) el._kBlock.update({ rows: tableRows(D) });
      }
    };
  };

  UI_BLOCKS['repairs-table'] = function () {
    var D = window.APP_DATA;
    return {
      title: 'Journal de réparation',
      noun: 'réparations',
      emptyText: 'Aucune réparation enregistrée.',
      noMatchText: 'Aucune réparation ne correspond à ces filtres.',
      sort: { key: 'date', dir: 'desc' },
      pageSize: 12,
      maxColumns: 7,
      columns: [
        { key: 'id', label: 'Id', type: 'id', priority: 1 },
        { key: 'date', label: 'Date', type: 'date', priority: 2 },
        { key: 'robotLabel', label: 'Robot', type: 'text', priority: 2, sortKey: 'robotId' },
        { key: 'piece', label: 'Pièce', type: 'text', priority: 2 },
        { key: 'anomaly', label: 'Anomalie', type: 'text', priority: 2 },
        { key: 'severity', label: 'Gravité', type: 'status', priority: 2 },
        { key: 'status', label: 'Statut', type: 'status', priority: 2 }
      ],
      rows: tableRows(D)
    };
  };

  // "Déclarer une réparation": adds a row to the log
  function initDialog() {
    var form = document.getElementById('repairs-new-form');
    if (!form) return;
    var D = window.APP_DATA;
    var dlg = document.getElementById('repairs-dialog');
    var robotSel = document.getElementById('repairs-f-robot');
    (D.robots || []).forEach(function (r) {
      var o = document.createElement('option');
      o.value = r.id; o.textContent = r.id + ' · ' + r.name;
      robotSel.appendChild(o);
    });
    var field = function (id) { return document.getElementById('repairs-f-' + id); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      ['part', 'anomaly'].forEach(function (k) {
        var input = field(k), err = document.getElementById('repairs-f-' + k + '-err');
        var empty = !input.value.trim();
        err.textContent = empty ? 'Ce champ est obligatoire.' : '';
        input.setAttribute('aria-invalid', empty ? 'true' : 'false');
        if (empty) ok = false;
      });
      if (!ok) return;
      var max = D.repairs.reduce(function (m, r) { return Math.max(m, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0); }, 0);
      var id = 'RP-' + (max < 9 ? '0' : '') + (max + 1);
      D.repairs.push({
        id: id, date: new Date(), robotId: field('robot').value, subsystem: field('subsystem').value,
        part: field('part').value.trim(), anomaly: field('anomaly').value.trim(), fix: '',
        severity: field('severity').value, status: 'Ouverte'
      });
      var t = document.getElementById('a-repairs-table'), f = document.getElementById('a-repairs-filters');
      if (t && t._kBlock) t._kBlock.update({ rows: tableRows(D) });
      if (f && f._kBlock) f._kBlock.update(UI_BLOCKS['repairs-filters']());
      var open = D.repairs.filter(function (r) { return r.status !== 'Clôturée'; });
      var crit = open.filter(function (r) { return r.severity === 'Critique'; });
      var ctx = document.getElementById('repairs-context');
      if (ctx) ctx.textContent = open.length + ' ' + (open.length > 1 ? 'réparations non clôturées' : 'réparation non clôturée') + ' dont ' + crit.length + ' ' + (crit.length > 1 ? 'critiques' : 'critique');
      form.reset();
      dlg.close();
      if (window.kitToast) window.kitToast('Réparation ' + id + ' déclarée');
    });
  }
  initDialog();
})();
