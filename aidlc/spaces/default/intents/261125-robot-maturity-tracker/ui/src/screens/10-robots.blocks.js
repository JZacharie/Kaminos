window.UI_BLOCKS = window.UI_BLOCKS || {};
UI_BLOCKS['robots-kpi-robots'] = function () {
  var D = window.APP_DATA;
  var capped = D.robots.filter(function (r) { return r.palierShown !== r.palier; }).length;
  return { items: [{ label: 'Robots', value: D.kpis.robotsCount, hint: capped ? capped + ' palier plafonné par une réparation critique' : 'Aucun palier plafonné' }] };
};
UI_BLOCKS['robots-kpi-mean'] = function () {
  var D = window.APP_DATA;
  return { items: [{ label: 'Score moyen', value: D.kpis.meanScore, unit: '/ 100', hint: 'moyenne des ' + D.robots.length + ' robots' }] };
};
UI_BLOCKS['robots-kpi-critical'] = function () {
  var D = window.APP_DATA;
  var hit = D.robots.filter(function (r) { return r.criticalOpen > 0; });
  return { items: [{ label: 'Réparations critiques ouvertes', value: D.kpis.criticalOpen, status: D.kpis.criticalOpen > 0 ? 'crit' : 'ok',
    hint: hit.length ? hit.map(function (r) { return r.id + ' : ' + r.frozen + ' figé' + (String(r.frozen).indexOf(',') >= 0 ? 's' : ''); }).join(' ; ') : 'Aucun sous-système figé' }] };
};
UI_BLOCKS['robots-kpi-toprint'] = function () {
  var D = window.APP_DATA;
  var reprint = D.prints.filter(function (p) { return p.status === 'À réimprimer'; }).length;
  return { items: [{ label: 'Pièces à imprimer', value: D.kpis.partsToPrint, hint: 'dont ' + reprint + ' à réimprimer' }] };
};
// ---- resources board: shared calculations (also used by the screen script)
window.BoardCalc = (function () {
  var fr = function (n, dp) { return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: dp == null ? 2 : dp }); };
  var AV = { crit: 'Insuffisant', warn: 'Juste', ok: 'Suffisant' };
  var BU = { crit: 'Dépassé', warn: 'À surveiller', ok: 'Dans le budget' };
  function resource(r) {
    var limit = r.kind === 'Machine' ? r.capacity : r.available;
    var avail = r.need > limit ? 'crit' : (r.need > 0.8 * limit || r.need > r.capacity) ? 'warn' : 'ok';
    var budget = r.budgetEur == null ? '' : r.engagedEur > r.budgetEur ? 'crit' : r.engagedEur >= 0.8 * r.budgetEur ? 'warn' : 'ok';
    return { avail: avail, budget: budget, usage: r.capacity > 0 ? Math.round(100 * r.need / r.capacity) : null };
  }
  function robot(r) {
    var paused = r.criticalOpen > 0 ? 1 : 0;
    var free = Math.max(0, r.units - paused);
    var cap = free * r.hoursPerUnit;
    var usage = cap > 0 ? Math.round(100 * r.hoursPlanned / cap) : null;
    return { paused: Math.min(paused, r.units), free: free, budgetTotal: r.units * r.unitBudgetEur, cap: cap, usage: usage,
      tone: usage == null || usage > 100 ? 'bad' : usage > 80 ? 'warn' : 'ok' };
  }
  return { fr: fr, AV: AV, BU: BU, resource: resource, robot: robot };
})();
UI_BLOCKS['robots-board-kpi'] = function () {
  var D = window.APP_DATA, B = window.BoardCalc;
  var units = 0, free = 0, paused = 0, budget = 0;
  D.robots.forEach(function (r) { var c = B.robot(r); units += r.units; free += c.free; paused += c.paused; budget += c.budgetTotal; });
  var calc = D.resources.map(B.resource);
  var short = calc.filter(function (c) { return c.avail === 'crit'; }).length;
  var tight = calc.filter(function (c) { return c.avail === 'warn'; }).length;
  var over = calc.filter(function (c) { return c.budget === 'crit'; }).length;
  return { columns: 4, items: [
    { label: 'Exemplaires de robots', value: units, hint: D.robots.length + ' modèles, plusieurs exemplaires possibles par modèle' },
    { label: 'Exemplaires disponibles', value: free, status: paused ? 'warn' : 'ok', hint: paused ? paused + ' en pause (réparation critique)' : 'Aucun exemplaire en pause' },
    { label: 'Budget des robots', value: B.fr(budget, 0), unit: '€', hint: 'budget par exemplaire × nombre d\'exemplaires' },
    { label: 'Ressources en tension', value: short + tight, status: short ? 'crit' : tight ? 'warn' : 'ok',
      hint: short + ' insuffisante' + (short > 1 ? 's' : '') + ', ' + tight + ' juste' + (tight > 1 ? 's' : '') + ', ' + over + ' budget' + (over > 1 ? 's' : '') + ' dépassé' + (over > 1 ? 's' : '') }
  ] };
};
UI_BLOCKS['robots-resources'] = function () {
  var D = window.APP_DATA, B = window.BoardCalc;
  var q = function (v, u) { return B.fr(v) + ' ' + (u === 'pièces' && Math.abs(v) <= 1 ? 'pièce' : u === 'imprimantes' && Math.abs(v) <= 1 ? 'imprimante' : u); };
  var eur = function (v) { return v == null ? '' : B.fr(v, 2) + ' €'; };
  var rows = D.resources.map(function (r) {
    var c = B.resource(r);
    return { id: r.id, name: r.name, kind: r.kind, available: r.available, need: r.need, capacity: r.capacity, usage: c.usage,
      budgetEur: r.budgetEur, engagedEur: r.engagedEur, availStatus: c.avail, availRank: { crit: 3, warn: 2, ok: 1 }[c.avail], budgetStatus: c.budget, _r: r };
  });
  return {
    headingLevel: 2, title: 'Ressources disponibles', noun: 'ressources', pageSize: 0, maxColumns: 8, idPrefix: 'rb-row-',
    subtitle: 'Disponible, besoin prévu, capacité d\'utilisation et budget de chaque matière, composant et machine',
    sort: { key: 'availStatus', dir: 'desc' }, emptyText: 'Aucune ressource suivie',
    columns: [
      { key: 'name', label: 'Ressource', type: 'text', priority: 1, minWidth: 140 },
      { key: 'kind', label: 'Type', type: 'badge', priority: 4 },
      { key: 'available', label: 'Disponible', type: 'num', priority: 2, format: function (r) { return q(r.available, r._r.availUnit); } },
      { key: 'need', label: 'Besoin prévu', type: 'num', priority: 2, format: function (r) { return q(r.need, r._r.needUnit); } },
      { key: 'capacity', label: 'Capacité d\'utilisation', type: 'num', priority: 3, format: function (r) { return q(r.capacity, r._r.capUnit); } },
      { key: 'usage', label: 'Utilisation', type: 'num', unit: '%', priority: 3 },
      { key: 'availStatus', label: 'Disponibilité', type: 'status', priority: 1, sortKey: 'availRank', format: function (r) { return B.AV[r.availStatus]; } },
      { key: 'budgetEur', label: 'Budget', type: 'num', priority: 2, format: function (r) { return eur(r.budgetEur); } },
      { key: 'engagedEur', label: 'Engagé', type: 'num', priority: 4, format: function (r) { return eur(r.engagedEur); } },
      { key: 'budgetStatus', label: 'État du budget', type: 'status', priority: 2, format: function (r) { return r.budgetStatus ? B.BU[r.budgetStatus] : ''; } }
    ],
    rows: rows
  };
};
UI_BLOCKS['robots-filters'] = function () {
  var D = window.APP_DATA;
  var PAL = ['P1 Prototype', 'P2 Fonctionnel', 'P3 Fiable', 'P4 Autonome'];
  return {
    groups: [{ key: 'palier', label: 'Palier affiché', allLabel: 'Tous',
      options: PAL.map(function (p) { return { value: p, count: D.robots.filter(function (r) { return r.palierShown === p; }).length }; }) }],
    onChange: function (v) { if (window.RobotCards) window.RobotCards.render(v.palier || ''); }
  };
};
