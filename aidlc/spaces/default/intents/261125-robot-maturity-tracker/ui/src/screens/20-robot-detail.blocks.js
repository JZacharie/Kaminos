window.UI_BLOCKS = window.UI_BLOCKS || {};
(function () {
  var PALIERS = [
    { name: 'P1 Prototype', range: '0 à 24 points' },
    { name: 'P2 Fonctionnel', range: '25 à 49 points' },
    { name: 'P3 Fiable', range: '50 à 74 points' },
    { name: 'P4 Autonome', range: '75 à 100 points' }
  ];
  var ROUTES = { Impression: '#/prints', Commande: '#/orders', Réparation: '#/repairs' };
  var fr = function (n, dp) { return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); };

  function robotId() {
    var m = /#\/robot\/([^/?]+)/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : 'R-03';
  }
  function robot() {
    var id = robotId();
    return (window.APP_DATA.robots || []).filter(function (r) { return r.id === id; })[0];
  }
  function palierIndex(name) {
    for (var i = 0; i < PALIERS.length; i++) if (PALIERS[i].name === name) return i;
    return 0;
  }
  function criticalRepairs(id) {
    return (window.APP_DATA.repairs || []).filter(function (x) { return x.robotId === id && x.severity === 'Critique' && x.status !== 'Clôturée'; });
  }
  // status word of any print, order or repair by its id
  function lookup(id) {
    var D = window.APP_DATA, lists = [D.prints, D.orders, D.repairs];
    for (var i = 0; i < lists.length; i++) {
      var hit = (lists[i] || []).filter(function (x) { return x.id === id; })[0];
      if (hit) return hit;
    }
    return null;
  }
  function ids(text) { return String(text || '').match(/[A-Z]+-\d+/g) || []; }

  UI_BLOCKS['robot-detail-steps'] = function () {
    var r = robot();
    if (!r) return { steps: [], state: 'empty', emptyText: 'Robot introuvable' };
    var reached = palierIndex(r.palier), shown = palierIndex(r.palierShown);
    var crit = criticalRepairs(r.id).map(function (x) { return x.id; }).join(', ');
    return {
      title: 'Paliers de maturité',
      subtitle: 'Score ' + r.score + ' sur 100 : ' + r.palier + (shown < reached ? ', affiché ' + r.palierShown + ' tant que ' + crit + ' reste ouverte' : ''),
      headingLevel: 2,
      steps: PALIERS.map(function (p, i) {
        var st = { label: p.name, sub: p.range };
        if (i < shown) { st.status = 'done'; st.statusText = 'Atteint'; }
        else if (i === shown) { st.status = 'active'; st.statusText = shown < reached ? 'Palier affiché' : 'Palier actuel'; }
        else if (i <= reached) { st.status = 'blocked'; st.statusText = 'Plafonné'; st.meta = 'Score suffisant, bloqué par ' + crit; }
        else { st.status = 'waiting'; st.statusText = 'À atteindre'; }
        return st;
      })
    };
  };

  UI_BLOCKS['robot-detail-scores'] = function () {
    var r = robot();
    if (!r) return { items: [], state: 'empty', emptyText: 'Robot introuvable' };
    var frozen = String(r.frozen || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var subs = [['Châssis', r.scoreChassis], ['Mobilité', r.scoreMobility], ['Énergie', r.scoreEnergy], ['Capteurs', r.scoreSensors], ['Contrôle', r.scoreControl]];
    return {
      title: 'Scores par sous-système',
      subtitle: frozen.length ? 'Figé : ' + frozen.join(', ') + ' (réparation critique ouverte)' : 'Aucun sous-système figé',
      headingLevel: 2,
      unit: 'pts', max: 100, orientation: 'h',
      items: subs.map(function (s) {
        var f = frozen.indexOf(s[0]) >= 0;
        return f ? { label: s[0] + ' (figé)', value: s[1], status: 'crit' } : { label: s[0], value: s[1] };
      })
    };
  };

  UI_BLOCKS['robot-detail-prereqs'] = function () {
    var D = window.APP_DATA, r = robot();
    if (!r) return { sections: [], state: 'empty', emptyText: 'Robot introuvable' };
    var rows = (D.prerequisites || []).filter(function (p) { return p.robotId === r.id; });
    var done = rows.filter(function (p) { return p.done; }).length;
    var next = PALIERS[Math.min(PALIERS.length - 1, palierIndex(r.palierShown) + 1)].name;
    var order = ['Réparation', 'Impression', 'Commande', 'Score'];
    var plural = { Réparation: 'Réparations', Impression: 'Impressions', Commande: 'Commandes', Score: 'Score' };
    return {
      title: 'Pour passer en ' + next,
      subtitle: done + ' prérequis sur ' + rows.length + ' remplis',
      headingLevel: 2,
      sections: order.map(function (kind) {
        return {
          title: plural[kind],
          list: rows.filter(function (p) { return p.kind === kind; }).map(function (p) {
            var linked = p.linkedId ? lookup(p.linkedId) : null;
            var meta = p.done ? 'Terminé' : (p.linkedId ? p.linkedId + (linked ? ' · ' + linked.status : '') : 'À faire');
            return { text: p.label, meta: meta, tone: p.done ? 'ok' : (kind === 'Réparation' ? 'crit' : 'warn') };
          })
        };
      })
    };
  };

  UI_BLOCKS['robot-detail-subassemblies'] = function () {
    var D = window.APP_DATA, id = robotId();
    var rows = (D.subassemblies || []).filter(function (s) { return s.robotId === id; }).map(function (s) {
      var blockers = ids(s.requires).map(function (k) { return { id: k, o: lookup(k) }; }).filter(function (b) {
        return b.o && b.o.status !== 'Validée' && b.o.status !== 'Reçue';
      }).map(function (b) { return b.id + ' ' + b.o.status.toLowerCase(); });
      var hint = s.readiness === 'Prêt à assembler' ? 'Rien, tout est prêt' : (blockers.length ? blockers.join(', ') : 'Réparation critique ouverte');
      return { id: s.id, name: s.name, requires: s.requires, readiness: s.readiness, blocking: hint };
    });
    return {
      title: 'Sous-ensembles',
      subtitle: 'Prêt à assembler : impressions validées et composants reçus',
      headingLevel: 2, noun: 'sous-ensembles', pageSize: 0, idPrefix: 'rd-sa-', maxColumns: 7,
      emptyText: 'Aucun sous-ensemble défini pour ce robot',
      columns: [
        { key: 'id', label: 'Réf.', type: 'id', priority: 1 },
        { key: 'name', label: 'Sous-ensemble', type: 'text', priority: 1 },
        { key: 'readiness', label: 'Disponibilité', type: 'badge', priority: 2 },
        { key: 'blocking', label: 'Ce qui bloque', type: 'text', priority: 2, maxWidth: 320 },
        { key: 'requires', label: 'Éléments requis', type: 'text', priority: 3, maxWidth: 260 }
      ],
      rows: rows
    };
  };

  UI_BLOCKS['robot-detail-linked'] = function () {
    var D = window.APP_DATA, id = robotId();
    var prints = (D.prints || []).filter(function (p) { return p.robotId === id; });
    var repairs = (D.repairs || []).filter(function (p) { return p.robotId === id; });
    var mine = {};
    prints.concat(repairs).forEach(function (x) { mine[x.id] = 1; });
    mine[id] = 1;
    var orders = (D.orders || []).filter(function (o) { return ids(o.linkedTo).some(function (k) { return mine[k]; }); });
    var rows = []
      .concat(prints.map(function (p) { return { id: p.id, kind: 'Impression', label: p.part, detail: p.material + ' · ' + fr(p.grams) + ' g · ' + fr(p.hours, 1) + ' h', status: p.status }; }))
      .concat(orders.map(function (o) { return { id: o.id, kind: 'Commande', label: o.component, detail: o.supplier + ' · ' + fr(o.totalEur, 2) + ' €', status: o.status }; }))
      .concat(repairs.map(function (p) { return { id: p.id, kind: 'Réparation', label: p.part + ' : ' + String(p.anomaly).toLowerCase(), detail: p.subsystem + ' · ' + p.severity, status: p.status }; }));
    return {
      title: 'Impressions, commandes et réparations liées',
      headingLevel: 2, noun: 'éléments liés', pageSize: 0, idPrefix: 'rd-li-', maxColumns: 7,
      emptyText: 'Rien de lié à ce robot',
      columns: [
        { key: 'id', label: 'Réf.', type: 'id', priority: 1 },
        { key: 'kind', label: 'Type', type: 'badge', priority: 2 },
        { key: 'label', label: 'Élément', type: 'text', priority: 1, maxWidth: 300 },
        { key: 'detail', label: 'Détail', type: 'text', priority: 3, maxWidth: 240 },
        { key: 'status', label: 'État', type: 'badge', priority: 2 }
      ],
      filters: { groups: [{ key: 'kind', field: 'kind', label: 'Type' }] },
      rows: rows,
      rowHref: function (row) { return ROUTES[row.kind]; }
    };
  };

  addEventListener('kit:route', function () {
    [['a-palier-steps', 'robot-detail-steps'], ['a-subsystem-scores', 'robot-detail-scores'], ['a-prerequisites', 'robot-detail-prereqs'],
     ['a-subassemblies', 'robot-detail-subassemblies'], ['a-linked-items', 'robot-detail-linked']].forEach(function (p) {
      var el = document.getElementById(p[0]);
      if (el && el._kBlock) el._kBlock.update(UI_BLOCKS[p[1]]());
    });
  });
})();
