// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// Library of addon/bin/ui-brief: validates <record>/ui/src/brief.json (schema addon/templates/ui-brief.schema.json plus
// cross-field rules), checks it against the sources written by the builders, and derives the three outputs that depend on
// it: ui/src/effects.json, ui/ui-map.json and the questions of intent-capture-questions.md. No dependencies beyond Node
// core; ajv (from ../node_modules) is used for the schema when available, else a small built-in validator.
// Everything is deterministic: the same inputs give byte-identical outputs (no timestamps, no random ids).

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { scanHtml } = require('./html-scan');
const { visibleEffectsProblems } = require('./effects-rule');

const ADDON_ROOT = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(ADDON_ROOT, 'templates', 'ui-brief.schema.json');
const QUICK_TEMPLATE_PATH = path.join(ADDON_ROOT, 'templates', 'quick-questions.md');
const QUICK_STEM = 'intent-capture-questions';
const DEFAULT_QUESTIONS_REL = 'ideation/intent-capture/intent-capture-questions.md';
const LETTERS = ['A', 'B', 'C', 'D'];
const OTHER_OPTION = 'X. Other (please specify)';
const DEFAULT_ROLE = 'Product owner';
const OP_SPEC = {
  text: { req: ['target', 'value'], opt: ['selector'] },
  hide: { req: ['target'], opt: [] },
  show: { req: ['target'], opt: [] },
  class: { req: ['target'], opt: ['selector', 'add', 'remove'] },
  badge: { req: ['target', 'text'], opt: [] },
};
// Catalog module ids (modules/<id>/module.json). App anchors must not start with "a-<module>-" (ANCHORS.md section 1).
const FALLBACK_MODULE_IDS = ['table', 'chatbot', 'login'];
// brief.json is read by four agents at once: target 14 KB, advisory warning above 16 KB.
const BRIEF_JSON_WARN_BYTES = 16384;
const DATA_EVAL_TIMEOUT_MS = 5000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const readText = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
const exists = (p) => fs.existsSync(p);

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function catalogModuleIds() {
  const dir = path.join(ADDON_ROOT, '..', 'modules');
  try {
    const ids = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && exists(path.join(dir, e.name, 'module.json')))
      .map((e) => e.name).sort();
    if (ids.length) return ids;
  } catch (_) { /* installed copy: no modules/ next to the add-on */ }
  return FALLBACK_MODULE_IDS;
}

/* ------------------------------------------------------------------------------------------------ schema validation */

function jsonType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}
const typeOk = (t, v) => (t === 'number' ? typeof v === 'number' : jsonType(v) === t);
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Small JSON Schema validator for the keywords used by ui-brief.schema.json. Returns [{ path, message }]. */
function miniValidate(schema, data) {
  const refTarget = (ref) => ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], schema);
  function check(s, v, p, out) {
    if (s.$ref) check(refTarget(s.$ref), v, p, out);
    const at = p === '' ? '/' : p;
    const fail = (message) => out.push({ path: at, message });
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t) => typeOk(t, v))) { fail(`must be ${types.join(' or ')}`); return; }
    }
    if (s.const !== undefined && !deepEqual(s.const, v)) fail(`must be equal to constant ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.some((e) => deepEqual(e, v))) fail('must be equal to one of the allowed values');
    if (typeof v === 'string') {
      const len = [...v].length;
      if (s.minLength !== undefined && len < s.minLength) fail(`must NOT have fewer than ${s.minLength} characters`);
      if (s.maxLength !== undefined && len > s.maxLength) fail(`must NOT have more than ${s.maxLength} characters`);
      if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(v)) fail(`must match pattern "${s.pattern}"`);
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) fail(`must be >= ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) fail(`must be <= ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) fail(`must NOT have fewer than ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) fail(`must NOT have more than ${s.maxItems} items`);
      if (s.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) fail('must NOT have duplicate items');
      if (s.items) v.forEach((x, i) => check(s.items, x, `${p}/${i}`, out));
    }
    if (isObj(v)) {
      for (const k of s.required || []) if (!(k in v)) fail(`missing property "${k}"`);
      const props = s.properties || {};
      for (const k of Object.keys(v)) {
        if (k in props) check(props[k], v[k], `${p}/${k}`, out);
        else if (s.additionalProperties === false) fail(`unexpected property "${k}"`);
        else if (isObj(s.additionalProperties)) check(s.additionalProperties, v[k], `${p}/${k}`, out);
      }
    }
    if (s.oneOf) {
      const valid = s.oneOf.filter((b) => { const tmp = []; check(b, v, p, tmp); return tmp.length === 0; }).length;
      if (valid !== 1) fail('must match exactly one schema in oneOf');
    }
    if (s.anyOf && !s.anyOf.some((b) => { const tmp = []; check(b, v, p, tmp); return tmp.length === 0; })) fail('must match a schema in anyOf');
  }
  const out = [];
  check(schema, data, '', out);
  return out;
}

let validatorCache = null;
/** { engine: 'ajv'|'mini', validate(data) -> [{ path, message }] }. UI_BRIEF_NO_AJV=1 forces the built-in validator. */
function schemaValidator() {
  if (validatorCache && validatorCache.noAjv === (process.env.UI_BRIEF_NO_AJV === '1')) return validatorCache.v;
  const schema = JSON.parse(readText(SCHEMA_PATH));
  const noAjv = process.env.UI_BRIEF_NO_AJV === '1';
  let Ajv = null;
  if (!noAjv) {
    try { Ajv = require(require.resolve('ajv/dist/2020', { paths: [ADDON_ROOT] })); } catch (_) { Ajv = null; }
  }
  let v;
  if (Ajv) {
    const compiled = new Ajv({ allErrors: true, strict: true }).compile(schema);
    v = {
      engine: 'ajv',
      validate(data) {
        if (compiled(data)) return [];
        const errs = compiled.errors;
        const oneOfAt = new Set(errs.filter((e) => e.keyword === 'oneOf').map((e) => e.instancePath));
        return errs
          .filter((e) => !(e.keyword !== 'oneOf' && oneOfAt.has(e.instancePath) && e.schemaPath.includes('/oneOf/')))
          .map((e) => ({
            path: e.instancePath || '/',
            message: e.keyword === 'additionalProperties' ? `unexpected property "${e.params.additionalProperty}"`
              : e.keyword === 'required' ? `missing property "${e.params.missingProperty}"` : e.message,
          }));
      },
    };
  } else {
    v = { engine: 'mini', validate: (data) => miniValidate(schema, data) };
  }
  validatorCache = { noAjv, v };
  return v;
}

/* ------------------------------------------------------------------------------------------------ cross-field rules */

const short = (s, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

/** All anchors of a brief with their owning screen id ('shell' for shell.anchors). */
function anchorsOf(brief) {
  const out = [];
  for (const a of brief.shell.anchors) out.push({ ...a, owner: 'shell' });
  for (const s of brief.screens) for (const a of s.anchors) out.push({ ...a, owner: s.id });
  return out;
}

/** Problems of one op beyond the schema (ANCHORS.md section 2b); returns messages. */
function opProblems(op) {
  const spec = OP_SPEC[op.op];
  const out = [];
  for (const k of spec.req) if (typeof op[k] !== 'string' || op[k] === '') out.push(`op "${op.op}" needs "${k}"`);
  for (const k of Object.keys(op)) if (k !== 'op' && !spec.req.includes(k) && !spec.opt.includes(k)) out.push(`op "${op.op}" has unknown field "${k}"`);
  if (op.op === 'class' && op.add === undefined && op.remove === undefined) out.push('op "class" needs "add" or "remove"');
  if (op.selector !== undefined) {
    const sel = op.selector;
    if (/:root|:scope/i.test(sel)) out.push(`selector "${sel}" contains :root or :scope`);
    else if (/(?:^|[\s>+~,(])(?:html|body)(?![\w-])/i.test(sel)) out.push(`selector "${sel}" selects html or body`);
    else if (sel.includes('<')) out.push(`selector "${sel}" contains "<"`);
    else if (/(?:^|,)\s*[>+~]/.test(sel)) out.push(`selector "${sel}" starts with a combinator`);
  }
  return out;
}

/** Items that become questions of the questions file, in file order: round-1 questions, then assumptions. */
function questionItems(brief) {
  const items = [];
  brief.questions.forEach((q, i) => items.push({ kind: 'question', ordinal: i, label: `question ${i + 1}`, role: q.role || DEFAULT_ROLE, anchor: q.anchor, text: q.text, why: q.whyWeAsk, options: q.options, effects: q.effects || null }));
  brief.assumptions.forEach((a, i) => items.push({
    kind: 'assumption', ordinal: i, label: `assumption "${a.id}"`, role: a.role || DEFAULT_ROLE, anchor: a.anchor, text: a.question,
    why: a.whyWeAsk || `Version 1 was built on option ${a.assumed}. Change the answer if that decision is wrong.`,
    options: a.options, assumed: a.assumed, id: a.id, assumptionText: a.text, effects: a.effects || null,
  }));
  return items;
}

/** Cross-field rules. Returns { errors: [{ code, message }], warnings: [{ code, message }] }. Needs a schema-valid brief. */
function crossCheck(brief) {
  const errors = [];
  const warnings = [];
  const err = (code, message) => errors.push({ code, message });
  const warn = (code, message) => warnings.push({ code, message });

  const screenIds = new Set();
  const routes = new Map();
  for (const s of brief.screens) {
    if (s.id === 'shell') err('RESERVED-ID', 'screen id "shell" is reserved for the top bar and navigation (use shell.anchors)');
    if (screenIds.has(s.id)) err('DUP-ID', `screen id "${s.id}" is used by more than one screen`);
    screenIds.add(s.id);
    if (routes.has(s.route)) err('DUP-ROUTE', `route "${s.route}" is used by screens "${routes.get(s.route)}" and "${s.id}"`);
    else routes.set(s.route, s.id);
  }

  const moduleIds = catalogModuleIds();
  const anchors = anchorsOf(brief);
  const anchorOwner = new Map();
  for (const a of anchors) {
    if (a.screen !== a.owner) err('ANCHOR-SCREEN', `anchor "${a.id}" is listed under "${a.owner}" but has screen "${a.screen}"`);
    if (anchorOwner.has(a.id)) err('DUP-ID', `anchor id "${a.id}" is used more than once (screens "${anchorOwner.get(a.id)}" and "${a.owner}")`);
    else anchorOwner.set(a.id, a.owner);
    const mod = moduleIds.find((m) => a.id.startsWith(`a-${m}-`));
    if (mod) err('MODULE-PREFIX', `anchor "${a.id}" starts with the catalog module id "${mod}"; only a mounted catalog module creates such ids (ANCHORS.md section 1)`);
  }
  if (anchors.length < 12 || anchors.length > 20) warn('ANCHOR-COUNT', `the brief has ${anchors.length} anchors; 12-20 is the target for a 4-5 screen app`);
  if (!brief.dataEntities.some((e) => e.rows >= 24)) warn('DATA-SIZE', 'no data entity has 24 or more rows; the main entity should have at least 24');
  dataContractRules(brief, err);

  const asIds = new Set();
  for (const a of brief.assumptions) {
    if (asIds.has(a.id)) err('DUP-ID', `assumption id "${a.id}" is used more than once`);
    asIds.add(a.id);
    if (LETTERS.indexOf(a.assumed) >= a.options.length) err('ASSUMED', `assumption "${a.id}": assumed "${a.assumed}" is not one of its ${a.options.length} options`);
  }

  const items = questionItems(brief);
  const texts = new Map();
  for (const it of items) {
    const key = normalizeText(it.text);
    if (texts.has(key)) err('DUP-QUESTION', `${it.label} has the same text as ${texts.get(key)}: "${short(it.text)}"`);
    else texts.set(key, it.label);
    if (it.anchor !== null && !anchorOwner.has(it.anchor)) err('NO-ANCHOR', `${it.label} ("${short(it.text)}") uses anchor "${it.anchor}" which is not in the brief's anchors`);
    // EV1: a round-1 question changes the screen. The schema requires effects; this guards the generator against a badge-only fallback.
    if (it.kind === 'question' && !it.effects) err('EFFECTS-MISSING', `${it.label} (\"${short(it.text)}\") has no effects; every option of a round-1 question needs ops that change the screen`);
    if (it.effects) {
      if (it.effects.length !== it.options.length) err('EFFECTS-LEN', `${it.label} has ${it.options.length} options but ${it.effects.length} effects entries; they must be equal`);
      const seen = new Map();
      it.effects.forEach((ops, i) => {
        const letter = LETTERS[i];
        ops.forEach((op, j) => {
          for (const m of opProblems(op)) err('OP', `${it.label} option ${letter} op ${j + 1}: ${m}`);
          if (!anchorOwner.has(op.target)) {
            err('EFFECT-TARGET', `${it.label} option ${letter} op ${j + 1}: target "${op.target}" is not in the brief's anchors`);
          } else if (it.anchor !== null && anchorOwner.has(it.anchor)) {
            const a = anchorOwner.get(it.anchor);
            const t = anchorOwner.get(op.target);
            if (a !== t && a !== 'shell' && t !== 'shell') warn('EFFECT-OFF-SCREEN', `${it.label} option ${letter}: target "${op.target}" is on screen "${t}" but the anchor "${it.anchor}" is on "${a}"`);
          }
        });
        const sig = JSON.stringify(ops);
        if (it.kind === 'assumption' && seen.has(sig)) warn('EFFECT-SAME', `${it.label}: options ${seen.get(sig)} and ${letter} have identical effects; the answer would change nothing visible`);
        else seen.set(sig, letter);
      });
      // EV1: round-1 questions (not assumptions) must change what the screen shows, and differently per option.
      if (it.kind === 'question' && it.effects.length === it.options.length) {
        for (const p of visibleEffectsProblems(it.effects)) err(p.code, `${it.label} (\"${short(it.text)}\"): ${p.message}`);
      }
    }
  }
  return { errors, warnings };
}

function normalizeText(t) {
  return String(t).replace(/\s+/g, ' ').trim();
}

/** Rules of the data contract (dataEntities, dataDerived) beyond the schema. `err(code, message)` records an error. */
function dataContractRules(brief, err) {
  const entities = new Map();
  for (const e of brief.dataEntities) {
    if (entities.has(e.name)) err('DUP-ID', `data entity "${e.name}" is used more than once`);
    else entities.set(e.name, e);
  }
  for (const e of brief.dataEntities) {
    const fields = new Map();
    for (const f of e.fields) {
      if (fields.has(f.name)) err('DUP-ID', `data entity "${e.name}": field "${f.name}" is used more than once`);
      else fields.set(f.name, f);
      if (f.type === 'enum' && !Array.isArray(f.enum)) err('DATA-ENUM', `data entity "${e.name}": field "${f.name}" has type enum but no "enum" list (the status vocabulary)`);
      else if (f.type !== 'enum' && f.enum !== undefined) err('DATA-ENUM', `data entity "${e.name}": field "${f.name}" has an "enum" list but type "${f.type}"; use type enum`);
    }
    if (!fields.has(e.key)) err('DATA-KEY', `data entity "${e.name}": key "${e.key}" is not one of its fields`);
    for (const r of e.relations || []) {
      if (!fields.has(r.field)) err('DATA-RELATION', `data entity "${e.name}": relation field "${r.field}" is not one of its fields`);
      if (!entities.has(r.entity)) err('DATA-RELATION', `data entity "${e.name}": relation "${r.field}" points at "${r.entity}", which is not a data entity`);
    }
  }
  const kpis = new Set();
  for (const k of brief.dataDerived.kpis) {
    if (kpis.has(k.name)) err('DUP-ID', `kpi "${k.name}" is used more than once in dataDerived.kpis`);
    kpis.add(k.name);
  }
  const series = new Set();
  for (const k of brief.dataDerived.series) {
    if (series.has(k.name)) err('DUP-ID', `series "${k.name}" is used more than once in dataDerived.series`);
    series.add(k.name);
  }
  for (const g of brief.dataDerived.agree || []) {
    if (!kpis.has(g.kpi)) err('DATA-AGREE', `dataDerived.agree: "${g.kpi}" is not a key of dataDerived.kpis (a figure that appears in several places must be a kpi, computed once)`);
  }
  const hasLatLon = (name) => { const e = entities.get(name); return !!e && e.fields.some((f) => f.name === 'lat') && e.fields.some((f) => f.name === 'lon'); };
  if (brief.map) {
    if (brief.map.kind !== 'site-plan' && !brief.map.site) err('DATA-MAP', 'map: kind "' + brief.map.kind + '" needs map.site (name, lat, lon): real coordinates, never a hand-drawn outline');
    if (brief.map.originsEntity && !hasLatLon(brief.map.originsEntity)) err('DATA-MAP', `map.originsEntity "${brief.map.originsEntity}" must be a data entity with the fields lat and lon`);
    if (brief.map.places && !entities.has(brief.map.places)) err('DATA-MAP', `map.places "${brief.map.places}" is not a data entity`);
  }
  for (const reserved of ['kpis', 'series']) if (entities.has(reserved)) err('RESERVED-ID', `data entity "${reserved}" is reserved for window.APP_DATA.${reserved}`);
}

/* ------------------------------------------------------------------------------------------------ brief + sources */

/** Load and validate <record>/ui/src/brief.json. Returns { brief, errors, warnings, engine } (brief null when unusable). */
function loadBrief(recordDir) {
  const file = path.join(recordDir, 'ui', 'src', 'brief.json');
  const errors = [];
  const warnings = [];
  if (!exists(file)) return { brief: null, errors: [{ code: 'MISSING', message: `ui/src/brief.json not found in ${recordDir}` }], warnings, engine: null };
  let brief;
  try {
    brief = JSON.parse(readText(file).replace(/^\ufeff/, ''));
  } catch (e) {
    return { brief: null, errors: [{ code: 'JSON', message: `ui/src/brief.json is not valid JSON: ${e.message}` }], warnings, engine: null };
  }
  const bytes = fs.statSync(file).size;
  if (bytes > BRIEF_JSON_WARN_BYTES) warnings.push({ code: 'SIZE', message: `ui/src/brief.json is ${bytes} bytes; keep it compact (target 14 KB, warning above 16 KB): do not repeat the prose of app-brief.md` });
  const sv = schemaValidator();
  const found = sv.validate(brief);
  const cap = 25;
  for (const f of found.slice(0, cap)) errors.push({ code: 'SCHEMA', message: `${f.path}: ${f.message}` });
  if (found.length > cap) errors.push({ code: 'SCHEMA', message: `... and ${found.length - cap} more schema errors` });
  if (found.length === 0) {
    const cc = crossCheck(brief);
    errors.push(...cc.errors);
    warnings.push(...cc.warnings);
  }
  return { brief: found.length === 0 ? brief : null, errors, warnings, engine: sv.engine };
}

const SCREEN_FILE_RE = /^(\d+)-(.+)\.html$/;

/** Anchor ids (a-...) found in shell.html, screens/*.html and overlays.html. */
function scanSources(uiDir) {
  const src = path.join(uiDir, 'src');
  const files = []; // { rel, owner: 'shell' | screen id | '*' (overlays) | null (unknown file name), ids: [{ id, line }] }
  const add = (rel, owner) => {
    const text = readText(path.join(src, rel));
    const ids = scanHtml(text).ids.filter((x) => x.id.startsWith('a-'));
    files.push({ rel: `src/${rel}`, owner, ids, text });
  };
  if (exists(path.join(src, 'shell.html'))) add('shell.html', 'shell');
  if (exists(path.join(src, 'body.html'))) add('body.html', '*'); // single mode (AIDLC_UI_BUILD=single): one file holds shell and screens
  const screensDir = path.join(src, 'screens');
  if (exists(screensDir)) {
    for (const n of fs.readdirSync(screensDir).filter((x) => x.endsWith('.html')).sort()) {
      const m = SCREEN_FILE_RE.exec(n);
      add(`screens/${n}`, m ? m[2] : null);
    }
  }
  if (exists(path.join(src, 'overlays.html'))) add('overlays.html', '*');
  return { files, hasShell: exists(path.join(src, 'shell.html')), hasBody: exists(path.join(src, 'body.html')), hasScreensDir: exists(screensDir) };
}

/** Compare the anchors of the brief with those of the sources. Returns { errors, warnings } of { code, message }. */
function checkSources(brief, uiDir) {
  const errors = [];
  const warnings = [];
  const err = (code, message) => errors.push({ code, message });
  const scan = scanSources(uiDir);
  if (!scan.hasShell && !scan.hasBody) err('SRC-MISSING', 'src/shell.html not found (the top bar and navigation hold the shell anchors)');
  const screenIds = new Set(brief.screens.map((s) => s.id));
  const byScreen = new Map();
  for (const f of scan.files) {
    if (f.owner === null) err('SCREEN-FILE', `${f.rel}: file name is not NN-<screen id>.html`);
    else if (f.owner !== 'shell' && f.owner !== '*') {
      if (!screenIds.has(f.owner)) err('SCREEN-FILE', `${f.rel}: "${f.owner}" is not a screen of the brief`);
      else if (byScreen.has(f.owner)) err('SCREEN-FILE', `${f.rel}: screen "${f.owner}" already has ${byScreen.get(f.owner)}`);
      else byScreen.set(f.owner, f.rel);
    }
  }
  if (!scan.hasBody) for (const s of brief.screens) if (!byScreen.has(s.id)) err('SCREEN-FILE', `screen "${s.id}" has no file src/screens/NN-${s.id}.html`);

  const found = new Map(); // id -> [{ rel, owner, line }]
  for (const f of scan.files) for (const x of f.ids) { if (!found.has(x.id)) found.set(x.id, []); found.get(x.id).push({ rel: f.rel, owner: f.owner, line: x.line }); }
  const briefAnchors = new Map(anchorsOf(brief).map((a) => [a.id, a]));
  for (const [id, a] of briefAnchors) {
    const hits = found.get(id) || [];
    if (hits.length === 0) {
      const where = a.owner === 'shell' ? 'src/shell.html' : (byScreen.get(a.owner) || `the file of screen "${a.owner}"`);
      err('ANCHOR-MISSING', `anchor "${id}" (${a.label}, screen ${a.owner}) is not in ${where}`);
      continue;
    }
    if (hits.length > 1) err('ANCHOR-DUP', `anchor "${id}" appears ${hits.length} times: ${hits.map((h) => `${h.rel}:${h.line}`).join(', ')}`);
    const h = hits[0];
    if (h.owner !== '*' && h.owner !== null && h.owner !== a.owner) err('ANCHOR-MISPLACED', `anchor "${id}" belongs to screen "${a.owner}" but is in ${h.rel}:${h.line}`);
  }
  for (const [id, hits] of found) {
    if (!briefAnchors.has(id)) err('ANCHOR-EXTRA', `${hits[0].rel}:${hits[0].line}: anchor "${id}" is not in brief.json (add it to the brief or remove the id)`);
  }
  // effect selectors: every class a selector names should occur in the file of its target (approximation of "resolves inside the target")
  const textOf = new Map(scan.files.map((f) => [f.rel, f.text]));
  for (const it of questionItems(brief)) {
    (it.effects || []).forEach((ops, i) => ops.forEach((op, j) => {
      if (!op.selector || !found.has(op.target)) return;
      const file = found.get(op.target)[0].rel;
      const text = textOf.get(file) || '';
      const missing = [...op.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
        .filter((tok) => !new RegExp(`(?<![\\w-])${tok}(?![\\w-])`).test(text));
      for (const tok of new Set(missing)) {
        warnings.push({ code: 'SELECTOR', message: `${it.label} option ${LETTERS[i]} op ${j + 1}: selector "${op.selector}" needs class "${tok}", which is not in ${file} (target ${op.target})` });
      }
    }));
  }
  return { errors, warnings };
}

/* ------------------------------------------------------------------------------------------------ data.js */

/** Run kit seed.js + charts.js + src/data.js text in a vm sandbox with a tiny window/document stub. Returns { ok, data, error }. */
function evalDataJs(dataText, seedText) {
  const noop = () => {};
  const ctx = { console: { log: noop, warn: noop, error: noop } };
  ctx.window = ctx;
  ctx.document = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop,
    createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
  };
  vm.createContext(ctx);
  try {
    for (const f of ['seed.js', 'charts.js', 'basemap.js']) {
      const kit = path.join(ADDON_ROOT, 'kit', 'data', f);
      if (exists(kit)) vm.runInContext(readText(kit), ctx, { filename: `kit/data/${f}`, timeout: DATA_EVAL_TIMEOUT_MS });
    }
    if (seedText) vm.runInContext(seedText, ctx, { filename: 'src/data.seed.js', timeout: DATA_EVAL_TIMEOUT_MS });
    vm.runInContext(dataText, ctx, { filename: 'src/data.js', timeout: DATA_EVAL_TIMEOUT_MS });
  } catch (e) {
    const where = e && e.stack ? (/src\/data\.js:(\d+)/.exec(e.stack) || [])[1] : null;
    return { ok: false, data: null, error: `${e && e.message ? e.message : String(e)}${where ? ` (src/data.js line ${where})` : ''}` };
  }
  return { ok: true, data: ctx.window.APP_DATA, canon: ctx.window.CANON, error: null };
}

/** Text heuristic: does data.js assign `name` as a key (object literal key, APP_DATA.name = or APP_DATA['name'] =)? */
function keyAssigned(text, name) {
  const patterns = [
    `(?:^|[\\s,{(])['"]?${name}['"]?\\s*:`,
    `APP_DATA\\.${name}\\s*=`,
    `APP_DATA\\[\\s*['"]${name}['"]\\s*\\]\\s*=`,
    `(?:^|[\\s,{])${name}\\s*(?=[,}\\n])`,
  ];
  return patterns.some((p) => new RegExp(p, 'm').test(text));
}

/**
 * Compare <ui>/src/data.js with the data contract of the brief (dataEntities, dataDerived). Full check only.
 * Errors: SRC-MISSING (no file), DATA-EVAL (does not run), DATA-RENDER (does not call window.APP_RENDER).
 * Warnings: DATA-ENTITY, DATA-ROWS, DATA-FIELD, DATA-KPI, DATA-KPI-VALUE, DATA-SERIES.
 */
function checkData(brief, uiDir) {
  const errors = [];
  const warnings = [];
  const file = path.join(uiDir, 'src', 'data.js');
  if (!exists(file)) {
    errors.push({ code: 'SRC-MISSING', message: 'src/data.js not found (ui-data-builder writes the one shared dataset)' });
    return { errors, warnings };
  }
  const text = readText(file);
  if (!/APP_RENDER/.test(text) || !/forEach\s*\(/.test(text)) {
    errors.push({ code: 'DATA-RENDER', message: 'src/data.js does not call every function of window.APP_RENDER at its end ((window.APP_RENDER || []).forEach(function (render, i) { try { render(window.APP_DATA); } catch (e) { console.error(...); } }); as in kit/data-template.md); no screen would be filled' });
  }
  const seedFile = path.join(uiDir, 'src', 'data.seed.js');
  const seedText = exists(seedFile) ? readText(seedFile) : null;
  if (brief.seed && seedText === null) errors.push({ code: 'DATA-SEED', message: `brief.json names the canonical seed "${brief.seed}" but src/data.seed.js does not exist. Fix: run .aidlc-ui/bin/ui-seed-import <ui>/src` });
  if (brief.seed && seedText !== null && !/\bcanon\b|\bCANON\b/.test(text)) errors.push({ code: 'DATA-SEED', message: 'src/data.js does not use canon.rows() / canon.total(): the records of the canonical seed must come from window.canon, not be typed again (kit/SEED-RULES.md)' });
  const ev = evalDataJs(text, seedText);
  if (!ev.ok) errors.push({ code: 'DATA-EVAL', message: `src/data.js does not run: ${ev.error}` });
  const data = ev.ok && isObj(ev.data) ? ev.data : null;
  const seedJson = path.join(uiDir, 'src', 'seed.json');
  if (data && brief.seed && seedText !== null && exists(seedJson)) {
    let seed = null;
    try { seed = JSON.parse(readText(seedJson)); } catch (_) { /* reported by ui-seed-import */ }
    if (seed) {
      const clean = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
      const names = Object.keys(seed.collections || {});
      const state = { canon: ev.canon ? clean(ev.canon) : null, data: Object.fromEntries(names.map((n) => [n, data[n] === undefined ? undefined : clean(data[n])])), kpis: isObj(data.kpis) ? clean(data.kpis) : undefined, dom: {} };
      for (const f of require('./seed.js').compareSeed(seed, state)) errors.push({ code: 'DATA-SEED', message: f.message });
    }
  }
  if (ev.ok && data === null) errors.push({ code: 'DATA-EVAL', message: 'src/data.js runs but window.APP_DATA is not an object' });
  for (const e of brief.dataEntities) {
    if (data) {
      const rows = data[e.name];
      if (rows === undefined) {
        warnings.push({ code: 'DATA-ENTITY', message: `entity "${e.name}" of dataEntities is not a key of window.APP_DATA` });
        continue;
      }
      if (!Array.isArray(rows)) { warnings.push({ code: 'DATA-ROWS', message: `window.APP_DATA.${e.name} is not an array` }); continue; }
      if (rows.length < e.rows) warnings.push({ code: 'DATA-ROWS', message: `window.APP_DATA.${e.name} has ${rows.length} rows; the brief declares ${e.rows}` });
      const first = rows.find((r) => isObj(r));
      if (first) {
        const missing = e.fields.map((f) => f.name).filter((n) => !(n in first));
        if (missing.length) warnings.push({ code: 'DATA-FIELD', message: `window.APP_DATA.${e.name}: rows lack the declared field${missing.length > 1 ? 's' : ''} ${missing.join(', ')}` });
      }
    } else if (!keyAssigned(text, e.name)) {
      warnings.push({ code: 'DATA-ENTITY', message: `entity "${e.name}" of dataEntities does not look like a key assigned on window.APP_DATA in src/data.js` });
    }
  }
  if (data) {
    const kpis = isObj(data.kpis) ? data.kpis : {};
    for (const k of brief.dataDerived.kpis) {
      if (!(k.name in kpis)) { warnings.push({ code: 'DATA-KPI', message: `kpi "${k.name}" of dataDerived is not a key of window.APP_DATA.kpis` }); continue; }
      const v = kpis[k.name];
      if (typeof v !== 'number' || Number.isNaN(v)) warnings.push({ code: 'DATA-KPI', message: `window.APP_DATA.kpis.${k.name} must be a number (it is ${typeof v}); screens format it` });
      else if (Math.abs(v - k.value) > 0.01) warnings.push({ code: 'DATA-KPI-VALUE', message: `window.APP_DATA.kpis.${k.name} is ${v}; the brief (and the effects of its questions) say ${k.value}` });
    }
    const series = isObj(data.series) ? data.series : {};
    for (const k of brief.dataDerived.series) {
      if (!Array.isArray(series[k.name])) warnings.push({ code: 'DATA-SERIES', message: `series "${k.name}" of dataDerived is not an array under window.APP_DATA.series` });
    }
  }
  return { errors, warnings };
}

/* ------------------------------------------------------------------------------------------------ questions file */

function quickBlocks(templatePath = QUICK_TEMPLATE_PATH) {
  const tpl = readText(templatePath);
  const block = /```markdown\n([\s\S]*?)\n```/.exec(tpl);
  if (!block) throw new Error('quick-questions.md: no markdown block');
  const parts = block[1].split(/^(?=## Q\d+\. )/m).filter((x) => x.trim());
  if (parts.length !== 3) throw new Error(`quick-questions.md: expected 3 questions, found ${parts.length}`);
  return parts.map((p) => p.trimEnd());
}

/** Split a questions file into a preamble and `## ` chunks (fenced code blocks are not split). */
function parseChunks(text) {
  const lines = text.split('\n');
  const pre = [];
  const chunks = [];
  let cur = null;
  let fence = null;
  for (const line of lines) {
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) fence = fence === null ? f[1] : fence === f[1] ? null : fence;
    if (fence === null && /^## /.test(line) && !f) { cur = { lines: [line] }; chunks.push(cur); continue; }
    (cur ? cur.lines : pre).push(line);
  }
  const trim = (ls) => ls.join('\n').replace(/\s+$/, '');
  for (const c of chunks) {
    c.raw = trim(c.lines);
    const h = /^## Q([1-9][0-9]*)\.\s*(.*)$/.exec(c.lines[0]);
    c.n = h ? Number(h[1]) : null;
    c.key = h ? normalizeText(h[2].replace(/^\[[^\]]*\]\s*/, '')) : null;
    c.kind = (/^\[Kind\]:[ \t]*(.*?)[ \t]*$/m.exec(c.raw) || [])[1] || null;
    c.source = (/^\[Source\]:[ \t]*(.*?)[ \t]*$/m.exec(c.raw) || [])[1] || null;
    const a = /^\[Answer\]:[ \t]*(.*?)[ \t]*$/m.exec(c.raw);
    c.answer = a ? a[1] : '';
    c.options = c.raw.split('\n').filter((l) => /^\s*[-*]\s+[A-DX]\./.test(l)).map((l) => l.trim());
    delete c.lines;
  }
  return { pre: trim(pre), chunks };
}

function renderQuestion(n, it) {
  const out = [`## Q${n}. [${it.role}] ${normalizeText(it.text)}`];
  if (it.anchor) out.push(`[Anchor]: ${it.anchor}`);
  if (it.kind === 'assumption') out.push('[Kind]: assumption', `[Assumed]: ${it.assumed}`);
  out.push('', `Why we ask: ${normalizeText(it.why)}`, '');
  it.options.forEach((t, i) => out.push(`- ${LETTERS[i]}. ${normalizeText(t)}`));
  out.push(`- ${OTHER_OPTION}`, '', `[Answer]:${it.answer ? ` ${it.answer}` : ''}`);
  return out.join('\n');
}

const SUMMARY_SECTION = '## Consolidated Summary Confirmation\n\nDoes this all look correct before I generate the artifact?\n\n- Looks correct\n- Request changes\n\n[Answer]:';

/**
 * Plan the questions file. Returns { text, assigned: [{ item, n }], notes: [string] }.
 * `managedRefs`: question refs written by an earlier run (from the previous ui-map.json); such questions that no longer
 * match the brief are dropped when unanswered, and kept (with a note) when answered. Everything else in the file is kept.
 */
function planQuestions(brief, { stem, oldText, managedRefs, quickPath }) {
  const notes = [];
  const withQuick = stem === QUICK_STEM;
  const old = parseChunks(oldText || '');
  const items = questionItems(brief);
  const isQuick = (c) => c.n !== null && c.kind === 'quick';
  const isCanvas = (c) => c.n !== null && c.source === 'canvas-round';
  const isQuestion = (c) => c.n !== null;

  const used = new Set(old.chunks.filter(isQuestion).map((c) => c.n));
  let quick = old.chunks.filter(isQuick).map((c) => c.raw);
  let createdQuick = false;
  if (withQuick && quick.length === 0) {
    quick = quickBlocks(quickPath);
    for (const n of [1, 2, 3]) {
      if (used.has(n)) throw new Error(`${stem}: Q${n} exists and is not a quick question; cannot create the three quick questions Q1-Q3`);
    }
    createdQuick = true;
  }
  if (withQuick) [1, 2, 3].forEach((n) => used.add(n));

  // match brief items to existing questions by text
  const candidates = old.chunks.filter((c) => isQuestion(c) && !isQuick(c) && !isCanvas(c));
  const byKey = new Map();
  for (const c of candidates) if (!byKey.has(c.key)) byKey.set(c.key, c);
  const matched = new Map(); // item -> chunk
  for (const it of items) { const c = byKey.get(normalizeText(it.text)); if (c && ![...matched.values()].includes(c)) matched.set(it, c); }

  let next = Math.max(0, ...used) + 1;
  const assigned = items.map((it) => {
    const c = matched.get(it);
    let n;
    if (c) n = c.n; else { n = next; next += 1; }
    return { item: it, n, old: c || null };
  });

  const render = (a) => {
    const answer = a.old ? a.old.answer : '';
    if (a.old && answer && a.old.options.length) {
      const nu = a.item.options.map((t, i) => `- ${LETTERS[i]}. ${normalizeText(t)}`);
      const oo = a.old.options.filter((l) => !/^- X\./.test(l));
      if (JSON.stringify(nu) !== JSON.stringify(oo)) notes.push(`Q${a.n} keeps its answer "${answer}" but its options changed; check that the answer still means the same`);
    }
    return renderQuestion(a.n, { ...a.item, answer });
  };
  const byOld = new Map(assigned.filter((a) => a.old).map((a) => [a.old, a]));
  const fresh = assigned.filter((a) => !a.old);

  // build output chunks in the order of the old file
  const out = [];
  const firstPre = old.pre || `# Intent Capture Questions\n\nContext: first version of the interface of "${brief.app.name}". Q1-Q3 are the quick questions. The questions that follow are tied to elements of the prototype ([Anchor]:); the ones marked [Kind]: assumption are decisions version 1 already took and can be corrected.`;
  const placedFresh = () => fresh.map(render);
  let freshInserted = false;
  const lastQuestionIdx = (() => { let idx = -1; old.chunks.forEach((c, i) => { if (isQuestion(c) && !isCanvas(c)) idx = i; }); return idx; })();
  if (createdQuick) out.push(...quick);
  if (old.chunks.length === 0) { out.push(...placedFresh()); freshInserted = true; out.push(SUMMARY_SECTION); }
  old.chunks.forEach((c, i) => {
    if (isQuick(c) || isCanvas(c)) out.push(c.raw);
    else if (isQuestion(c)) {
      const a = byOld.get(c);
      if (a) out.push(render(a));
      else if (managedRefs.has(`${stem}#Q${c.n}`)) {
        if (c.answer) { out.push(c.raw); notes.push(`Q${c.n} is no longer in the brief but has the answer "${c.answer}"; kept as is (remove it by hand if it is obsolete)`); } else notes.push(`Q${c.n} (not in the brief any more, unanswered) was removed`);
      } else out.push(c.raw);
    } else out.push(c.raw);
    if (i === lastQuestionIdx && !freshInserted) { out.push(...placedFresh()); freshInserted = true; }
  });
  if (!freshInserted) out.push(...placedFresh());
  const text = [firstPre, ...out].filter((x) => x !== '').join('\n\n') + '\n';
  return { text, assigned, notes };
}

/* ------------------------------------------------------------------------------------------------ outputs */

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}\u2026` : s);

/** effects.json content for the planned questions (ANCHORS.md section 2b). */
function buildEffects(assigned, stem) {
  const entries = [];
  for (const { item, n } of assigned) {
    const ref = `${stem}#Q${n}`;
    if (item.kind === 'question' && item.anchor && !item.effects) {
      throw new Error(`${item.label} has an anchor but no effects: a round-1 question never gets the badge-only fallback`);
    }
    const perOption = item.effects
      || (item.anchor ? item.options.map((t) => [{ op: 'badge', target: item.anchor, text: cut(normalizeText(t), 40) }]) : null);
    if (!perOption) continue;
    perOption.forEach((ops, i) => entries.push({ question: ref, answer: LETTERS[i], ops }));
    if (item.anchor) entries.push({ question: ref, answer: '*', ops: [{ op: 'badge', target: item.anchor, text: 'Other' }] });
  }
  return `{"effects":[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]}\n`;
}

/** ui-map.json (schemaVersion 1.2) for the brief. `prev` is the existing ui-map.json (object) or null. */
function buildUiMap(brief, assigned, stem, prev, recordName) {
  const refsOf = new Map();
  for (const { item, n } of assigned) {
    if (!item.anchor) continue;
    if (!refsOf.has(item.anchor)) refsOf.set(item.anchor, []);
    refsOf.get(item.anchor).push(`${stem}#Q${n}`);
  }
  const prevEl = new Map(prev && Array.isArray(prev.elements) ? prev.elements.map((e) => [e.id, e]) : []);
  const element = (a) => {
    const old = prevEl.get(a.id);
    const e = { id: a.id, screen: a.owner, label: a.label, kind: a.kind, questionIds: refsOf.get(a.id) || [], frIds: old && Array.isArray(old.frIds) ? old.frIds : [], module: null };
    if (old && Array.isArray(old.uxIds) && old.uxIds.length) e.uxIds = old.uxIds;
    return e;
  };
  const app = { name: brief.app.name };
  if (recordName && /^[0-9]{6}-[a-z0-9]+(-[a-z0-9]+)*$/.test(recordName)) app.intent = recordName;
  app.language = brief.app.language;
  const map = {
    schemaVersion: '1.2',
    uiVersion: prev && Number.isInteger(prev.uiVersion) && prev.uiVersion >= 1 ? prev.uiVersion : 1,
    app,
    screens: [
      ...brief.screens.map((s) => ({ id: s.id, title: s.title, route: s.route })),
      { id: 'shell', title: 'Top bar and navigation (all screens)', route: brief.screens[0].route },
    ],
    elements: anchorsOf(brief).map(element),
    modules: prev && Array.isArray(prev.modules) ? prev.modules : [],
  };
  if (prev && Array.isArray(prev.flows)) map.flows = prev.flows;
  map.assumptions = assigned.filter((a) => a.item.kind === 'assumption').map((a) => ({
    id: a.item.id, text: a.item.assumptionText, question: `${stem}#Q${a.n}`, assumed: a.item.assumed,
  }));
  return `${JSON.stringify(map, null, 2)}\n`;
}

/** Refs (stem#Qn) that an earlier run of ui-brief wrote, read from the previous ui-map.json. */
function managedRefsOf(prev, stem) {
  const refs = new Set();
  if (!prev) return refs;
  for (const e of prev.elements || []) for (const r of e.questionIds || []) if (r.startsWith(`${stem}#`)) refs.add(r);
  for (const a of prev.assumptions || []) if (typeof a.question === 'string' && a.question.startsWith(`${stem}#`)) refs.add(a.question);
  return refs;
}

function readJsonIfExists(file) {
  if (!exists(file)) return null;
  try { return JSON.parse(readText(file)); } catch (_) { return null; }
}

/**
 * Write effects.json, ui-map.json and the questions file for a clean brief.
 * Returns { report: [lines], notes, files: { effects, uiMap, questions }, assigned }.
 */
function generate(recordDir, brief, { questionsRel = DEFAULT_QUESTIONS_REL, quickPath } = {}) {
  const uiDir = path.join(recordDir, 'ui');
  const qFile = path.join(recordDir, questionsRel);
  const stem = path.basename(qFile).replace(/\.md$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*-questions$/.test(stem)) throw new Error(`questions file name "${path.basename(qFile)}" must look like <stage>-questions.md`);
  const mapFile = path.join(uiDir, 'ui-map.json');
  const prev = readJsonIfExists(mapFile);
  const plan = planQuestions(brief, {
    stem, oldText: exists(qFile) ? readText(qFile) : '', managedRefs: managedRefsOf(prev, stem), quickPath,
  });
  const effectsFile = path.join(uiDir, 'src', 'effects.json');
  writeAtomic(qFile, plan.text);
  writeAtomic(effectsFile, buildEffects(plan.assigned, stem));
  writeAtomic(mapFile, buildUiMap(brief, plan.assigned, stem, prev, path.basename(path.resolve(recordDir))));
  const anchored = plan.assigned.filter((a) => a.item.anchor).length;
  const report = [
    `ui-brief: ${brief.screens.length} screens, ${anchorsOf(brief).length} anchors, ${brief.questions.length} questions, ${brief.assumptions.length} assumptions`,
    `wrote ${path.relative(recordDir, qFile)} (${stem}: ${plan.assigned.map((a) => `Q${a.n}`).join(', ')}; Q1-Q3 quick)`,
    `wrote ui/src/effects.json (${buildEffects(plan.assigned, stem).split('\n').length - 3} entries for ${anchored} anchored questions)`,
    `wrote ui/ui-map.json (uiVersion ${JSON.parse(readText(mapFile)).uiVersion}, ${anchorsOf(brief).length} elements, ${brief.assumptions.length} assumptions)`,
    ...plan.assigned.map((a) => `  ${stem}#Q${a.n}  ${a.item.kind === 'assumption' ? `assumption ${a.item.id}` : 'question'}  ${a.item.anchor || '(no anchor)'}`),
    ...plan.notes.map((n) => `note: ${n}`),
  ];
  return { report, notes: plan.notes, files: { effects: effectsFile, uiMap: mapFile, questions: qFile }, assigned: plan.assigned };
}

/* ------------------------------------------------------------------------------------------------ app brief check */

const BRIEF_TOPICS = [
  { name: 'Goal', re: /^(goal|purpose|objective)/i },
  { name: 'The app', re: /^(the app|app\b|the product|domain)/i },
  { name: 'Users and roles', re: /^(users?|roles?|personas?)\b/i },
  { name: 'Screens', re: /^screens?\b/i },
  { name: 'Mock data', re: /^(mock data|sample data|data\b)/i },
  { name: 'Decisions that change the UI', re: /^(decisions?|inception layer|questions that change)/i },
  { name: 'Quality bar', re: /^quality/i },
  { name: 'Technical constraints', re: /^(technical constraints|tech constraints|tech\b|constraints)/i },
  { name: 'Verification', re: /^verif/i },
];
const BRIEF_MIN_BYTES = 4000;
const BRIEF_MAX_BYTES = 12000;
const BRIEF_MIN_RECORDS = 18;
const MIN_TOPICS_TOLERANT = 5;

/** Number of record-like lines: table rows (not header or separator), list items and numbered lines with two or more fields. */
function countRecordLines(text) {
  const lines = text.split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^\|/.test(l)) {
      if (/^\|[\s:|-]+\|?$/.test(l)) continue; // separator row
      if (i + 1 < lines.length && /^\|[\s:|-]+\|?$/.test(lines[i + 1].trim())) continue; // header row
      if (l.split('|').filter((c) => c.trim() !== '').length >= 2) n++;
    } else if (/^([-*]|\d+[.)]?)\s/.test(l) || /^\d/.test(l)) {
      const body = l.replace(/^([-*]|\d+[.)]?)\s+/, '');
      if (body.split(/\s*[|,;:\u2192\u2014\t]\s*|\s-\s/).filter((c) => c.trim() !== '').length >= 2) n++;
    }
  }
  return n;
}

/**
 * Check an app brief file (D-37). Returns { errors: [{ code, message }], warnings }.
 * strict: all nine template headings must be present (the form the template and the ui-designer follow).
 * default: tolerates a brief that predates the template (the SpudTrack golden example has 6 of the 9 sections) as long
 * as at least five topics are present, in order, and the content checks pass; missing headings are warnings then.
 */
function checkBriefFile(file, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, message) => errors.push({ code, message });
  if (!exists(file)) return { errors: [{ code: 'MISSING', message: `${file} not found` }], warnings };
  const buf = fs.readFileSync(file);
  const text = buf.toString('utf8').replace(/\r\n?/g, '\n');
  if (buf.length < BRIEF_MIN_BYTES) err('SIZE', `brief is ${buf.length} bytes; at least ${BRIEF_MIN_BYTES} are needed (write at the depth of the SpudTrack example)`);
  if (buf.length > BRIEF_MAX_BYTES) err('SIZE', `brief is ${buf.length} bytes; at most ${BRIEF_MAX_BYTES} are allowed`);

  const heads = [];
  const lines = text.split('\n');
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) fence = !fence;
    const m = !fence && /^##\s+(.+?)\s*$/.exec(l);
    if (m) heads.push({ title: m[1], line: i, topic: BRIEF_TOPICS.findIndex((t) => t.re.test(m[1].replace(/^[\d.)\s]+/, ''))) });
  });
  const seen = new Map(); // topic index -> heading
  for (const h of heads) if (h.topic >= 0 && !seen.has(h.topic)) seen.set(h.topic, h);
  const missing = BRIEF_TOPICS.filter((_, i) => !seen.has(i)).map((t) => t.name);
  if (strict && missing.length) {
    err('HEADINGS', `missing "##" heading${missing.length > 1 ? 's' : ''}: ${missing.join(', ')} (the nine template headings are required, see addon/templates/app-brief.md)`);
  } else if (!strict) {
    if (seen.size < MIN_TOPICS_TOLERANT) err('HEADINGS', `only ${seen.size} of the 9 template headings found (at least ${MIN_TOPICS_TOLERANT} needed); missing: ${missing.join(', ')}`);
    else if (missing.length) warnings.push({ code: 'HEADING-MISSING', message: `no heading for: ${missing.join(', ')} (accepted for a brief that predates the template; use --strict to require all nine)` });
  }
  const order = [...seen.entries()].sort((a, b) => a[1].line - b[1].line).map(([t]) => t);
  for (let i = 1; i < order.length; i++) {
    if (order[i] < order[i - 1]) { err('HEADING-ORDER', `heading "${seen.get(order[i]).title}" comes before "${seen.get(order[i - 1]).title}"; the template order is ${BRIEF_TOPICS.map((t) => t.name).join(', ')}`); break; }
  }

  const section = (topic) => {
    const h = seen.get(topic);
    if (!h) return null;
    const next = heads.filter((x) => x.line > h.line)[0];
    return lines.slice(h.line + 1, next ? next.line : lines.length).join('\n');
  };
  const mock = section(4);
  const records = countRecordLines(mock !== null ? mock : text);
  if (records < BRIEF_MIN_RECORDS) {
    err('RECORDS', `${records} sample-record lines${mock !== null ? ' under "Mock data"' : ' in the whole brief (no "Mock data" heading)'}; at least ${BRIEF_MIN_RECORDS} are needed (spell out the mock records)`);
  }
  const quality = section(6);
  if (!/polished|quality bar/i.test(quality !== null ? quality : text)) {
    err('QUALITY', `${quality !== null ? 'the "Quality bar" section' : 'the brief'} does not state the quality bar (the word "polished" or "quality bar" is expected)`);
  }
  return { errors, warnings };
}

module.exports = {
  ADDON_ROOT, DEFAULT_QUESTIONS_REL, QUICK_STEM, LETTERS,
  schemaValidator, miniValidate, crossCheck, loadBrief, scanSources, checkSources, checkData, evalDataJs, anchorsOf, questionItems,
  parseChunks, planQuestions, buildEffects, buildUiMap, managedRefsOf, generate, checkBriefFile, countRecordLines, quickBlocks, normalizeText,
};
