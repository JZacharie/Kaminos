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
UI_BLOCKS['robots-filters'] = function () {
  var D = window.APP_DATA;
  var PAL = ['P1 Prototype', 'P2 Fonctionnel', 'P3 Fiable', 'P4 Autonome'];
  return {
    groups: [{ key: 'palier', label: 'Palier affiché', allLabel: 'Tous',
      options: PAL.map(function (p) { return { value: p, count: D.robots.filter(function (r) { return r.palierShown === p; }).length }; }) }],
    onChange: function (v) { if (window.RobotCards) window.RobotCards.render(v.palier || ''); }
  };
};
