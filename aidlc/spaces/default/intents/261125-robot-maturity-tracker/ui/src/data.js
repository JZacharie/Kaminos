(function () {
  TODAY = new Date(Date.UTC(2026, 11 - 1, 25, 9, 0, 0));

  function d(m, day) { return new Date(Date.UTC(2026, m - 1, day, 9, 0, 0)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function count(list, fn) { return list.filter(fn).length; }
  function sum(list, fn) { return list.reduce(function (s, x) { return s + fn(x); }, 0); }

  var PALIERS = ['P1 Prototype', 'P2 Fonctionnel', 'P3 Fiable', 'P4 Autonome'];
  var SUBSYSTEMS = { Chassis: 'Châssis', Mobility: 'Mobilité', Energy: 'Énergie', Sensors: 'Capteurs', Control: 'Contrôle' };

  // ---- prints (mock records of app-brief.md, in order)
  var printRaw = [
    ['IM-101', 'Fémur gauche v3', 'R-01', 'PETG', 'Haute', 142, 6.5, 'Validée'],
    ['IM-102', 'Fémur droit v3', 'R-01', 'PETG', 'Haute', 142, 6.5, 'Validée'],
    ['IM-103', 'Pied gauche v2', 'R-01', 'PLA+', 'Moyenne', 88, 4.0, 'Validée'],
    ['IM-104', 'Plaque dorsale v2', 'R-01', 'PLA+', 'Basse', 64, 3.0, 'Validée'],
    ['IM-105', 'Tibia avant v2', 'R-02', 'PETG', 'Haute', 55, 2.5, 'En impression'],
    ['IM-106', 'Crâne et optiques v1', 'R-02', 'ASA', 'Moyenne', 97, 4.5, 'À préparer'],
    ['IM-107', 'Tibia A v3', 'R-03', 'PETG', 'Haute', 76, 3.5, 'À réimprimer'],
    ['IM-108', 'Tibia B v3', 'R-03', 'PETG', 'Haute', 76, 3.5, 'À réimprimer'],
    ['IM-109', 'Tibia C v3', 'R-03', 'PETG', 'Haute', 76, 3.5, 'En impression'],
    ['IM-110', 'Bassin x6 v2', 'R-03', 'PA-CF', 'Haute', 210, 11.0, 'À préparer'],
    ['IM-111', 'Mâchoire v2', 'R-04', 'Résine tough', 'Moyenne', 24, 2.0, 'Validée'],
    ['IM-112', 'Épaule rotative v1', 'R-04', 'PETG', 'Basse', 180, 8.0, 'À préparer'],
    ['IM-113', 'Poignet v1', 'R-04', 'Résine tough', 'Haute', 31, 2.8, 'En impression'],
    ['IM-114', 'Cage thoracique v4', 'R-05', 'PLA+', 'Moyenne', 46, 2.0, 'Validée'],
    ['IM-115', 'Rotule de genou v2', 'R-05', 'TPU', 'Basse', 12, 1.0, 'À préparer'],
    ['IM-116', 'Colonne souple v2', 'R-05', 'TPU', 'Moyenne', 30, 2.2, 'À réimprimer'],
    ['IM-117', 'Cage thoracique v1', 'R-06', 'PETG', 'Haute', 420, 18.0, 'À préparer'],
    ['IM-118', 'Humérus v1', 'R-06', 'PA-CF', 'Haute', 260, 13.5, 'À préparer'],
    ['IM-119', 'Crâne v1', 'R-06', 'ASA', 'Moyenne', 310, 15.0, 'À préparer'],
    ['IM-120', 'Clip câbles v2', 'R-02', 'PLA+', 'Basse', 6, 0.4, 'Validée']
  ];
  var prints = printRaw.map(function (p) {
    return { id: p[0], part: p[1], robotId: p[2], material: p[3], priority: p[4], grams: p[5], hours: p[6], status: p[7] };
  });

  // ---- orders
  var orderRaw = [
    ['CMD-31', 'Servos 20 kg x12', 'IM-110', 'ElecDirect', 118.8, null, 'À commander'],
    ['CMD-32', 'Drivers TMC2209 x4', 'RP-07', 'ElecDirect', 27.6, d(11, 28), 'Commandée'],
    ['CMD-33', 'Vis M3x12 inox x200', 'IM-117', 'VisPro', 9.4, d(11, 27), 'Expédiée'],
    ['CMD-34', 'Capteurs ToF x3', 'IM-106', 'CapteurPlus', 24.3, d(11, 24), 'Reçue'],
    ['CMD-35', 'Bobine PA-CF 1 kg', 'IM-110 et IM-118', 'FilaMax', 64.9, null, 'À commander'],
    ['CMD-36', 'PETG noir 1 kg x2', 'IM-117 et IM-112', 'FilaMax', 39.8, d(11, 27), 'Commandée'],
    ['CMD-37', 'Batterie LiPo 3S x2', 'RP-05', 'PowerCell', 41.0, d(11, 30), 'Commandée'],
    ['CMD-38', 'Résine tough 1 L', 'IM-113', 'ResinLab', 46.5, d(11, 24), 'Reçue'],
    ['CMD-39', 'Roulements 608 x10', 'R-01 maintenance', 'VisPro', 12.0, null, 'À commander'],
    ['CMD-40', 'Moteurs NEMA17 x4', 'IM-118', 'MotionShop', 52.0, d(12, 3), 'Commandée'],
    ['CMD-29', 'Filament PLA+ 1 kg x2', 'R-01 maintenance', 'FilaMax', 31.8, d(11, 12), 'Reçue'],
    ['CMD-30', 'Connecteurs JST x50', 'RP-02', 'ElecDirect', 8.9, d(11, 9), 'Reçue'],
    ['CMD-41', 'Cage thoracique alu 4 mm (usinage CNC)', 'R-06 T-X', 'UsiPro', 86.0, d(11, 20), 'Reçue', 'Usinage CNC'],
    ['CMD-42', 'Capots contreplaqué 3 mm x6 (découpe laser)', 'R-02 T-1000', 'LaserCut', 34.5, d(11, 21), 'Reçue', 'Découpe laser']
  ];
  var orders = orderRaw.map(function (o) {
    return { id: o[0], component: o[1], linkedTo: o[2], supplier: o[3], totalEur: o[4], eta: o[5], status: o[6], kind: o[7] || 'Composant' };
  });

  // ---- stock (belowMin computed by rule)
  var stockRaw = [
    ['ST-01', 'Vis M3x12', 'Visserie', 140, 100, 'pièces'],
    ['ST-02', 'Vis M4x16', 'Visserie', 85, 100, 'pièces'],
    ['ST-03', 'Écrous M3', 'Visserie', 310, 150, 'pièces'],
    ['ST-04', 'Servos 20 kg', 'Moteurs', 4, 6, 'pièces'],
    ['ST-05', 'Moteur NEMA17', 'Moteurs', 2, 2, 'pièces'],
    ['ST-06', 'Driver TMC2209', 'Drivers', 1, 2, 'pièces'],
    ['ST-07', 'Capteur ToF', 'Capteurs', 3, 2, 'pièces'],
    ['ST-08', 'IMU MPU6050', 'Capteurs', 5, 2, 'pièces'],
    ['ST-09', 'PETG noir', 'Filaments', 2.4, 2, 'kg'],
    ['ST-10', 'PLA+', 'Filaments', 3.1, 2, 'kg'],
    ['ST-11', 'PA-CF', 'Filaments', 0.3, 1, 'kg'],
    ['ST-12', 'TPU', 'Filaments', 0.8, 0.5, 'kg'],
    ['ST-13', 'Résine tough', 'Résine', 1.2, 0.5, 'L'],
    ['ST-14', 'Buffer filament générique', 'Tampon générateur', 3.4, 3.0, 'kg'],
    ['ST-15', 'Buffer servos', 'Tampon générateur', 4, 4, 'pièces'],
    ['ST-16', 'Buffer visserie lot', 'Tampon générateur', 220, 200, 'pièces'],
    ['ST-17', 'Buffer drivers', 'Tampon générateur', 1, 2, 'pièces']
  ];
  var stock = stockRaw.map(function (s) {
    return { id: s[0], name: s[1], category: s[2], quantity: s[3], minimum: s[4], unit: s[5], belowMin: s[3] < s[4] };
  });

  // ---- repairs
  var repairRaw = [
    ['RP-01', d(11, 3), 'R-01', 'Mobilité', 'Fémur gauche v2', 'Casse de fatigue', 'v3 +2 mm', 'Majeure', 'Clôturée'],
    ['RP-02', d(11, 6), 'R-01', 'Châssis', 'Plaque dorsale v1', 'Clip cassé', 'v2', 'Mineure', 'Clôturée'],
    ['RP-03', d(11, 10), 'R-02', 'Mobilité', 'Tibia avant v1', 'Déformé par la chaleur moteur', 'v2 PETG', 'Majeure', 'À valider'],
    ['RP-04', d(11, 12), 'R-03', 'Mobilité', 'Tibia A v2', 'Rupture à la charnière', 'v3', 'Critique', 'Correctif en cours'],
    ['RP-05', d(11, 14), 'R-03', 'Énergie', 'Batterie LiPo', 'Gonflée', 'CMD-37', 'Critique', 'Correctif en cours'],
    ['RP-06', d(11, 17), 'R-03', 'Mobilité', 'Tibia B v2', 'Fissure entre couches', 'v3', 'Majeure', 'Ouverte'],
    ['RP-07', d(11, 18), 'R-04', 'Contrôle', 'Driver TMC2209', 'Grillé', 'CMD-32', 'Majeure', 'Correctif en cours'],
    ['RP-08', d(11, 19), 'R-04', 'Mobilité', 'Mâchoire v1', 'Glisse', 'v2 résine tough', 'Mineure', 'Clôturée'],
    ['RP-09', d(11, 21), 'R-05', 'Mobilité', 'Colonne souple v1', 'TPU trop souple', 'v2', 'Majeure', 'Ouverte'],
    ['RP-10', d(11, 23), 'R-02', 'Capteurs', 'Capteur ToF', 'Parasité par le soleil', 'CMD-34', 'Mineure', 'À valider'],
    ['RP-11', d(10, 29), 'R-01', 'Énergie', 'Connecteur batterie', 'Jeu au branchement', 'JST remplacé (CMD-30)', 'Mineure', 'Clôturée'],
    ['RP-12', d(10, 28), 'R-02', 'Contrôle', 'Carte contrôleur', 'Reset intempestif', 'Régulateur 5 V changé', 'Majeure', 'Clôturée']
  ];
  var repairs = repairRaw.map(function (r) {
    return { id: r[0], date: r[1], robotId: r[2], subsystem: r[3], part: r[4], anomaly: r[5], fix: r[6], severity: r[7], status: r[8] };
  });

  // ---- robots: score, palier and shown palier computed by the thresholds
  var robotRaw = [
    ['R-01', 'T-800', 'bipède', 82, 72, 78, 70, 76],
    ['R-02', 'T-1000', 'rover', 70, 66, 60, 58, 56],
    ['R-03', 'T-X', 'hexapode', 64, 48, 52, 40, 44],
    ['R-04', 'T-800', 'bras', 52, 40, 46, 30, 38],
    ['R-05', 'T-1000', 'suiveur', 40, 36, 28, 22, 20],
    ['R-06', 'T-X', 'rover lourd', 18, 10, 12, 5, 8]
  ];
  function palierIndex(score) { return score >= 75 ? 3 : score >= 50 ? 2 : score >= 25 ? 1 : 0; }
  var robots = robotRaw.map(function (r) {
    var score = Math.round((r[3] + r[4] + r[5] + r[6] + r[7]) / 5);
    var open = repairs.filter(function (x) { return x.robotId === r[0] && x.severity === 'Critique' && x.status !== 'Clôturée'; });
    var frozen = [];
    open.forEach(function (x) { if (frozen.indexOf(x.subsystem) < 0) frozen.push(x.subsystem); });
    var idx = palierIndex(score);
    return {
      id: r[0], name: r[1], type: r[2],
      scoreChassis: r[3], scoreMobility: r[4], scoreEnergy: r[5], scoreSensors: r[6], scoreControl: r[7],
      score: score,
      palier: PALIERS[idx],
      palierShown: PALIERS[open.length > 0 ? Math.max(0, idx - 1) : idx],
      frozen: frozen.length ? frozen.join(', ') : 'Aucun',
      criticalOpen: open.length
    };
  });

  // ---- robot units: several exemplaires of the same model; budget and weekly capacity are set per exemplaire
  // [exemplaires, budget per exemplaire (EUR), usable hours per week per exemplaire, planned hours per week]
  var unitRaw = {
    'R-01': [1, 520, 20, 14],
    'R-02': [2, 260, 20, 26],
    'R-03': [1, 640, 16, 12],
    'R-04': [1, 380, 18, 10],
    'R-05': [1, 150, 24, 20],
    'R-06': [1, 900, 12, 6]
  };
  robots.forEach(function (r) {
    var u = unitRaw[r.id];
    r.units = u[0];
    r.unitBudgetEur = u[1];
    r.hoursPerUnit = u[2];
    r.hoursPlanned = u[3];
  });

  // ---- part versions (14 rows)
  var partVersionRaw = [
    ['PV-01', 'Tibia A', 'R-03', 'v1', 'Défaut constaté', 'Casse à la charnière'],
    ['PV-02', 'Tibia A', 'R-03', 'v2', 'Défaut constaté', 'Rupture à la charnière (RP-04)'],
    ['PV-03', 'Tibia A', 'R-03', 'v3', 'En test', 'Charnière renforcée, en test (IM-107)'],
    ['PV-04', 'Fémur gauche', 'R-01', 'v1', 'Défaut constaté', 'Fissure près de la hanche'],
    ['PV-05', 'Fémur gauche', 'R-01', 'v2', 'Défaut constaté', 'Casse de fatigue (RP-01)'],
    ['PV-06', 'Fémur gauche', 'R-01', 'v3', 'Validée', 'Épaisseur +2 mm, validée (IM-101)'],
    ['PV-07', 'Tibia avant', 'R-02', 'v1', 'Défaut constaté', 'Déformé par la chaleur moteur (RP-03)'],
    ['PV-08', 'Tibia avant', 'R-02', 'v2', 'En impression', 'Passage en PETG (IM-105)'],
    ['PV-09', 'Colonne souple', 'R-05', 'v1', 'Défaut constaté', 'TPU trop souple (RP-09)'],
    ['PV-10', 'Colonne souple', 'R-05', 'v2', 'À réimprimer', 'Dureté revue, à réimprimer (IM-116)'],
    ['PV-11', 'Mâchoire', 'R-04', 'v1', 'Défaut constaté', 'Glisse sur la pièce (RP-08)'],
    ['PV-12', 'Mâchoire', 'R-04', 'v2', 'Validée', 'Résine tough, validée (IM-111)'],
    ['PV-13', 'Plaque dorsale', 'R-01', 'v1', 'Défaut constaté', 'Clip cassé (RP-02)'],
    ['PV-14', 'Plaque dorsale', 'R-01', 'v2', 'Validée', 'Clip renforcé, validé (IM-104)']
  ];
  var partVersions = partVersionRaw.map(function (p) {
    return { id: p[0], part: p[1], robotId: p[2], version: p[3], outcome: p[4], note: p[5] };
  });

  // ---- subassemblies: readiness derived from the prints, the linked orders and the repairs
  var subRaw = [
    ['SA-01', 'R-01', 'Jambes', ['IM-101', 'IM-102'], []],
    ['SA-02', 'R-01', 'Pieds et capot batterie', ['IM-103', 'IM-104'], []],
    ['SA-03', 'R-02', 'Genoux avant', ['IM-105', 'IM-120'], []],
    ['SA-04', 'R-02', 'Module optique', ['IM-106'], []],
    ['SA-05', 'R-03', 'Tibias', ['IM-107', 'IM-108', 'IM-109'], ['RP-04', 'RP-06']],
    ['SA-06', 'R-03', 'Bassin', ['IM-110'], []],
    ['SA-07', 'R-04', 'Poignet', ['IM-113'], []],
    ['SA-08', 'R-04', 'Mâchoire et carte de contrôle', ['IM-111'], ['CMD-32']]
  ];
  var subassemblies = subRaw.map(function (s) {
    var printIds = s[3];
    var linkedOrders = orders.filter(function (o) {
      return printIds.some(function (p) { return o.linkedTo.indexOf(p) >= 0; });
    });
    var extraOrders = s[4].filter(function (x) { return x.indexOf('CMD-') === 0; }).map(function (x) { return byId(orders, x); });
    var extraRepairs = s[4].filter(function (x) { return x.indexOf('RP-') === 0; }).map(function (x) { return byId(repairs, x); });
    var allOrders = linkedOrders.concat(extraOrders);
    var printsOk = printIds.every(function (p) { return byId(prints, p).status === 'Validée'; });
    var ordersOk = allOrders.every(function (o) { return o.status === 'Reçue'; });
    var repairBlocked = extraRepairs.some(function (r) { return r.status !== 'Clôturée'; });
    var readiness = repairBlocked ? 'Bloqué par réparation'
      : !printsOk ? 'Attente impressions'
      : !ordersOk ? 'Attente composants'
      : 'Prêt à assembler';
    var requires = printIds.concat(s[4]).join(', ');
    return { id: s[0], robotId: s[1], name: s[2], requires: requires, readiness: readiness };
  });

  // ---- prerequisites of the next palier: done derived from the linked record
  var prereqRaw = [
    ['PR-01', 'R-03', 'Clôturer la réparation RP-04', 'Réparation', 'RP-04'],
    ['PR-02', 'R-03', 'Clôturer la réparation RP-05', 'Réparation', 'RP-05'],
    ['PR-03', 'R-03', 'Valider l\'impression IM-107 (Tibia A v3)', 'Impression', 'IM-107'],
    ['PR-04', 'R-03', 'Valider l\'impression IM-108 (Tibia B v3)', 'Impression', 'IM-108'],
    ['PR-05', 'R-03', 'Recevoir la commande CMD-37 (batterie LiPo)', 'Commande', 'CMD-37'],
    ['PR-06', 'R-03', 'Atteindre 55 pts de score', 'Score', 'R-03'],
    ['PR-07', 'R-02', 'Valider l\'impression IM-106 (crâne et optiques)', 'Impression', 'IM-106'],
    ['PR-08', 'R-02', 'Atteindre 75 pts de score', 'Score', 'R-02'],
    ['PR-09', 'R-04', 'Recevoir la commande CMD-32 (drivers)', 'Commande', 'CMD-32'],
    ['PR-10', 'R-04', 'Clôturer la réparation RP-07', 'Réparation', 'RP-07'],
    ['PR-11', 'R-05', 'Valider l\'impression IM-116 (colonne souple v2)', 'Impression', 'IM-116'],
    ['PR-12', 'R-06', 'Valider l\'impression IM-117 (cage thoracique)', 'Impression', 'IM-117']
  ];
  var scoreTargets = { 'PR-06': 55, 'PR-08': 75 };
  var prerequisites = prereqRaw.map(function (p) {
    var done;
    if (p[3] === 'Impression') done = byId(prints, p[4]).status === 'Validée';
    else if (p[3] === 'Commande') done = byId(orders, p[4]).status === 'Reçue';
    else if (p[3] === 'Réparation') done = byId(repairs, p[4]).status === 'Clôturée';
    else done = byId(robots, p[4]).score >= scoreTargets[p[0]];
    return { id: p[0], robotId: p[1], label: p[2], kind: p[3], linkedId: p[4], done: done };
  });

  // ---- KPIs, all computed from the rows
  var notValidated = function (p) { return p.status !== 'Validée'; };
  var partGroups = {};
  partVersions.forEach(function (v) {
    var k = v.robotId + '|' + v.part;
    partGroups[k] = (partGroups[k] || 0) + (v.outcome === 'Défaut constaté' ? 1 : 0);
  });
  var kpis = {
    robotsCount: robots.length,
    meanScore: Math.round(sum(robots, function (r) { return r.score; }) / robots.length),
    criticalOpen: count(repairs, function (r) { return r.severity === 'Critique' && r.status !== 'Clôturée'; }),
    partsToPrint: count(prints, notValidated),
    gramsToPrint: sum(prints.filter(notValidated), function (p) { return p.grams; }),
    hoursToPrint: r1(sum(prints.filter(notValidated), function (p) { return p.hours; })),
    toOrderEur: r2(sum(orders.filter(function (o) { return o.status === 'À commander'; }), function (o) { return o.totalEur; })),
    belowMin: count(stock, function (s) { return s.belowMin; }),
    repairsNotClosed: count(repairs, function (r) { return r.status !== 'Clôturée'; }),
    recurringParts: Object.keys(partGroups).filter(function (k) { return partGroups[k] >= 2; }).length
  };

  var series = {
    printsByStatus: ['Validée', 'En impression', 'À préparer', 'À réimprimer'].map(function (s) {
      return { status: s, count: count(prints, function (p) { return p.status === s; }) };
    }),
    ordersByStatus: ['À commander', 'Commandée', 'Expédiée', 'Reçue'].map(function (s) {
      return { status: s, count: count(orders, function (o) { return o.status === s; }) };
    }),
    repairsBySeverity: ['Critique', 'Majeure', 'Mineure'].map(function (s) {
      return { severity: s, count: count(repairs, function (r) { return r.severity === s && r.status !== 'Clôturée'; }) };
    })
  };

  // ---- resources board: available (stock or machines), planned need, usage capacity and budget (budget and capacity are set on screen)
  // [id, name, kind, stock id, material of the prints still to do, fixed need, unit, usage capacity, budget EUR, linked orders]
  var resRaw = [
    ['RS-01', 'PETG', 'Matière', 'ST-09', 'PETG', null, 'kg', 2, 60, ['CMD-36']],
    ['RS-02', 'PLA+', 'Matière', 'ST-10', 'PLA+', null, 'kg', 2, 30, ['CMD-29']],
    ['RS-03', 'PA-CF', 'Matière', 'ST-11', 'PA-CF', null, 'kg', 0.5, 80, ['CMD-35']],
    ['RS-04', 'TPU', 'Matière', 'ST-12', 'TPU', null, 'kg', 0.5, 30, []],
    ['RS-05', 'Résine tough', 'Matière', 'ST-13', 'Résine tough', null, 'L', 0.5, 60, ['CMD-38']],
    ['RS-06', 'Servos 20 kg', 'Composant', 'ST-04', null, 6, 'pièces', 8, 140, ['CMD-31']],
    ['RS-07', 'Drivers TMC2209', 'Composant', 'ST-06', null, 2, 'pièces', 4, 40, ['CMD-32']],
    ['RS-08', 'Moteurs NEMA17', 'Composant', 'ST-05', null, 2, 'pièces', 4, 80, ['CMD-40']],
    ['RS-09', 'Capteurs ToF', 'Composant', 'ST-07', null, 2, 'pièces', 4, 40, ['CMD-34']],
    ['RS-10', 'Vis M3x12', 'Composant', 'ST-01', null, 120, 'pièces', 200, 20, ['CMD-33']]
  ];
  var resources = resRaw.map(function (x) {
    var st = byId(stock, x[3]);
    var need = x[4]
      ? r2(sum(prints.filter(function (p) { return notValidated(p) && p.material === x[4]; }), function (p) { return p.grams; }) / 1000)
      : x[5];
    return {
      id: x[0], name: x[1], kind: x[2], stockId: x[3],
      available: st.quantity, need: need, capacity: x[7], budgetEur: x[8],
      engagedEur: r2(sum(x[9], function (o) { return byId(orders, o).totalEur; })),
      availUnit: x[6], needUnit: x[6], capUnit: x[6]
    };
  });
  function machineHours(resin) {
    return r1(sum(prints.filter(function (p) { return notValidated(p) && (p.material === 'Résine tough') === resin; }), function (p) { return p.hours; }));
  }
  resources.push(
    { id: 'RS-11', name: 'Imprimantes FDM', kind: 'Machine', stockId: '', available: 3, need: machineHours(false), capacity: 120, budgetEur: null, engagedEur: null, availUnit: 'imprimantes', needUnit: 'h', capUnit: 'h par semaine' },
    { id: 'RS-12', name: 'Imprimante résine', kind: 'Machine', stockId: '', available: 1, need: machineHours(true), capacity: 40, budgetEur: null, engagedEur: null, availUnit: 'imprimante', needUnit: 'h', capUnit: 'h par semaine' }
  );

  // ---- plans of the three robots with a plan: each part is a print (printId); plan = rectangle on the top view
  // (x, y, w, h), model = primitives of the 3D view: ['box', cx, cy, cz, w, h, d] or ['cyl', cx, cy, cz, radius, length, axis]
  var robotPlans = [
    { robotId: 'R-06', view: 'Vue de dessus',
      ghosts: [[170, 52, 70, 34, 'Hanche'], [310, 52, 70, 34, 'Hanche'], [170, 234, 70, 34, 'Hanche'], [310, 234, 70, 34, 'Hanche']],
      parts: [
        { printId: 'IM-117', plan: [150, 96, 250, 128], model: [['box', 0, 0, 0, 6, 0.35, 4], ['cyl', -2.5, 0.35, -1.5, 0.35, 0.5, 'y'], ['cyl', 2.5, 0.35, -1.5, 0.35, 0.5, 'y'], ['cyl', -2.5, 0.35, 1.5, 0.35, 0.5, 'y'], ['cyl', 2.5, 0.35, 1.5, 0.35, 0.5, 'y']] },
        { printId: 'IM-118', plan: [420, 115, 120, 70], model: [['box', 0, 0, 0, 5, 0.7, 0.9], ['box', 2.6, 0, -0.7, 1.2, 0.7, 0.5], ['box', 2.6, 0, 0.7, 1.2, 0.7, 0.5], ['cyl', -2.4, 0, 0, 0.65, 1.1, 'z']] },
        { printId: 'IM-119', plan: [20, 100, 110, 100], model: [['box', 0, 0, 0, 3, 1.6, 2.4], ['cyl', 1.9, 0, 0, 0.7, 0.8, 'x'], ['box', -0.6, 0.85, 0, 1.2, 0.12, 1.4]] }
      ] },
    { robotId: 'R-05', view: 'Vue de dessus',
      ghosts: [[230, 56, 90, 34, 'Genou'], [230, 230, 90, 34, 'Genou']],
      parts: [
        { printId: 'IM-114', plan: [150, 96, 250, 128], model: [['box', 0, 0, 0, 5, 0.3, 3], ['box', 0, 0.45, -1.4, 5, 0.6, 0.2], ['box', 0, 0.45, 1.4, 5, 0.6, 0.2], ['box', 2.4, 0.45, 0, 0.2, 0.6, 2.6]] },
        { printId: 'IM-115', plan: [30, 115, 100, 70], model: [['cyl', 0, 0, 0, 1.4, 0.6, 'z'], ['cyl', 0, 0, 0.5, 0.5, 0.5, 'z']] },
        { printId: 'IM-116', plan: [420, 100, 120, 100], model: [['box', 0, -1, 0, 2.4, 0.2, 1.6], ['box', 0, 1, 0, 2.4, 0.2, 1.6], ['cyl', -0.7, 0, 0, 0.25, 1.8, 'y'], ['cyl', 0.7, 0, 0, 0.25, 1.8, 'y'], ['cyl', -0.7, -0.4, 0, 0.38, 0.15, 'y'], ['cyl', -0.7, 0.4, 0, 0.38, 0.15, 'y'], ['cyl', 0.7, -0.4, 0, 0.38, 0.15, 'y'], ['cyl', 0.7, 0.4, 0, 0.38, 0.15, 'y']] }
      ] },
    { robotId: 'R-04', view: 'Vue de dessus',
      ghosts: [[190, 215, 130, 34, 'Servo du coude']],
      parts: [
        { printId: 'IM-112', plan: [20, 90, 130, 140], model: [['cyl', 0, 0, 0, 2.2, 0.5, 'y'], ['cyl', 0, 0.6, 0, 1.3, 0.7, 'y'], ['box', 1.8, 0.4, 0, 0.5, 0.3, 0.7], ['box', -1.8, 0.4, 0, 0.5, 0.3, 0.7]] },
        { printId: 'IM-113', plan: [170, 125, 160, 70], model: [['cyl', -1, 0, 0, 0.7, 1.6, 'x'], ['box', 0.4, 0, 0, 1.4, 1.2, 1.2], ['cyl', 1.2, 0, 0, 0.45, 0.6, 'x']] },
        { printId: 'IM-111', plan: [350, 95, 190, 130], model: [['box', -1.2, 0, 0, 1, 1.6, 1.4], ['box', 0.4, 0.6, 0, 2.2, 0.4, 0.9], ['box', 0.4, -0.6, 0, 2.2, 0.4, 0.9], ['box', 1.3, 0.3, 0, 0.4, 0.3, 0.9], ['box', 1.3, -0.3, 0, 0.4, 0.3, 0.9]] }
      ] }
  ];

  window.APP_DATA = {
    robotPlans: robotPlans,
    robots: robots,
    resources: resources,
    prints: prints,
    orders: orders,
    stock: stock,
    repairs: repairs,
    partVersions: partVersions,
    subassemblies: subassemblies,
    prerequisites: prerequisites,
    kpis: kpis,
    series: series
  };
})();
(window.APP_RENDER || []).forEach(function (render, i) { try { render(window.APP_DATA); } catch (e) { console.error('screen render #' + (i + 1) + ' failed: ' + (e && e.message)); } });
