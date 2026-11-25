// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// Canonical seed (B1-T5b, docs: addon/kit/SEED-RULES.md). A workshop app ships `briefs/<app>.seed.json`: the records, constants and derived totals of its brief
// in machine-readable form. `ui-seed-import` embeds it into the page (src/data.seed.js -> window.CANON, window.canon), the data builder builds its dataset
// FROM it, and the quality gate (check `data`, id `seed-*`) compares the built page with the pristine copy `src/seed.json`.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_RE = /^[a-z][A-Za-z0-9]*$/;
const AGG = ['count', 'sum', 'avg', 'mean', 'min', 'max', 'distinct', 'list'];
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\ufeff/, ''));
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

/** Value of a totals entry: a plain number/string, or { value, of }. */
const totalValue = (t) => (isObj(t) && 'value' in t ? t.value : t);

/** Shape check of a seed object. Returns [message]. */
function validateSeed(seed) {
  const errs = [];
  if (!isObj(seed)) return ['the seed is not a JSON object'];
  if (seed.schema !== 1) errs.push('schema must be 1');
  if (typeof seed.app !== 'string' || !seed.app) errs.push('app must be a non-empty string');
  if (!isObj(seed.collections) || !Object.keys(seed.collections).length) errs.push('collections must be an object with at least one collection');
  for (const [name, rows] of Object.entries(seed.collections || {})) {
    if (!ID_RE.test(name)) errs.push(`collection "${name}": the name must be camelCase (it is the key of window.APP_DATA)`);
    if (!Array.isArray(rows) || !rows.length) { errs.push(`collection "${name}": must be a non-empty array`); continue; }
    rows.forEach((r, i) => { if (!isObj(r)) errs.push(`collection "${name}"[${i}]: row is not an object`); });
    const keys = rows.filter(isObj).map((r) => r[keyField(rows)]);
    if (new Set(keys).size !== keys.length) errs.push(`collection "${name}": the key field "${keyField(rows)}" is not unique`);
  }
  for (const k of ['constants', 'totals']) if (seed[k] !== undefined && !isObj(seed[k])) errs.push(`${k} must be an object`);
  for (const [name, t] of Object.entries(seed.totals || {})) {
    const v = totalValue(t);
    const prim = (x) => typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean';
    if (!(prim(v) || (Array.isArray(v) && v.every(prim)))) errs.push(`totals.${name}: must be a number, a string or a list of them (or { value, of, from })`);
  }
  (seed.agree || []).forEach((a, i) => {
    if (!isObj(a) || typeof a.id !== 'string') { errs.push(`agree[${i}]: needs an id`); return; }
    if (a.totals !== undefined && !(seed.totals && a.totals in seed.totals)) errs.push(`agree "${a.id}": totals "${a.totals}" is not in totals`);
    if (a.from !== undefined) {
      if (!isObj(a.from) || !(a.from.collection in (seed.collections || {}))) errs.push(`agree "${a.id}": from.collection "${a.from && a.from.collection}" is not a collection`);
      else if (!AGG.some((k) => k in a.from)) errs.push(`agree "${a.id}": from needs one of ${AGG.join(', ')}`);
    }
  });
  return errs;
}

/** Collections the seed marks as generator parameters (seedOnly: "collections.<name> (generator parameters)"): the page expands them, so rows are not compared. */
function generatorCollections(seed) {
  const out = new Set();
  for (const s of seed.seedOnly || []) { const m = /^collections\.(\w+)\b.*generator/i.exec(String(s)); if (m) out.add(m[1]); }
  return out;
}

/** Key field of a collection: "id" when present, else the first field of the first row. */
function keyField(rows) {
  const r = rows && rows[0];
  if (!isObj(r)) return 'id';
  return 'id' in r ? 'id' : Object.keys(r)[0];
}

/** Find the seed file: explicit path, else brief.json "seed" (relative to the project root), else briefs/<app>.seed.json when a single one exists. */
function findSeed(srcDir, explicit) {
  const src = path.resolve(srcDir);
  if (explicit) return fs.existsSync(explicit) ? path.resolve(explicit) : null;
  const roots = [];
  for (let d = src, n = 0; n < 8; d = path.dirname(d), n++) { roots.push(d); if (d === path.dirname(d)) break; }
  let rel = null;
  try { rel = readJson(path.join(src, 'brief.json')).seed || null; } catch (_) { /* no brief yet */ }
  if (rel) {
    for (const r of roots) { const f = path.join(r, rel); if (fs.existsSync(f)) return f; }
    return null;
  }
  return null;
}

/** The JavaScript that embeds the seed. Not frozen on purpose: the gate compares against the pristine copy, a mutation is a finding, not a crash. */
function renderSeedJs(seed, sha) {
  const json = JSON.stringify({ app: seed.app, now: seed.now || null, collections: seed.collections, constants: seed.constants || {}, totals: seed.totals || {}, agree: seed.agree || [] })
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `/* Canonical seed of "${seed.app}" (briefs/${seed.app}.seed.json, sha ${sha}). Generated by ui-seed-import: do not edit, do not retype.
   canon.rows(name, { dates: ['field', ...] })  copy of a canonical collection (fields in "dates" become Date objects when they hold an ISO date); add derived fields to the COPY.
   canon.constants(name), canon.total(name) (derived figure of the brief), canon.now (Date), canon.names (collection names). window.CANON is the raw seed. */
(function () {
  var SEED = ${json};
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  window.CANON = SEED;
  window.canon = {
    app: SEED.app,
    now: SEED.now ? new Date(SEED.now) : null,
    names: Object.keys(SEED.collections),
    rows: function (name, opts) {
      var rows = SEED.collections[name];
      if (!rows) throw new Error('canon: no collection "' + name + '" (have ' + Object.keys(SEED.collections).join(', ') + ')');
      var dates = (opts && opts.dates) || [];
      return rows.map(function (r) {
        var c = clone(r);
        dates.forEach(function (f) { if (typeof c[f] === 'string' && /^\\d{4}-\\d{2}-\\d{2}/.test(c[f])) c[f] = new Date(c[f]); });
        return c;
      });
    },
    constants: function (name) { if (!(name in SEED.constants)) throw new Error('canon: no constant "' + name + '"'); return clone(SEED.constants[name]); },
    total: function (name) {
      if (!(name in SEED.totals)) throw new Error('canon: no total "' + name + '"');
      var t = SEED.totals[name];
      return t && typeof t === 'object' && 'value' in t ? t.value : t;
    }
  };
})();
`;
}

/**
 * Embed the seed: writes <srcDir>/data.seed.js and the pristine copy <srcDir>/seed.json.
 * Returns { status: 'imported'|'none'|'invalid', file?, sha?, collections?, messages[] }.
 */
function importSeed(srcDir, { seedPath = null } = {}) {
  const file = findSeed(srcDir, seedPath);
  if (!file) return { status: 'none', messages: ['no seed: brief.json has no "seed" and no --seed was given; nothing to do'] };
  let seed;
  try { seed = readJson(file); } catch (e) { return { status: 'invalid', file, messages: [`${file} is not valid JSON: ${e.message}`] }; }
  const errs = validateSeed(seed);
  if (errs.length) return { status: 'invalid', file, messages: errs };
  const raw = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(srcDir, 'data.seed.js'), renderSeedJs(seed, sha));
  fs.writeFileSync(path.join(srcDir, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');
  return { status: 'imported', file, sha, collections: Object.fromEntries(Object.entries(seed.collections).map(([k, v]) => [k, v.length])), messages: [] };
}

// ---------------------------------------------------------------------------------------------------- comparison (used by the gate)

const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const show = (v) => { const s = JSON.stringify(v); return s === undefined ? 'undefined' : (s.length > 60 ? s.slice(0, 57) + '...' : s); };

/** Seed value vs page value: numbers exactly (1e-9), ISO dates by instant, objects/arrays by their seed keys only. */
function sameValue(seedV, pageV) {
  if (typeof seedV === 'number') return typeof pageV === 'number' && Math.abs(seedV - pageV) < 1e-9;
  if (typeof seedV === 'string') {
    if (typeof pageV !== 'string') return false;
    if (seedV === pageV) return true;
    if (ISO_RE.test(seedV) && ISO_RE.test(pageV)) {
      const a = Date.parse(seedV), b = Date.parse(pageV);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (a === b) return true;
      // a date-only side ("2027-07-30") names a DAY: equal to the other side when that side's OWN calendar date is that day (the date part as written: a Date of
      // 09:00 UTC serialises with a time and a Z; "2027-07-30T01:00+02:00" is the 30th for whoever wrote it, not the 29th UTC)
      const dayOnly = (x) => !/[T ]/.test(x);
      if (dayOnly(seedV) !== dayOnly(pageV)) return seedV.slice(0, 10) === pageV.slice(0, 10);
    }
    return false;
  }
  if (Array.isArray(seedV)) return Array.isArray(pageV) && pageV.length === seedV.length && seedV.every((x, i) => sameValue(x, pageV[i]));
  if (isObj(seedV)) return isObj(pageV) && Object.keys(seedV).every((k) => sameValue(seedV[k], pageV[k]));
  return seedV === pageV;
}

/** Evaluate an agree rule's `from` on page rows. Returns a number, a list (rule `list`) or null. `last: N` / `first: N` keep the last / first N rows before aggregating. */
function evalFrom(from, rows) {
  if (!Array.isArray(rows)) return null;
  if (from.last) rows = rows.slice(-from.last);
  if (from.first) rows = rows.slice(0, from.first);
  const hit = (r) => Object.entries(from.where || {}).every(([f, cond]) => {
    const v = r[f];
    if (isObj(cond)) {
      if ('in' in cond && !cond.in.some((x) => sameValue(x, v))) return false;
      if ('ne' in cond && sameValue(cond.ne, v)) return false;
      if ('gt' in cond && !(v > cond.gt)) return false;
      if ('gte' in cond && !(v >= cond.gte)) return false;
      if ('lt' in cond && !(v < cond.lt)) return false;
      if ('lte' in cond && !(v <= cond.lte)) return false;
      return true;
    }
    return sameValue(cond, v);
  });
  const sel = rows.filter(hit);
  if (from.count === true || (from.count !== undefined && from.count !== false)) return sel.length;
  const nums = (f) => sel.map((r) => r[f]).filter((x) => typeof x === 'number');
  if ('sum' in from) return nums(from.sum).reduce((a, b) => a + b, 0);
  if ('list' in from) return sel.map((r) => r[from.list]);
  if ('mean' in from) { const n = nums(from.mean); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null; }
  if ('avg' in from) { const n = nums(from.avg); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null; }
  if ('min' in from) { const n = nums(from.min); return n.length ? Math.min(...n) : null; }
  if ('max' in from) { const n = nums(from.max); return n.length ? Math.max(...n) : null; }
  if ('distinct' in from) return new Set(sel.map((r) => JSON.stringify(r[from.distinct]))).size;
  return null;
}

const roundTo = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const decimalsOf = (n) => { const s = String(n); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

/** Numbers that appear in a text, thousands separators and currency stripped ("£1,234.50" -> 1234.5). */
function numbersIn(text) {
  return (String(text).replace(/(\d)[,\u00a0\u202f ](?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

/**
 * Compare the page with the seed. state = { canon, data, kpis, dom } read by the gate (see seed-fns.mjs):
 *   canon: window.CANON as JSON | null; data: { <collection>: rows | undefined }; kpis: window.APP_DATA.kpis | undefined;
 *   dom: { "<agree id>": { route, selector, texts[] } } for the agree rules that carry a selector.
 * Returns findings [{ id: 'seed-...', key, message }] (each names the seed id and the fix).
 */
function compareSeed(seed, state) {
  const out = [];
  const add = (id, key, message) => out.push({ id, key: `${id}|${key}`, message });
  if (!state.canon) {
    add('seed-missing', 'canon', `The page has no window.CANON although the app ships a canonical seed (src/seed.json, ${Object.keys(seed.collections).length} collections). Fix: run \`.aidlc-ui/bin/ui-seed-import <ui>/src\`, then build every canonical collection in data.js with canon.rows('<name>') (read .aidlc-ui/kit/SEED-RULES.md).`);
    return out;
  }
  if (!sameValue(seed.collections, state.canon.collections) || !sameValue(seed.totals, state.canon.totals) || !sameValue(seed.constants || {}, state.canon.constants || {})) {
    add('seed-canon-changed', 'canon', 'window.CANON differs from src/seed.json: something edited or replaced it, or data.seed.js is stale. Fix: run `.aidlc-ui/bin/ui-seed-import <ui>/src` again and never write to window.CANON (copy with canon.rows()).');
  }
  const generated = generatorCollections(seed);
  for (const [name, seedRows] of Object.entries(seed.collections)) {
    if (generated.has(name)) {
      if (!state.data || !Array.isArray(state.data[name])) add('seed-collection', name, `Collection "${name}" (generator parameters of the seed) is missing from window.APP_DATA. Fix: expand canon.rows('${name}') into the series the screens need under the same name.`);
      continue;   // parameters, not records: the page may expand them
    }
    const kf = keyField(seedRows);
    const rows = state.data ? state.data[name] : undefined;
    if (!Array.isArray(rows)) {
      add('seed-collection', name, `Canonical collection "${name}" (${seedRows.length} rows) is missing from window.APP_DATA. Fix: APP_DATA.${name} = canon.rows('${name}').map(...) with the same name, no other collection name for these records.`);
      continue;
    }
    const byKey = new Map(rows.map((r) => [r && r[kf], r]));
    const missing = seedRows.map((r) => r[kf]).filter((k) => !byKey.has(k));
    const seedKeys = new Set(seedRows.map((r) => r[kf]));
    const extra = rows.map((r) => r && r[kf]).filter((k) => !seedKeys.has(k));
    if (missing.length || extra.length || rows.length !== seedRows.length) {
      add('seed-rows', name, `Collection "${name}" has ${rows.length} rows, the seed has ${seedRows.length}${missing.length ? `; missing ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` (+${missing.length - 6})` : ''}` : ''}${extra.length ? `; not in the seed: ${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ` (+${extra.length - 6})` : ''}` : ''}. Fix: build "${name}" only from canon.rows('${name}'); do not drop, add or regenerate canonical rows (put invented rows in another collection, e.g. ${name}Extra).`);
    }
    const bad = [];
    for (const sr of seedRows) {
      const pr = byKey.get(sr[kf]);
      if (!pr) continue;
      for (const [f, v] of Object.entries(sr)) {
        if (!sameValue(v, pr[f])) bad.push(`${sr[kf]}.${f}: seed ${show(v)}, page ${show(pr[f])}`);
      }
    }
    if (bad.length) add('seed-field', name, `${bad.length} canonical value${bad.length === 1 ? '' : 's'} of "${name}" differ from the seed: ${bad.slice(0, 5).join('; ')}${bad.length > 5 ? ` (+${bad.length - 5} more)` : ''}. Fix: take the value from canon.rows('${name}') and add derived fields next to it; never retype, round or "improve" a canonical field.`);
  }
  for (const [name, t] of Object.entries(seed.totals || {})) {
    const want = totalValue(t);
    const have = state.kpis ? state.kpis[name] : undefined;
    if (have !== undefined && !sameValue(want, have)) add('seed-total', name, `KPI "${name}" is ${show(have)} on the page, the seed total is ${show(want)}${isObj(t) && t.of ? ` (${t.of})` : ''}. Fix: APP_DATA.kpis.${name} = canon.total('${name}'), do not recompute it differently.`);
  }
  for (const a of seed.agree || []) {
    if (a.from && state.data) {
      const got = evalFrom(a.from, state.data[a.from.collection]);
      const want = a.totals !== undefined ? totalValue(seed.totals[a.totals]) : null;
      let bad = false;
      if (got !== null && want !== null && typeof want === 'number' && typeof got === 'number') bad = Math.abs(got - want) > 0.5 * 10 ** -decimalsOf(want) + 1e-9;
      else if (Array.isArray(got) && Array.isArray(want)) bad = JSON.stringify([...got].map(String).sort()) !== JSON.stringify([...want].map(String).sort());   // a list: same members; the order of a screen list is not data
      if (bad) {
        add('seed-agree', a.id, `Rule ${a.id} ("${a.description || a.id}"): computed from the page rows it is ${show(got)}, the seed says ${show(want)}. Fix: make the rows of "${a.from.collection}" equal the seed rows (see seed-rows / seed-field) and read the figure from canon.total('${a.totals}').`);
      }
    }
    const d = state.dom && state.dom[a.id];
    if (d && a.totals !== undefined) {
      const want = totalValue(seed.totals[a.totals]);
      const texts = d.texts || [];
      const ok = typeof want === 'number'
        ? texts.some((t) => numbersIn(t).some((n) => Math.abs(n - want) < 0.5 * 10 ** -decimalsOf(want) + 1e-9))
        : texts.some((t) => String(t).replace(/\s+/g, ' ').includes(String(want)));
      if (!texts.length) add('seed-agree', `${a.id}|dom`, `Rule ${a.id}: the element ${d.selector} was not found on ${d.route || 'any screen'}. Fix: show the figure "${a.totals}" (${show(want)}) in an element matching ${d.selector}, filled from canon.total('${a.totals}').`);
      else if (!ok) add('seed-agree', `${a.id}|dom`, `Rule ${a.id} ("${a.description || a.id}"): ${d.selector} on ${d.route || 'the page'} shows ${show(texts[0].replace(/\s+/g, ' ').trim().slice(0, 50))}, the seed says ${show(want)}. Fix: fill it from canon.total('${a.totals}') instead of typing or recomputing it.`);
    }
  }
  return out;
}

module.exports = { validateSeed, findSeed, importSeed, renderSeedJs, compareSeed, evalFrom, sameValue, keyField, totalValue, numbersIn };
