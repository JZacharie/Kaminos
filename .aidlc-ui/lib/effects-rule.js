// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// EV1: a UI question must visibly change the screen (ANCHORS.md section 2b, "UI questions").
// Pure helpers shared by validate-record.js (rule 9) and ui-brief.js (--check). No I/O, no dependencies.
//
//   visibleEffectsProblems(perOption) -> [{ code, letters, message }]
//     perOption: array of ops arrays in option order (index 0 = A), or an object { A: [ops], B: [ops] }.
//     code is 'EFFECTS-BADGE-ONLY' or 'EFFECTS-IDENTICAL'; the caller adds its own prefix or file name.

const LETTERS = ['A', 'B', 'C', 'D'];

// Selectors that reach only the title area a block draws around its content (core.js: header.k-b-head >
// div.k-b-titles > h<n>.k-b-title + p.k-b-sub), plus the legacy kit title. A text op on these changes a heading, not content.
const TITLE_CLASS_RE = /\.(?:k-b-title|k-b-titles|k-b-sub|k-b-head|k-card-title)(?![\w-])/;

/** True when every comma-separated part of the selector ends in a block title class (the last compound decides). */
function isTitleOnlySelector(sel) {
  if (typeof sel !== 'string' || sel.trim() === '') return false;
  const parts = sel.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) => {
    const last = part.split(/[\s>+~]+/).filter(Boolean).pop() || '';
    return TITLE_CLASS_RE.test(last);
  });
}

/** True when the op changes something a person sees besides a badge: a text on real content, show, hide or class. */
function isVisibleOp(op) {
  if (op === null || typeof op !== 'object' || Array.isArray(op)) return false;
  if (op.op === 'badge') return false;
  if (op.op === 'text') return !isTitleOnlySelector(op.selector);
  return op.op === 'show' || op.op === 'hide' || op.op === 'class';
}

/** JSON with sorted object keys: equal ops give equal strings whatever the key order. */
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Canonical signature of an op list (order of the ops does not matter). */
function opsSignature(ops) {
  return canonical(ops.map(canonical).sort());
}

function toPairs(perOption) {
  if (Array.isArray(perOption)) return perOption.map((ops, i) => [LETTERS[i] || `#${i + 1}`, ops]);
  return Object.keys(perOption).sort().map((L) => [L, perOption[L]]);
}

/**
 * Problems of the effects of ONE UI question. An option whose ops are missing or not an array is skipped (other rules
 * report it). Options without any op are skipped too (the coverage rule reports them).
 */
function visibleEffectsProblems(perOption) {
  const out = [];
  const seen = new Map(); // signature -> letter
  for (const [L, ops] of toPairs(perOption)) {
    if (!Array.isArray(ops) || ops.length === 0) continue;
    if (!ops.some(isVisibleOp)) {
      const kinds = [...new Set(ops.map((o) => (o && o.op === 'text' ? 'text on a block title' : o && o.op) || 'unknown'))].join(', ');
      out.push({
        code: 'EFFECTS-BADGE-ONLY',
        letters: [L],
        message: `option ${L} changes nothing a person can see beyond a badge or a block title (ops: ${kinds}); add a text op on real content (a value, a label, a column, a status) or a show, hide or class op`,
      });
    }
    const sig = opsSignature(ops);
    if (seen.has(sig)) {
      out.push({
        code: 'EFFECTS-IDENTICAL',
        letters: [seen.get(sig), L],
        message: `options ${seen.get(sig)} and ${L} have identical effects; the two answers would show the same screen`,
      });
    } else seen.set(sig, L);
  }
  return out;
}

module.exports = { isTitleOnlySelector, isVisibleOp, opsSignature, visibleEffectsProblems, TITLE_CLASS_RE };
