// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// Validation of an AI-DLC UI-first record directory. Rules: addon/ANCHORS.md section 5.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv2020 = require('ajv/dist/2020');

const { scanHtml } = require('./html-scan');
const { visibleEffectsProblems } = require('./effects-rule');

const MOCKUP_DIR = path.join('ideation', 'rough-mockups');
const FREEZE_REL = 'inception/ui-freeze/ui-freeze-record.md';
const MOCK_ONLY_REL = 'ui/mock-only.md'; // I-14: data the frozen UI shows and the backend will not give

// Three layouts. A record layout wins over stray root files: ui/ (v1.2, ANCHORS.md section 6.1) > ideation/rough-mockups/
// (v1.0/1.1) > sketch dir (ui-map.json / prototype.html directly in the given dir, ANCHORS.md section 2c).
const LAYOUTS = {
  sketch: { uiMap: 'ui-map.json', prototype: 'prototype.html' },
  ui: { uiMap: 'ui/ui-map.json', prototype: 'ui/prototype.html' },
  record: { uiMap: 'ideation/rough-mockups/ui-map.json', prototype: 'ideation/rough-mockups/prototype.html' },
};

/** 'ui' | 'record' (rough-mockups) | 'sketch'. Falls back to 'record' when nothing is found (reports MISSING-*). */
function detectLayout(dir) {
  const has = (rel) => fs.existsSync(path.join(dir, rel));
  const hasAny = (l) => has(LAYOUTS[l].uiMap) || has(LAYOUTS[l].prototype);
  if (hasAny('ui')) return 'ui';
  if (hasAny('record')) return 'record';
  if (hasAny('sketch')) return 'sketch';
  return 'record';
}

/** True when both the v1.2 ui/ location and the v1.0/1.1 rough-mockups location hold a prototype. */
function hasBothLocations(dir) {
  const has = (rel) => fs.existsSync(path.join(dir, rel));
  const any = (l) => has(LAYOUTS[l].uiMap) || has(LAYOUTS[l].prototype);
  return any('ui') && any('record');
}

const UI_DIR_REL = 'ui';
const VERSIONS_REL = 'ui/versions';
const QUALITY_REL = 'ui/quality';

// schemaVersion major -> schema file (relative to addon/schemas/). The current major and the
// previous one are accepted (ANCHORS.md section 6). Major 1 covers schemaVersion "1.0" and "1.1"
// (the schema's enum). Add the previous major's file here when v2 ships.
const SCHEMA_FILES = { 1: 'ui-map.schema.json' };

// Answer effects (ANCHORS.md section 2b).
const EFFECT_OPS = {
  text: { req: ['target', 'value'], opt: ['selector'] },
  hide: { req: ['target'], opt: [] },
  show: { req: ['target'], opt: [] },
  class: { req: ['target'], opt: ['selector', 'add', 'remove'] },
  badge: { req: ['target', 'text'], opt: [] },
};
const EFFECT_ANSWERS = new Set(['A', 'B', 'C', 'D', '*']);
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const SKIP_DIRS = new Set(['versions', 'node_modules', '.git']);
const ANCHOR_RE = /^a-[a-z0-9]+(-[a-z0-9]+)*$/;
const ANCHOR_LINE_RE = /^\[Anchor\]:[ \t]*(a-[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/;
const QUESTION_REF_RE = /^(.+)#Q([1-9][0-9]*)$/;

const schemaCache = new Map();

function getValidator(major) {
  if (schemaCache.has(major)) return schemaCache.get(major);
  const file = SCHEMA_FILES[major];
  if (!file) return null;
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', file), 'utf8'));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(schema);
  schemaCache.set(major, validate);
  return validate;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readJsonText(buf) {
  let s = buf.toString('utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return JSON.parse(s);
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** All `*-questions.md` files under root, skipping versions/, node_modules/ and .git/. Sorted. */
function findQuestionFiles(root) {
  const found = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
      } else if (e.isFile() && e.name.endsWith('-questions.md')) {
        found.push(full);
      }
    }
  })(root);
  return found;
}

/** Parse one questions file: question numbers, [Anchor]: lines and the v1.2 kind lines (fenced code blocks are ignored). */
function parseQuestions(text) {
  const numbers = new Set();
  const anchors = []; // { n, id, line }
  const problems = []; // { code, line, message, level? } level 'warn' for warnings, else error
  const perQuestion = new Map(); // n -> count of [Anchor] lines
  const options = new Map(); // n -> Set of option letters (A-D, X) listed as "- A. ..."
  const meta = new Map(); // n -> { kind, assumed, source } each { value, line } | null (first occurrence), plus anchor id
  const answers = new Map(); // n -> non-empty value after "[Answer]:" (first one)
  let current = null;
  let optionSeen = false; // an option list started under the current question
  let fence = null;
  const lines = text.split(/\r?\n/);
  const problem = (code, lineNo, message, level) => problems.push({ code, line: lineNo, message: `line ${lineNo}: ${message}`, level });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) {
      if (fence === null) fence = f[1];
      else if (fence === f[1]) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const q = /^## Q([1-9][0-9]*)\./.exec(line);
    if (q) {
      current = Number(q[1]);
      optionSeen = false;
      numbers.add(current);
      if (!options.has(current)) options.set(current, new Set());
      if (!meta.has(current)) meta.set(current, { kind: null, assumed: null, source: null, anchor: null });
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      current = null; // another section heading ends the current question
      continue;
    }
    const opt = current === null ? null : /^\s*[-*]\s+\**([A-DX])\.\**(?:\s|$)/.exec(line);
    if (opt) {
      options.get(current).add(opt[1]);
      optionSeen = true;
      continue;
    }
    const kl = /^\[(Kind|Assumed|Source)\]:[ \t]*(.*?)[ \t]*$/.exec(line);
    if (kl) {
      const name = kl[1];
      if (current === null) {
        problem('KIND-OUTSIDE-QUESTION', lineNo, `[${name}]: is not under a "## Q<n>." heading`);
        continue;
      }
      if (optionSeen) problem('KIND-MISPLACED', lineNo, `[${name}]: comes after the options of Q${current}; put it directly under the question heading`, 'warn');
      const slot = name.toLowerCase();
      const m = meta.get(current);
      if (m[slot] !== null) {
        problem('KIND-DUPLICATE', lineNo, `question Q${current} has more than one [${name}]: line (first on line ${m[slot].line})`);
        continue;
      }
      m[slot] = { value: kl[2], line: lineNo };
      if (name === 'Kind' && !/^(quick|assumption|stock|round-[1-9][0-9]*)$/.test(kl[2])) {
        problem('KIND-UNKNOWN', lineNo, `[Kind]: "${kl[2].slice(0, 40)}" is not quick, assumption, stock or round-<n> (n >= 1)`);
      }
      continue;
    }
    const al = current === null ? null : /^\[Answer\]:[ \t]*(\S.*?)[ \t]*$/.exec(line);
    if (al && !answers.has(current)) answers.set(current, al[1]);
    if (/^\[Anchor\]:/.test(line)) {
      const am = ANCHOR_LINE_RE.exec(line);
      if (!am) {
        problems.push({ code: 'ANCHOR-MALFORMED', line: lineNo, message: `line ${lineNo}: malformed [Anchor]: line (expected "[Anchor]: a-kebab-case-id"): ${line.slice(0, 80)}` });
        continue;
      }
      if (am[1].length > 64) {
        problems.push({ code: 'ANCHOR-MALFORMED', line: lineNo, message: `line ${lineNo}: anchor id "${am[1]}" is longer than 64 characters` });
        continue;
      }
      if (current === null) {
        problems.push({ code: 'ANCHOR-OUTSIDE-QUESTION', line: lineNo, message: `line ${lineNo}: [Anchor]: ${am[1]} is not under a "## Q<n>." heading` });
        continue;
      }
      const count = (perQuestion.get(current) || 0) + 1;
      perQuestion.set(current, count);
      if (count > 1) {
        problems.push({ code: 'MULTIPLE-ANCHORS', line: lineNo, message: `line ${lineNo}: question Q${current} has more than one [Anchor]: line` });
      }
      if (meta.get(current).anchor === null) meta.get(current).anchor = am[1];
      anchors.push({ n: current, id: am[1], line: lineNo });
    }
  }
  return { numbers, anchors, problems, options, meta, answers };
}

function describeAjvError(e) {
  const where = e.instancePath === '' ? '/' : e.instancePath;
  let msg = `${where} ${e.message}`;
  if (e.keyword === 'additionalProperties') msg += ` ("${e.params.additionalProperty}")`;
  else if (e.keyword === 'enum') msg += ` (${e.params.allowedValues.join(', ')})`;
  else if (e.keyword === 'const') msg += ` (${JSON.stringify(e.params.allowedValue)})`;
  else if (e.keyword === 'required') msg += ` ("${e.params.missingProperty}")`;
  return msg;
}

/**
 * Validate a record directory, or a Canvas sketch directory (auto-detected, ANCHORS.md section 2c).
 * Options: { checkFreeze: boolean }
 * Returns { ok, errors: [{code,file,message}], warnings: [...], layout: 'record'|'sketch' }
 */
function validateRecord(recordDir, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, file, message) => errors.push({ code, file, message });
  const warn = (code, file, message) => warnings.push({ code, file, message });

  const layout = detectLayout(recordDir);
  const sketch = layout === 'sketch';
  const UI_MAP_REL = LAYOUTS[layout].uiMap;
  const PROTOTYPE_REL = LAYOUTS[layout].prototype;
  const mapPath = path.join(recordDir, UI_MAP_REL);
  const htmlPath = path.join(recordDir, PROTOTYPE_REL);

  if (layout === 'ui' && hasBothLocations(recordDir)) {
    warn('LAYOUT-BOTH', UI_DIR_REL, `both ${UI_DIR_REL}/ and ${MOCKUP_DIR.split(path.sep).join('/')}/ hold a prototype; validating ${UI_DIR_REL}/ and ignoring the other`);
  }

  // ---- ui-map.json: load and schema-validate -------------------------------------------------
  let map = null; // set only when the schema check passed
  let mapRaw = null;
  let mapBuf = null;
  if (!fs.existsSync(mapPath)) {
    err('MISSING-UI-MAP', UI_MAP_REL, 'file not found');
  } else {
    mapBuf = fs.readFileSync(mapPath);
    try {
      mapRaw = readJsonText(mapBuf);
    } catch (e) {
      err('SCHEMA', UI_MAP_REL, `invalid JSON: ${e.message}`);
    }
  }
  if (mapRaw !== null) {
    const sv = mapRaw && typeof mapRaw === 'object' ? mapRaw.schemaVersion : undefined;
    const major = typeof sv === 'string' && /^[0-9]+\.[0-9]+$/.test(sv) ? Number(sv.split('.')[0]) : null;
    const validate = major === null ? null : getValidator(major);
    if (major === null) {
      err('SCHEMA', UI_MAP_REL, `/schemaVersion missing or malformed (${JSON.stringify(sv)}); supported majors: ${Object.keys(SCHEMA_FILES).join(', ')}`);
    } else if (!validate) {
      err('SCHEMA', UI_MAP_REL, `/schemaVersion "${sv}" is not supported; supported majors: ${Object.keys(SCHEMA_FILES).join(', ')}`);
    } else if (!validate(mapRaw)) {
      for (const e of validate.errors) {
        if (e.keyword === 'if') continue;
        err('SCHEMA', UI_MAP_REL, describeAjvError(e));
      }
    } else {
      map = mapRaw;
    }
  }

  // ---- prototype.html: scan ------------------------------------------------------------------
  let html = null;
  let htmlBuf = null;
  if (!fs.existsSync(htmlPath)) {
    err('MISSING-PROTOTYPE', PROTOTYPE_REL, 'file not found');
  } else {
    htmlBuf = fs.readFileSync(htmlPath);
    html = scanHtml(htmlBuf.toString('utf8'));
  }

  let htmlAnchorIds = null; // Map id -> [lines] for ids that look like anchors
  if (html) {
    htmlAnchorIds = new Map();
    for (const { id, line } of html.ids) {
      if (!ANCHOR_RE.test(id)) continue;
      if (!htmlAnchorIds.has(id)) htmlAnchorIds.set(id, []);
      htmlAnchorIds.get(id).push(line);
    }
    for (const [id, lines] of htmlAnchorIds) {
      if (lines.length > 1) err('DUP-ID-IN-HTML', PROTOTYPE_REL, `id "${id}" appears ${lines.length} times (lines ${lines.join(', ')})`);
    }
    for (const n of html.network) err('NETWORK-URL', PROTOTYPE_REL, `line ${n.line}: ${n.what}`);

    if (html.metaVersions.length === 0) {
      err('UI-VERSION-MISSING', PROTOTYPE_REL, 'missing <meta name="aidlc-ui-version" content="...">');
    } else if (map) {
      for (const content of html.metaVersions) {
        if (content !== String(map.uiVersion)) {
          err('UI-VERSION-MISMATCH', PROTOTYPE_REL, `aidlc-ui-version is "${content}" but ui-map.json uiVersion is ${map.uiVersion}`);
        }
      }
    }
  }

  // ---- questions files -----------------------------------------------------------------------
  // A sketch has no questions (ANCHORS.md section 2c): nothing is read.
  const questionFiles = (sketch ? [] : findQuestionFiles(recordDir)).map((full) => {
    const rel = toPosix(path.relative(recordDir, full));
    const parsed = parseQuestions(fs.readFileSync(full, 'utf8'));
    return { rel, stem: path.basename(full, '.md'), ...parsed };
  });
  for (const qf of questionFiles) {
    for (const p of qf.problems) (p.level === 'warn' ? warn : err)(p.code, qf.rel, p.message);
  }
  if (!sketch) {
    const sv = mapRaw && typeof mapRaw === 'object' ? mapRaw.schemaVersion : undefined;
    checkKinds(questionFiles, { schemaAtLeast12: schemaAtLeast(sv, 1, 2) }, err, warn);
  }

  // ---- cross-file checks (need a schema-valid map) -------------------------------------------
  if (map) {
    const screenIds = new Set();
    for (const s of map.screens) {
      if (screenIds.has(s.id)) err('DUP-SCREEN', UI_MAP_REL, `screen id "${s.id}" appears more than once`);
      screenIds.add(s.id);
    }
    for (const f of map.flows || []) {
      for (const step of f.steps) {
        if (!screenIds.has(step)) err('UNKNOWN-SCREEN', UI_MAP_REL, `flow "${f.id}" step "${step}" is not in screens[]`);
      }
    }

    const moduleIds = new Set();
    for (const m of map.modules) {
      if (moduleIds.has(m.id)) err('DUP-MODULE', UI_MAP_REL, `module id "${m.id}" appears more than once`);
      moduleIds.add(m.id);
    }
    const catalogIds = map.modules.filter((m) => m.source === 'catalog').map((m) => m.id).sort((a, b) => b.length - a.length);

    const resolve = (ref) => {
      const m = QUESTION_REF_RE.exec(ref);
      if (!m) return false;
      const n = Number(m[2]);
      return questionFiles.some((qf) => qf.stem === m[1] && qf.numbers.has(n));
    };

    const elementIds = new Set();
    for (const el of map.elements) {
      if (elementIds.has(el.id)) err('DUP-ELEMENT', UI_MAP_REL, `element id "${el.id}" appears more than once`);
      elementIds.add(el.id);

      if (!screenIds.has(el.screen)) err('UNKNOWN-SCREEN', UI_MAP_REL, `element "${el.id}": screen "${el.screen}" is not in screens[]`);
      if (htmlAnchorIds && !htmlAnchorIds.has(el.id)) {
        err('ELEMENT-NOT-IN-HTML', UI_MAP_REL, `element "${el.id}" has no id="${el.id}" in prototype.html`);
      }
      if (el.module !== null && !moduleIds.has(el.module)) {
        err('MODULE-NOT-LISTED', UI_MAP_REL, `element "${el.id}": module "${el.module}" is not listed in modules[]`);
      }
      const owner = catalogIds.find((mid) => el.id === `a-${mid}` || el.id.startsWith(`a-${mid}-`));
      if (owner !== undefined && el.module !== owner) {
        err('MODULE-PREFIX', UI_MAP_REL, `element "${el.id}" starts with catalog module id "${owner}" but its module is ${el.module === null ? 'null' : `"${el.module}"`}`);
      }
      for (const ref of sketch ? [] : el.questionIds) {
        if (!resolve(ref)) err('QUESTION-REF-UNRESOLVED', UI_MAP_REL, `element "${el.id}": question reference "${ref}" does not resolve to a "## Q<n>." heading`);
      }
    }

    // Rule 8 (ANCHORS.md section 5): catalog modules are mounted only by the Canvas palette.
    // `mounted` absent means false, also in schemaVersion 1.0 files.
    for (const m of map.modules) {
      if (m.source !== 'catalog') continue;
      const own = map.elements.filter((el) => el.module === m.id);
      if (m.mounted === true) {
        if (own.length === 0) err('MODULE-MOUNTED-NO-ELEMENT', UI_MAP_REL, `catalog module "${m.id}" is mounted: true but no element has module "${m.id}"`);
        continue;
      }
      for (const el of own) {
        err('MODULE-UNMOUNTED-HAS-ELEMENT', UI_MAP_REL, `catalog module "${m.id}" is not mounted (mounted is ${m.mounted === false ? 'false' : 'absent'}) but element "${el.id}" has module "${m.id}"`);
      }
      if (htmlAnchorIds) {
        for (const [id, lines] of htmlAnchorIds) {
          if (id === `a-${m.id}` || id.startsWith(`a-${m.id}-`)) {
            err('MODULE-UNMOUNTED-PREFIX-ID', PROTOTYPE_REL, `line ${lines[0]}: id "${id}" uses the prefix of catalog module "${m.id}", which is not mounted`);
          }
        }
      }
    }
    for (const m of map.modules) {
      for (const ref of sketch ? [] : m.questionIds || []) {
        if (!resolve(ref)) err('QUESTION-REF-UNRESOLVED', UI_MAP_REL, `module "${m.id}": question reference "${ref}" does not resolve to a "## Q<n>." heading`);
      }
    }

    // [Anchor]: targets must exist in elements[]
    const usedAnchors = new Set();
    for (const qf of questionFiles) {
      for (const a of qf.anchors) {
        usedAnchors.add(a.id);
        if (!elementIds.has(a.id)) {
          err('ANCHOR-NOT-IN-MAP', qf.rel, `line ${a.line}: [Anchor]: ${a.id} (Q${a.n}) is not in ui-map.json elements[]`);
        }
      }
    }

    // Warnings: anchored elements no question uses (elements with "questions": false are not meant to have one)
    const optedOut = new Set(map.elements.filter((el) => el.questions === false).map((el) => el.id));
    if (htmlAnchorIds) {
      for (const id of htmlAnchorIds.keys()) {
        if (!elementIds.has(id)) warn('UNMAPPED-ANCHOR', PROTOTYPE_REL, `id "${id}" looks like an anchor but is not in ui-map.json elements[]`);
        else if (!sketch && !usedAnchors.has(id) && !optedOut.has(id)) warn('UNUSED-ANCHOR', PROTOTYPE_REL, `anchored element "${id}" is not used by any [Anchor]: line`);
      }
    }
  }

  // ---- assumptions[] (schemaVersion 1.2, ANCHORS.md section 6.2) -------------------------------
  if (map && !sketch) checkAssumptions(map, questionFiles, UI_MAP_REL, err, warn);

  // ---- versions/ and quality/ of the living ui/ directory (ANCHORS.md section 6.1) -------------
  if (!sketch) {
    checkVersions(recordDir, err, warn);
    checkQuality(recordDir, err);
  }

  // ---- rule 9: #aidlc-effects ------------------------------------------------------------------
  if (html) {
    const sv = mapRaw && typeof mapRaw === 'object' ? mapRaw.schemaVersion : undefined;
    checkEffects({ html, map, questionFiles, sketch, PROTOTYPE_REL, err, warn, schemaAtLeast12: schemaAtLeast(sv, 1, 2) });
  }

  // ---- freeze record -------------------------------------------------------------------------
  if (opts.checkFreeze) {
    checkFreeze(recordDir, { map, mapBuf, htmlBuf, layout }, err);
    if (map && !sketch) checkVisibleAnswers(recordDir, map, questionFiles, UI_MAP_REL, warn);
  }

  return { ok: errors.length === 0, errors, warnings, layout };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

/** True when a "<major>.<minor>" schemaVersion string is at least the given major.minor. */
function schemaAtLeast(sv, major, minor) {
  const m = typeof sv === 'string' ? /^([0-9]+)\.([0-9]+)$/.exec(sv) : null;
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a > major || (a === major && b >= minor);
}

const KIND_RE = /^(?:(quick)|(assumption)|(stock)|round-([1-9][0-9]*))$/;
const QUICK_STEM = 'intent-capture-questions';

/** Kind of a parsed question: { type: 'quick'|'assumption'|'stock'|'round'|'unknown'|null, line } (null = no [Kind]: line). */
function kindOf(meta) {
  if (!meta || !meta.kind) return { type: null, line: 0 };
  const m = KIND_RE.exec(meta.kind.value);
  if (!m) return { type: 'unknown', line: meta.kind.line };
  return { type: m[1] ? 'quick' : m[2] ? 'assumption' : m[3] ? 'stock' : 'round', line: meta.kind.line };
}

/**
 * EV1: is question n of this file a UI question (its options must visibly change the screen)? Yes for [Kind]: round-<n>, and for a
 * question with no [Kind]: line in an intent-capture-questions file of a schemaVersion >= 1.2 record (how ui-brief writes the
 * round-1 questions). quick, assumption, stock and every unanchored question are exempt; the caller only asks for anchored ones.
 */
function isUiQuestion(qf, n, schemaAtLeast12) {
  const t = kindOf(qf.meta.get(n)).type;
  if (t === 'round') return true;
  return t === null && schemaAtLeast12 && qf.stem === QUICK_STEM;
}

/** Kind lines of every questions file (ANCHORS.md section 6.2): [Kind]:, [Assumed]:, [Source]:. */
function checkKinds(questionFiles, { schemaAtLeast12 }, err, warn) {
  for (const qf of questionFiles) {
    const at = (line, msg) => `line ${line}: ${msg}`;
    for (const [n, m] of [...qf.meta].sort((a, b) => a[0] - b[0])) {
      const k = kindOf(m);
      const opts = qf.options.get(n) || new Set();
      if (k.type === 'quick') {
        if (qf.stem !== QUICK_STEM || n > 3) {
          err('KIND-QUICK-WRONG-PLACE', qf.rel, at(k.line, `[Kind]: quick is only allowed for Q1-Q3 of ${QUICK_STEM}.md (found Q${n} of ${qf.stem}.md)`));
        }
        if (m.anchor !== null) err('KIND-QUICK-HAS-ANCHOR', qf.rel, at(k.line, `question Q${n} is [Kind]: quick and must not have an [Anchor]: line`));
      }
      if (k.type === 'assumption') {
        if (m.assumed === null) {
          err('ASSUMED-MISSING', qf.rel, at(k.line, `question Q${n} is [Kind]: assumption but has no [Assumed]: <A-D> line`));
        }
      }
      if (m.assumed !== null) {
        if (k.type !== 'assumption' && k.type !== 'unknown') {
          err('ASSUMED-WITHOUT-KIND', qf.rel, at(m.assumed.line, `question Q${n} has [Assumed]: but no [Kind]: assumption`));
        }
        const letter = m.assumed.value;
        if (!/^[A-D]$/.test(letter)) {
          err('ASSUMED-BAD-LETTER', qf.rel, at(m.assumed.line, `[Assumed]: "${letter.slice(0, 20)}" of Q${n} is not an option letter A-D`));
        } else if (!opts.has(letter)) {
          err('ASSUMED-BAD-LETTER', qf.rel, at(m.assumed.line, `[Assumed]: ${letter} of Q${n} is not one of its options (${[...opts].sort().join(', ') || 'none'})`));
        }
      }
      if (m.source !== null && m.source.value !== 'canvas-round') {
        err('SOURCE-UNKNOWN', qf.rel, at(m.source.line, `[Source]: "${m.source.value.slice(0, 40)}" of Q${n} is not canvas-round`));
      } else if (k.type !== 'unknown') {
        if (k.type === 'round' && m.source === null) {
          err('SOURCE-KIND-MISMATCH', qf.rel, at(k.line, `question Q${n} is [Kind]: ${m.kind.value} but has no [Source]: canvas-round line`));
        } else if (k.type !== 'round' && m.source !== null) {
          err('SOURCE-KIND-MISMATCH', qf.rel, at(m.source.line, `question Q${n} has [Source]: canvas-round but ${k.type === null ? 'no [Kind]: line' : `[Kind]: ${m.kind.value}`} (expected round-<n>)`));
        }
      }
    }
    if (schemaAtLeast12 && qf.stem === QUICK_STEM) {
      const missing = [1, 2, 3].filter((n) => kindOf(qf.meta.get(n)).type !== 'quick').map((n) => `Q${n}`);
      if (missing.length) warn('QUICK-MISSING', qf.rel, `Q1-Q3 must be [Kind]: quick (ANCHORS.md section 6.2); missing on ${missing.join(', ')}`);
    }
  }
}

/** assumptions[] of ui-map.json against the [Kind]: assumption questions. Needs a schema-valid map. */
function checkAssumptions(map, questionFiles, mapRel, err, warn) {
  const seen = new Set();
  const listed = new Set();
  for (const a of map.assumptions || []) {
    if (seen.has(a.id)) err('ASSUMPTION-DUP', mapRel, `assumption id "${a.id}" appears more than once`);
    seen.add(a.id);
    listed.add(a.question);
    const m = QUESTION_REF_RE.exec(a.question);
    const qf = m && questionFiles.find((f) => f.stem === m[1] && f.numbers.has(Number(m[2])));
    const meta = qf ? qf.meta.get(Number(m[2])) : null;
    if (!qf) {
      err('ASSUMPTION-UNRESOLVED', mapRel, `assumption "${a.id}": question "${a.question}" does not resolve to a "## Q<n>." heading`);
    } else if (kindOf(meta).type !== 'assumption') {
      err('ASSUMPTION-UNRESOLVED', mapRel, `assumption "${a.id}": question "${a.question}" (${qf.rel}) does not carry [Kind]: assumption`);
    } else if (meta.assumed !== null && meta.assumed.value !== a.assumed) {
      err('ASSUMPTION-LETTER-MISMATCH', mapRel, `assumption "${a.id}": assumed is "${a.assumed}" but ${qf.rel} line ${meta.assumed.line} has [Assumed]: ${meta.assumed.value}`);
    }
  }
  for (const qf of questionFiles) {
    for (const [n, meta] of [...qf.meta].sort((x, y) => x[0] - y[0])) {
      if (kindOf(meta).type === 'assumption' && !listed.has(`${qf.stem}#Q${n}`)) {
        warn('ASSUMPTION-NOT-LISTED', qf.rel, `line ${meta.kind.line}: question Q${n} is [Kind]: assumption but ui-map.json assumptions[] has no entry for "${qf.stem}#Q${n}"`);
      }
    }
  }
}

const ISO_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;
const CAUSE_KINDS = ['agent-stage', 'answer', 'round', 'refine', 'restore'];

/** Problems of one versions/v<N>/meta.json object (ANCHORS.md section 6.1); empty = valid. */
function metaProblems(meta, N) {
  const out = [];
  if (!isObj(meta)) return ['meta.json is not a JSON object'];
  if (meta.version !== N) out.push(`"version" must be ${N} (found ${JSON.stringify(meta.version)})`);
  const parent = N === 1 ? null : N - 1;
  if (meta.parent !== parent) out.push(`"parent" must be ${parent === null ? 'null' : parent} (found ${JSON.stringify(meta.parent)})`);
  if (typeof meta.createdAt !== 'string' || !ISO_RE.test(meta.createdAt) || Number.isNaN(Date.parse(meta.createdAt))) {
    out.push(`"createdAt" must be an ISO 8601 date-time (found ${JSON.stringify(meta.createdAt)})`);
  }
  const c = meta.cause;
  if (!isObj(c)) {
    out.push('"cause" must be an object {kind, stage, refs}');
  } else {
    if (!CAUSE_KINDS.includes(c.kind)) out.push(`"cause.kind" must be one of ${CAUSE_KINDS.join(', ')} (found ${JSON.stringify(c.kind)})`);
    if (typeof c.stage !== 'string') out.push('"cause.stage" must be a string');
    if (!Array.isArray(c.refs) || !c.refs.every((r) => typeof r === 'string')) out.push('"cause.refs" must be an array of strings');
  }
  return out;
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** <record>/ui/versions/v<N>/ (ANCHORS.md section 6.1). Skipped when the directory does not exist. */
function checkVersions(recordDir, err, warn) {
  const root = path.join(recordDir, ...VERSIONS_REL.split('/'));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return;
  const versions = listDir(root)
    .filter((e) => e.isDirectory() && /^v[1-9][0-9]*$/.test(e.name))
    .map((e) => Number(e.name.slice(1)))
    .sort((a, b) => a - b);
  let highestWithProto = null;
  for (const N of versions) {
    const rel = `${VERSIONS_REL}/v${N}`;
    for (const f of ['prototype.html', 'ui-map.json', 'meta.json']) {
      if (!fs.existsSync(path.join(root, `v${N}`, f))) err('VERSION-FILE-MISSING', `${rel}/${f}`, 'file not found');
    }
    if (fs.existsSync(path.join(root, `v${N}`, 'prototype.html'))) highestWithProto = N;
    const metaPath = path.join(root, `v${N}`, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try {
      meta = readJsonText(fs.readFileSync(metaPath));
    } catch (e) {
      err('VERSION-META-INVALID', `${rel}/meta.json`, `invalid JSON: ${e.message}`);
      continue;
    }
    for (const p of metaProblems(meta, N)) err('VERSION-META-INVALID', `${rel}/meta.json`, p);
  }
  const livePath = path.join(recordDir, ...LAYOUTS.ui.prototype.split('/'));
  if (highestWithProto !== null && fs.existsSync(livePath)) {
    const top = fs.readFileSync(path.join(root, `v${highestWithProto}`, 'prototype.html'));
    if (!top.equals(fs.readFileSync(livePath))) {
      warn('VERSION-LATEST-MISMATCH', LAYOUTS.ui.prototype, `differs from ${VERSIONS_REL}/v${highestWithProto}/prototype.html (the highest version)`);
    }
  }
}

/** <record>/ui/quality/v<N>.json: shape only, pass or fail is not judged here (ANCHORS.md section 6.1, D-33). */
function checkQuality(recordDir, err) {
  const root = path.join(recordDir, ...QUALITY_REL.split('/'));
  for (const e of listDir(root)) {
    const m = e.isFile() ? /^v([1-9][0-9]*)\.json$/.exec(e.name) : null;
    if (!m) continue;
    const N = Number(m[1]);
    const rel = `${QUALITY_REL}/${e.name}`;
    let q;
    try {
      q = readJsonText(fs.readFileSync(path.join(root, e.name)));
    } catch (ex) {
      err('QUALITY-FILE-INVALID', rel, `invalid JSON: ${ex.message}`);
      continue;
    }
    if (!isObj(q)) {
      err('QUALITY-FILE-INVALID', rel, 'not a JSON object');
      continue;
    }
    if (!Number.isInteger(q.version)) err('QUALITY-FILE-INVALID', rel, '"version" must be an integer');
    else if (q.version !== N) err('QUALITY-FILE-INVALID', rel, `"version" is ${q.version} but the file name says ${N}`);
    if (typeof q.pass !== 'boolean') err('QUALITY-FILE-INVALID', rel, '"pass" must be a boolean');
    if (!Array.isArray(q.issues)) err('QUALITY-FILE-INVALID', rel, '"issues" must be an array');
  }
}

/** Why a CSS selector could leave its target element, or null (ANCHORS.md section 2b, bin/README.md). */
function selectorEscape(sel) {
  if (/:root|:scope/i.test(sel)) return 'contains :root or :scope';
  if (/(?:^|[\s>+~,(])(?:html|body)(?![\w-])/i.test(sel)) return 'selects html or body';
  if (sel.includes('<')) return 'contains "<"';
  if (/(?:^|,)\s*[>+~]/.test(sel)) return 'starts with a combinator (> + ~)';
  return null;
}

/** Validate one op; returns a list of problems as { code, message } (empty = valid). */
function checkOp(op, where, elementIds) {
  const out = [];
  if (!isObj(op)) return [{ code: 'EFFECTS-BAD-OP', message: `${where} is not an object` }];
  if (typeof op.op !== 'string') return [{ code: 'EFFECTS-BAD-OP', message: `${where} has no "op" string` }];
  const spec = EFFECT_OPS[op.op];
  if (!spec) {
    return [{ code: 'EFFECTS-UNKNOWN-OP', message: `${where} uses op "${op.op}"; allowed: ${Object.keys(EFFECT_OPS).join(', ')}` }];
  }
  for (const k of Object.keys(op)) {
    if (k !== 'op' && !spec.req.includes(k) && !spec.opt.includes(k)) {
      out.push({ code: 'EFFECTS-BAD-OP', message: `${where} (${op.op}) has unknown field "${k}"` });
    }
  }
  for (const k of spec.req) {
    if (!isStr(op[k])) out.push({ code: 'EFFECTS-BAD-OP', message: `${where} (${op.op}) needs a non-empty string "${k}"` });
  }
  if (op.selector !== undefined) {
    if (!isStr(op.selector)) out.push({ code: 'EFFECTS-BAD-OP', message: `${where} (${op.op}) "selector" must be a non-empty string` });
    else {
      const why = selectorEscape(op.selector);
      if (why) out.push({ code: 'EFFECTS-SELECTOR-ESCAPE', message: `${where} selector "${op.selector}" could leave the target: ${why}` });
    }
  }
  if (op.op === 'class') {
    const okTokens = (v) => isStr(v) || (Array.isArray(v) && v.length > 0 && v.every(isStr));
    for (const k of ['add', 'remove']) {
      if (op[k] !== undefined && !okTokens(op[k])) out.push({ code: 'EFFECTS-BAD-OP', message: `${where} (class) "${k}" must be a class name or a non-empty array of class names` });
    }
    if (op.add === undefined && op.remove === undefined) out.push({ code: 'EFFECTS-BAD-OP', message: `${where} (class) needs "add" or "remove"` });
  }
  if (elementIds && isStr(op.target) && !elementIds.has(op.target)) {
    out.push({ code: 'EFFECTS-UNKNOWN-TARGET', message: `${where} target "${op.target}" is not in ui-map.json elements[]` });
  }
  return out;
}

/**
 * Rule 9: the #aidlc-effects block (ANCHORS.md section 2b). Errors in a record, warnings in a sketch dir.
 * Question checks (references, coverage) need questions, so a sketch skips them.
 */
function checkEffects({ html, map, questionFiles, sketch, PROTOTYPE_REL, err, warn, schemaAtLeast12 = false }) {
  const report = (code, message) => (sketch ? warn : err)(code, PROTOTYPE_REL, message);
  const blocks = html.effects;
  if (blocks.length === 0) {
    report('EFFECTS-MISSING', 'missing <script type="application/json" id="aidlc-effects"> block');
    return;
  }
  if (blocks.length > 1) {
    report('EFFECTS-DUPLICATE', `${blocks.length} #aidlc-effects blocks (lines ${blocks.map((b) => b.line).join(', ')}); exactly one is allowed`);
  }
  const block = blocks[0];
  if (block.type === null || block.type.trim().toLowerCase() !== 'application/json') {
    report('EFFECTS-BAD-JSON', `line ${block.line}: #aidlc-effects must have type="application/json" (found ${block.type === null ? 'no type' : `"${block.type}"`})`);
    return;
  }
  let data;
  try {
    data = JSON.parse(block.text.replace(/^\s*\ufeff/, ''));
  } catch (e) {
    report('EFFECTS-BAD-JSON', `line ${block.line}: #aidlc-effects is not valid JSON: ${e.message}`);
    return;
  }
  if (!isObj(data) || !Array.isArray(data.effects)) {
    report('EFFECTS-BAD-JSON', `line ${block.line}: #aidlc-effects must be an object {"effects": [...]}`);
    return;
  }

  const elementIds = map ? new Set(map.elements.map((el) => el.id)) : null;
  const screenOf = map ? new Map(map.elements.map((el) => [el.id, el.screen])) : null;
  const resolve = (ref) => {
    const m = QUESTION_REF_RE.exec(ref);
    return !!m && questionFiles.some((qf) => qf.stem === m[1] && qf.numbers.has(Number(m[2])));
  };
  const anchorOf = new Map(); // question ref -> anchor id
  for (const qf of questionFiles) for (const a of qf.anchors) if (!anchorOf.has(`${qf.stem}#Q${a.n}`)) anchorOf.set(`${qf.stem}#Q${a.n}`, a.id);

  const covered = new Set(); // "<question ref>|<answer>" with at least one valid op
  const opsOf = new Map(); // "<question ref>|<letter A-D>" -> every op of the entries for that option (EV1 visible-change rule)
  data.effects.forEach((entry, i) => {
    const at = `effects[${i}]`;
    if (!isObj(entry)) {
      report('EFFECTS-BAD-ENTRY', `${at} is not an object`);
      return;
    }
    const qOk = isStr(entry.question);
    if (!qOk) report('EFFECTS-BAD-ENTRY', `${at} has no "question" reference string`);
    if (typeof entry.answer !== 'string' || !EFFECT_ANSWERS.has(entry.answer)) {
      report('EFFECTS-BAD-ENTRY', `${at} "answer" must be one of A, B, C, D or "*" (found ${JSON.stringify(entry.answer)})`);
    }
    const opsOk = Array.isArray(entry.ops) && entry.ops.length > 0;
    if (!opsOk) report('EFFECTS-BAD-ENTRY', `${at} "ops" must be a non-empty array`);
    if (qOk && !sketch && !resolve(entry.question)) {
      report('EFFECTS-UNKNOWN-QUESTION', `${at} question "${entry.question}" does not resolve to a "## Q<n>." heading`);
    }
    if (!opsOk) return;
    let valid = 0;
    entry.ops.forEach((op, j) => {
      const where = `${at}.ops[${j}]`;
      const problems = checkOp(op, where, elementIds);
      for (const p of problems) report(p.code, p.message);
      if (problems.length === 0) {
        valid++;
        const anchorId = qOk ? anchorOf.get(entry.question) : undefined;
        if (screenOf && anchorId !== undefined && screenOf.has(anchorId) && screenOf.has(op.target)) {
          const a = screenOf.get(anchorId);
          const t = screenOf.get(op.target);
          if (a !== t && a !== 'shell' && t !== 'shell') {
            warn('EFFECTS-OFF-SCREEN', PROTOTYPE_REL, `${at}.ops[${j}] target "${op.target}" is on screen "${t}" but the question's anchor "${anchorId}" is on screen "${a}"`);
          }
        }
      }
    });
    if (valid > 0 && qOk && typeof entry.answer === 'string') covered.add(`${entry.question}|${entry.answer}`);
    if (qOk && typeof entry.answer === 'string' && OPTION_LETTERS.includes(entry.answer)) {
      const k = `${entry.question}|${entry.answer}`;
      opsOf.set(k, (opsOf.get(k) || []).concat(entry.ops.filter(isObj)));
    }
  });

  // Coverage: every option of every anchored question has a visible effect (a sketch has no questions).
  if (sketch) return;
  const seen = new Set();
  for (const qf of questionFiles) {
    for (const a of qf.anchors) {
      const ref = `${qf.stem}#Q${a.n}`;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const opts = qf.options.get(a.n) || new Set();
      for (const L of OPTION_LETTERS) {
        if (opts.has(L) && !covered.has(`${ref}|${L}`)) {
          report('EFFECTS-COVERAGE', `question "${ref}" (anchor ${a.id}): option ${L} has no effects entry with at least one op`);
        }
      }
      if (opts.has('X') && !covered.has(`${ref}|*`)) {
        report('EFFECTS-COVERAGE', `question "${ref}" (anchor ${a.id}): option X has no effects entry with answer "*"`);
      }
      // EV1: a UI question (round-<n>, or anchored without [Kind]: in an intent-capture file of schema >= 1.2) must change the screen.
      if (isUiQuestion(qf, a.n, schemaAtLeast12)) {
        const perOption = {};
        for (const L of OPTION_LETTERS) if (opts.has(L) && opsOf.has(`${ref}|${L}`)) perOption[L] = opsOf.get(`${ref}|${L}`);
        for (const p of visibleEffectsProblems(perOption)) {
          report(p.code, `question "${ref}" (anchor ${a.id}): ${p.message}`);
        }
      }
    }
  }
}

function lastMatch(text, re) {
  let last = null;
  let m;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(text))) last = m;
  return last;
}

/** Parse the ui-freeze record (tolerant). The last occurrence of each line wins. */
function parseFreezeRecord(text) {
  const pre = '^[ \\t>]*(?:[-*+][ \\t]+)?(?:\\*\\*)?';
  const val = '(?:\\*\\*)?[ \\t]*`?';
  const post = '`?[ \\t]*$';
  const ver = lastMatch(text, new RegExp(`${pre}\`?uiVersion\`?(?:\\*\\*)?[ \\t]*:${val}([0-9]+)${post}`, 'im'));
  const proto = lastMatch(text, new RegExp(`${pre}\`?prototype\\.html sha256\`?(?:\\*\\*)?[ \\t]*:${val}([0-9a-fA-F]{64})${post}`, 'im'));
  const uimap = lastMatch(text, new RegExp(`${pre}\`?ui-map\\.json sha256\`?(?:\\*\\*)?[ \\t]*:${val}([0-9a-fA-F]{64})${post}`, 'im'));
  return {
    uiVersion: ver ? Number(ver[1]) : null,
    prototypeSha256: proto ? proto[1].toLowerCase() : null,
    uiMapSha256: uimap ? uimap[1].toLowerCase() : null,
  };
}

/**
 * Freeze-time warning: an answered question that has an [Anchor]: (it is about a visible element) must
 * be on a published ui version (versions/v<N>/meta.json cause.refs) and its anchor must be in
 * ui-map.json. Otherwise the person approves a UI that does not show their answer.
 * Questions without an anchor are not checked: nothing in the record says they have a visible effect.
 */
function checkVisibleAnswers(recordDir, map, questionFiles, UI_MAP_REL, warn) {
  const root = path.join(recordDir, ...VERSIONS_REL.split('/'));
  const refs = new Set();
  for (const e of listDir(root)) {
    if (!e.isDirectory() || !/^v[1-9][0-9]*$/.test(e.name)) continue;
    try {
      const m = readJsonText(fs.readFileSync(path.join(root, e.name, 'meta.json')));
      for (const r of (m && m.cause && m.cause.refs) || []) refs.add(String(r).replace(/\.md#/, '#'));
    } catch { /* checkVersions reports a broken meta.json */ }
  }
  if (refs.size === 0 && listDir(root).length === 0) return; // record without versions/: nothing to compare
  const elementIds = new Set((map.elements || []).map((el) => el.id));
  const missing = [];
  for (const qf of questionFiles) {
    for (const [n, a] of qf.meta ? [...qf.meta] : []) {
      if (!a.anchor || !qf.answers.has(n)) continue;
      const id = `${qf.stem}#Q${n}`;
      if (!elementIds.has(a.anchor) || !refs.has(id)) missing.push(id);
    }
  }
  if (missing.length) {
    warn('ANSWER-NOT-IN-UI', UI_MAP_REL, `answered question(s) with a visible element are not on any ui version or point to an unknown anchor: ${missing.join(', ')}. Redraw ui/ and publish a version with --ref, or tell the person before they approve`);
  }
}

function checkFreeze(recordDir, cur, err) {
  const freezePath = path.join(recordDir, FREEZE_REL);
  if (!fs.existsSync(freezePath)) {
    err('FREEZE-RECORD-MISSING', FREEZE_REL, 'file not found');
    return;
  }
  if (cur.layout === 'ui') {
    const mo = path.join(recordDir, ...MOCK_ONLY_REL.split('/'));
    if (!fs.existsSync(mo) || fs.readFileSync(mo, 'utf8').trim() === '') {
      err('FREEZE-MOCK-ONLY-MISSING', MOCK_ONLY_REL, 'file missing or empty; list the data hard-coded in ui/ that the backend will not give (write "None" when there is none)');
    }
  }
  const rec = parseFreezeRecord(fs.readFileSync(freezePath, 'utf8'));
  const missing = [];
  if (rec.uiVersion === null) missing.push('"uiVersion: <N>"');
  if (rec.prototypeSha256 === null) missing.push('"prototype.html sha256: <64 hex>"');
  if (rec.uiMapSha256 === null) missing.push('"ui-map.json sha256: <64 hex>"');
  if (missing.length) {
    err('FREEZE-RECORD-MISSING', FREEZE_REL, `record does not list ${missing.join(', ')}`);
  }
  if (rec.prototypeSha256 !== null && cur.htmlBuf) {
    const now = sha256(cur.htmlBuf);
    if (now !== rec.prototypeSha256) err('FREEZE-DIGEST-MISMATCH', FREEZE_REL, `prototype.html sha256 is ${now} but the freeze record lists ${rec.prototypeSha256}`);
  }
  if (rec.uiMapSha256 !== null && cur.mapBuf) {
    const now = sha256(cur.mapBuf);
    if (now !== rec.uiMapSha256) err('FREEZE-DIGEST-MISMATCH', FREEZE_REL, `ui-map.json sha256 is ${now} but the freeze record lists ${rec.uiMapSha256}`);
  }
  if (rec.uiVersion !== null && cur.map && cur.map.uiVersion !== rec.uiVersion) {
    err('FREEZE-VERSION-MISMATCH', FREEZE_REL, `ui-map.json uiVersion is ${cur.map.uiVersion} but the freeze record lists ${rec.uiVersion}`);
  }
}

/**
 * Digests of the rough-mockups files. Returns { digests } or { errors }.
 */
function printDigests(recordDir) {
  const errors = [];
  const layout = detectLayout(recordDir);
  const UI_MAP_REL = LAYOUTS[layout].uiMap;
  const PROTOTYPE_REL = LAYOUTS[layout].prototype;
  const mapPath = path.join(recordDir, UI_MAP_REL);
  const htmlPath = path.join(recordDir, PROTOTYPE_REL);
  let mapBuf = null;
  let htmlBuf = null;
  if (!fs.existsSync(mapPath)) errors.push({ code: 'MISSING-UI-MAP', file: UI_MAP_REL, message: 'file not found' });
  else mapBuf = fs.readFileSync(mapPath);
  if (!fs.existsSync(htmlPath)) errors.push({ code: 'MISSING-PROTOTYPE', file: PROTOTYPE_REL, message: 'file not found' });
  else htmlBuf = fs.readFileSync(htmlPath);
  let uiVersion = null;
  if (mapBuf) {
    try {
      const raw = readJsonText(mapBuf);
      if (raw && Number.isInteger(raw.uiVersion) && raw.uiVersion >= 1) uiVersion = raw.uiVersion;
      else errors.push({ code: 'SCHEMA', file: UI_MAP_REL, message: '/uiVersion missing or not a positive integer' });
    } catch (e) {
      errors.push({ code: 'SCHEMA', file: UI_MAP_REL, message: `invalid JSON: ${e.message}` });
    }
  }
  if (errors.length) return { errors };
  return { digests: { uiVersion, prototypeSha256: sha256(htmlBuf), uiMapSha256: sha256(mapBuf) } };
}

module.exports = { validateRecord, printDigests, parseQuestions, parseFreezeRecord, detectLayout, MOCKUP_DIR };
