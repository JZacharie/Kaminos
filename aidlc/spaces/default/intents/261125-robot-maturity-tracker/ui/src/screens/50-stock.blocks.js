window.UI_BLOCKS = window.UI_BLOCKS || {};
(function () {
  var BUFFER = 'Tampon générateur';
  var state = { q: '', category: '', level: '' };
  var LEVEL = { critical: 'Sous le minimum', warning: 'Au minimum', ok: 'Suffisant' };
  var fr = function (n) { return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 }); };
  var qty = function (r, v) { return fr(v) + ' ' + (r.unit === 'pièces' && Math.abs(v) <= 1 ? 'pièce' : r.unit); };
  var rows = function () { return (window.APP_DATA && window.APP_DATA.stock) || []; };
  var below = function (r) { return r.quantity < r.minimum; };
  var levelOf = function (r) { return below(r) ? 'critical' : r.quantity === r.minimum ? 'warning' : 'ok'; };
  var gapText = function (r) { var g = Math.round((r.quantity - r.minimum) * 100) / 100; return (g > 0 ? '+' : g < 0 ? '\u2212' : '') + fr(Math.abs(g)); };
  var lowCount = function () { return rows().filter(below).length; };

  UI_BLOCKS['stock-filters'] = function () {
    var cats = [];
    rows().forEach(function (r) { if (cats.indexOf(r.category) < 0) cats.push(r.category); });
    return {
      groups: [
        { key: 'category', label: 'Catégorie', allLabel: 'Toutes', options: cats.map(function (c) { return { value: c }; }) },
        { key: 'level', label: 'Niveau', allLabel: 'Tous', options: Object.keys(LEVEL).map(function (k) { return { value: LEVEL[k] }; }) }
      ],
      search: { placeholder: 'Rechercher un article ou une référence' },
      onChange: function (v) { state.q = (v.q || '').toLowerCase(); state.category = v.category || ''; state.level = v.level || ''; draw('stock-table'); }
    };
  };

  UI_BLOCKS['stock-table'] = function () {
    var shown = rows().filter(function (r) {
      return (!state.category || r.category === state.category) && (!state.level || LEVEL[levelOf(r)] === state.level) &&
        (!state.q || (r.id + ' ' + r.name + ' ' + r.category).toLowerCase().indexOf(state.q) >= 0);
    }).map(function (r) {
      return { id: r.id, name: r.name, category: r.category, quantity: r.quantity, minimum: r.minimum, unit: r.unit,
        gap: Math.round((r.quantity - r.minimum) * 100) / 100, level: levelOf(r), _r: r };
    });
    return {
      headingLevel: 2, title: 'Inventaire', noun: 'articles', pageSize: 20, maxColumns: 6,
      sort: { key: 'gap', dir: 'asc' }, noMatchText: 'Aucun article ne correspond à ces filtres',
      emptyText: 'Aucun article en stock',
      columns: [
        { key: 'id', label: 'Réf.', type: 'id', priority: 1 },
        { key: 'name', label: 'Article', type: 'text', priority: 1 },
        { key: 'category', label: 'Catégorie', type: 'badge', priority: 3 },
        { key: 'quantity', label: 'Stock', type: 'num', priority: 2, format: function (r) { return qty(r, r.quantity); } },
        { key: 'minimum', label: 'Minimum', type: 'num', priority: 2, format: function (r) { return qty(r, r.minimum); } },
        { key: 'level', label: 'Niveau', type: 'status', priority: 1, format: function (r) { return LEVEL[r.level]; } }
      ],
      rows: shown
    };
  };

  UI_BLOCKS['stock-kpi'] = function () {
    var n = lowCount();
    return { items: [{ label: 'Sous le minimum', value: n, status: n ? 'crit' : 'ok', hint: 'articles sous le minimum' }] };
  };

  UI_BLOCKS['stock-alerts'] = function () {
    return {
      headingLevel: 2, title: 'Alertes sous le minimum', limit: 5, emptyText: 'Aucun article sous le minimum',
      items: rows().filter(below).map(function (r) {
        var severe = r.quantity <= r.minimum / 2;
        return { id: r.id, title: r.name, tone: severe ? 'crit' : 'warn', severity: severe ? 'Très bas' : 'Sous le minimum',
          meta: r.id + ' \u00b7 ' + r.category, body: 'Stock ' + qty(r, r.quantity) + ', minimum ' + qty(r, r.minimum) + '.' };
      })
    };
  };

  UI_BLOCKS['stock-buffer'] = function () {
    var items = rows().filter(function (r) { return r.category === BUFFER; }).map(function (r) {
      var low = below(r);
      return low
        ? { label: r.name, value: 'Seuil bas', status: 'Seuil bas', tone: 'crit', hint: qty(r, r.quantity) + ', minimum ' + qty(r, r.minimum) }
        : { label: r.name, value: qty(r, r.quantity), hint: 'Minimum ' + qty(r, r.minimum) };
    });
    return {
      headingLevel: 2, title: 'Stock tampon générateur', subtitle: 'Réserve pour fabriquer de nouvelles pièces ou de nouveaux robots',
      emptyText: 'Aucune ligne de tampon', columns: 2, sections: [{ items: items }]
    };
  };

  function draw(key) {
    var map = { 'stock-filters': 'a-stock-filters', 'stock-table': 'a-stock-table', 'stock-kpi': 'a-kpi-stock-low', 'stock-alerts': 'a-stock-alerts', 'stock-buffer': 'a-buffer-panel' };
    var el = document.getElementById(map[key]);
    if (el && el._kBlock) el._kBlock.update(UI_BLOCKS[key]());
  }

  function buffer() { return rows().filter(function (r) { return r.category === BUFFER; }); }

  function fillSelect() {
    var sel = document.getElementById('stock-withdraw-item');
    if (!sel) return;
    var keep = sel.value;
    sel.textContent = '';
    buffer().forEach(function (r) {
      var o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.name + ' (' + qty(r, r.quantity) + ')';
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
  }

  function context() {
    var p = document.querySelector('[data-stock-context]');
    if (p) p.textContent = rows().length + ' articles suivis \u00b7 ' + lowCount() + ' sous le minimum';
  }

  function showError(msg) {
    var err = document.getElementById('stock-withdraw-err'), input = document.getElementById('stock-withdraw-qty');
    err.textContent = msg || '';
    err.classList.toggle('k-hide', !msg);
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function withdraw() {
    var D = window.APP_DATA, sel = document.getElementById('stock-withdraw-item'), input = document.getElementById('stock-withdraw-qty');
    var row = buffer().filter(function (r) { return r.id === sel.value; })[0];
    var n = parseFloat(String(input.value).replace(',', '.'));
    if (!row) { showError('Choisissez un article du tampon.'); return; }
    if (!isFinite(n) || n <= 0) { showError('Saisissez une quantité supérieure à 0.'); return; }
    if (n > row.quantity) { showError('Le tampon ne contient que ' + qty(row, row.quantity) + ' de ' + row.name + '.'); return; }
    showError('');
    var wasLow = below(row);
    row.quantity = Math.round((row.quantity - n) * 100) / 100;
    row.belowMin = below(row);
    if (D.kpis) D.kpis.belowMin = lowCount();
    refresh();
    var flag = below(row) && !wasLow ? ' Seuil bas : sous le minimum de ' + qty(row, row.minimum) + '.' : '';
    if (window.kitToast) window.kitToast('Prélevé ' + qty(row, n) + ' de ' + row.name + '.' + flag, below(row) ? 'warn' : 'ok');
  }

  function refresh() {
    ['stock-table', 'stock-kpi', 'stock-alerts', 'stock-buffer'].forEach(draw);
    fillSelect();
    context();
  }

  function init() {
    fillSelect();
    context();
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#a-buffer-withdraw')) withdraw();
    });
    var form = document.getElementById('stock-withdraw-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); withdraw(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
