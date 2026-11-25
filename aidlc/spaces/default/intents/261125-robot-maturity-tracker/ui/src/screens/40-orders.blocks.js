window.UI_BLOCKS = window.UI_BLOCKS || {};

(function () {
  // Ordre des statuts : celui de l'énumération du contrat de données.
  var STATUS_ORDER = ['À commander', 'Commandée', 'Expédiée', 'Reçue'];
  var KINDS = ['Composant', 'Usinage CNC', 'Découpe laser'];
  var state = { status: '', kind: '', supplier: '', q: '' };

  var euro = function (n) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };
  var dayMonth = function (d) {
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  };
  var sumTotal = function (rows) {
    return rows.reduce(function (s, r) { return s + r.totalEur; }, 0);
  };
  var withRank = function (r) {
    return Object.assign({}, r, { statusRank: STATUS_ORDER.indexOf(r.status) });
  };

  UI_BLOCKS['orders-kpi-total'] = function () {
    var D = window.APP_DATA;
    var toOrder = D.orders.filter(function (r) { return r.status === 'À commander'; });
    return {
      headingLevel: 2,
      columns: 1,
      items: [{
        label: 'Montant à commander',
        value: euro(sumTotal(toOrder)),
        unit: '€',
        status: 'warn',
        hint: toOrder.length + ' lignes à commander'
      }]
    };
  };

  UI_BLOCKS['orders-kpi-flow'] = function () {
    var D = window.APP_DATA;
    var inFlight = D.orders.filter(function (r) { return r.status === 'Commandée' || r.status === 'Expédiée'; });
    var shipped = inFlight.filter(function (r) { return r.status === 'Expédiée'; }).length;
    return { headingLevel: 2, columns: 1, items: [{
      label: 'Commandes en route',
      value: inFlight.length,
      hint: shipped + ' expédiée, ' + euro(sumTotal(inFlight)) + ' € engagés'
    }] };
  };

  UI_BLOCKS['orders-kpi-next'] = function () {
    var D = window.APP_DATA;
    var dated = D.orders.filter(function (r) {
      return (r.status === 'Commandée' || r.status === 'Expédiée') && r.eta instanceof Date;
    }).sort(function (a, b) { return a.eta - b.eta; });
    if (!dated.length) return { headingLevel: 2, columns: 1, items: [] };
    return { headingLevel: 2, columns: 1, items: [{
      label: 'Prochaine arrivée',
      value: dayMonth(dated[0].eta),
      hint: dated[0].component
    }] };
  };

  UI_BLOCKS['orders-filters'] = function () {
    var D = window.APP_DATA;
    var suppliers = [];
    D.orders.forEach(function (r) { if (suppliers.indexOf(r.supplier) < 0) suppliers.push(r.supplier); });
    suppliers.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    return {
      groups: [
        {
          key: 'status', label: 'Statut', allLabel: 'Tous',
          options: STATUS_ORDER.map(function (s) {
            return { value: s, count: D.orders.filter(function (r) { return r.status === s; }).length };
          })
        },
        {
          key: 'kind', label: 'Type', allLabel: 'Tous',
          options: KINDS.map(function (s) {
            return { value: s, count: D.orders.filter(function (r) { return r.kind === s; }).length };
          })
        },
        {
          key: 'supplier', label: 'Fournisseur', allLabel: 'Tous', menu: true,
          options: suppliers.map(function (s) { return { value: s }; })
        }
      ],
      search: { placeholder: 'Rechercher une commande, un composant', label: 'Rechercher' },
      value: { status: state.status, kind: state.kind, supplier: state.supplier, q: state.q },
      onChange: function (v) {
        state.status = v.status || '';
        state.kind = v.kind || '';
        state.supplier = v.supplier || '';
        state.q = v.q || '';
        var el = document.getElementById('a-orders-table');
        if (el && el._kBlock) el._kBlock.update(UI_BLOCKS['orders-table']());
      }
    };
  };

  // Le bloc table ne rend un lien que dans la première colonne : la colonne
  // « Lié à » est transformée en liens vers Impressions ou Réparations après
  // chaque rendu du bloc (tri, filtre, page).
  var LINK_RE = /\b((?:IM|RP)-\d+)\b/g;
  var decorate = function (host) {
    [].forEach.call(host.querySelectorAll('tbody tr td:nth-child(3)'), function (td) {
      if (td.querySelector('a')) return;
      var txt = td.textContent;
      if (!/\b(?:IM|RP)-\d+\b/.test(txt)) return;
      var line = document.createElement('span');
      line.className = 'k-b-line';
      var last = 0, m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(txt))) {
        if (m.index > last) line.appendChild(document.createTextNode(txt.slice(last, m.index)));
        var a = document.createElement('a');
        var isPrint = m[1].indexOf('IM-') === 0;
        a.href = isPrint ? '#/prints' : '#/repairs';
        a.textContent = m[1];
        a.title = (isPrint ? 'Ouvrir les impressions : ' : 'Ouvrir les réparations : ') + m[1];
        line.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < txt.length) line.appendChild(document.createTextNode(txt.slice(last)));
      td.textContent = '';
      td.appendChild(line);
    });
  };
  var watched = false;
  var watch = function () {
    var host = document.getElementById('a-orders-table');
    if (watched || !host || typeof MutationObserver !== 'function') return;
    watched = true;
    var obs = new MutationObserver(function () {
      obs.disconnect();
      decorate(host);
      obs.observe(host, { childList: true, subtree: true });
    });
    obs.observe(host, { childList: true, subtree: true });
  };

  UI_BLOCKS['orders-table'] = function () {
    var D = window.APP_DATA;
    watch();
    var q = state.q.toLowerCase().trim();
    var rows = D.orders.filter(function (r) {
      if (state.status && r.status !== state.status) return false;
      if (state.kind && r.kind !== state.kind) return false;
      if (state.supplier && r.supplier !== state.supplier) return false;
      if (!q) return true;
      return [r.id, r.component, r.linkedTo, r.supplier, r.kind].join(' ').toLowerCase().indexOf(q) >= 0;
    }).map(withRank);
    var filtered = !!(state.status || state.kind || state.supplier || q);
    var emptyText = !filtered || state.status === 'À commander'
      ? 'Rien à commander'
      : 'Aucune commande ne correspond à ces filtres';
    return {
      headingLevel: 2,
      title: 'Commandes de composants et de pièces CNC ou laser',
      noun: 'commandes',
      emptyText: emptyText,
      pageSize: 12,
      maxColumns: 8,
      sort: { key: 'status', dir: 'asc' },
      columns: [
        { key: 'id', label: 'Id', type: 'id', priority: 1 },
        { key: 'component', label: 'Composant', type: 'text', priority: 2 },
        { key: 'linkedTo', label: 'Lié à', type: 'text', priority: 2, minWidth: 150 },
        { key: 'supplier', label: 'Fournisseur', type: 'text', priority: 3 },
        { key: 'totalEur', label: 'Total (€)', type: 'num', dp: 2, priority: 2 },
        {
          key: 'eta', label: 'Arrivée', type: 'text', priority: 3, minWidth: 80, sortKey: 'eta',
          format: function (r) { return r.eta instanceof Date ? dayMonth(r.eta) : ''; }
        },
        { key: 'kind', label: 'Type', type: 'text', priority: 3 },
        { key: 'status', label: 'Statut', type: 'badge', cat: true, priority: 2, sortKey: 'statusRank' }
      ],
      rows: rows
    };
  };
})();
