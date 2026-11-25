// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared constants of the quality gate (addon/bin/quality-gate). Decisions: D-33, amended by D-36.

/** Widths (px) that BLOCK the gate (D-36). */
export const DESKTOP_WIDTHS = [1280, 1440];
/** Widths (px) that are measured but only produce warnings (D-36). Tablet first, then phone. */
/** B1-T5: extra blocking widths that only run the layout checks (broken words, narrow rows, header wrap, text outside its card). 1324 px is the width of the real Stagehand event. */
export const LAYOUT_WIDTHS = [1324, 1920];
export const SOFT_WIDTHS = [768, 375];
export const VIEWPORT_HEIGHT = 900;

/** Check names. Same list as CHECKS in addon/lib/progress.js (the `critic` check is also a progress phase). */
export const CHECKS = ['console', 'overflow', 'axe', 'lighthouse', 'network', 'data', 'critic'];
export const DETERMINISTIC_CHECKS = ['console', 'overflow', 'axe', 'lighthouse', 'network', 'data'];

export const MIN_TABLE_ROWS = 12;
export const MIN_LIST_ITEMS = 3;
export const LIGHTHOUSE_MIN_SCORE = 90;
/** Budget (ms) for the non-critic checks. Soft-width axe passes are skipped (with a warning) when it is exceeded. */
export const DEFAULT_BUDGET_MS = 45_000;
/** Max Lighthouse runs in parallel against the shared Chrome. */
export const LIGHTHOUSE_CONCURRENCY = 3;

/** Visible-text placeholder patterns. [id label, regex source, flags]. Matched per visible text node. */
export const PLACEHOLDER_PATTERNS = [
  ['lorem ipsum', 'lorem ipsum', 'i'],
  ['Item <n>', '\\bItem \\d+\\b', ''],
  ['Test <n>', '\\bTest \\d+\\b', ''],
  ['foo', '\\bfoo\\b', 'i'],
  ['foo bar / bar baz', '\\b(foo ?bar|bar ?baz)\\b', 'i'],
  ['bar', '^\\s*bar\\s*$', 'i'],
  ['TODO', '\\bTODO\\b', ''],
  ['placeholder', '\\bplaceholder\\b', 'i'],
  ['sample text', '\\bsample text\\b', 'i'],
  ['John/Jane Doe', '\\b(John|Jane) Doe\\b', 'i'],
  ['xxx', '\\bx{3,}\\b', 'i'],
];

// ---- Vision critic ---------------------------------------------------------------------------------------------
export const CRITERIA = ['hierarchy', 'realism', 'consistency', 'readability', 'layout', 'fit'];
export const CRITERIA_LABELS = {
  hierarchy: 'Visual hierarchy',
  realism: 'Domain realism',
  consistency: 'Consistency with the kit',
  readability: 'Readability',
  layout: 'Layout at laptop widths (1280/1440)',
  fit: 'Fit to the idea',
};
export const DEFAULT_CRITIC_MODEL = 'global.anthropic.claude-sonnet-5-5';
// Other model that works with the same call: 'global.anthropic.claude-opus-5-5' (set UI_CRITIC_MODEL or --critic-model).
export const CRITIC_TEMPERATURE = 0;
// The task text says 900; the JSON of 6 criteria with reasons and fix hints is longer than that on a bad UI, and a truncated
// answer is invalid JSON, so the limit is 1500. The cost impact is below 0.01 USD.
export const CRITIC_MAX_TOKENS = 1500;
export const CRITIC_MAX_ROUTES = 6;
export const CRITIC_JPEG_QUALITY = 80;
/** Full-page screenshots are cut at this height (px) so one image stays small and under the model's image limits. */
export const CRITIC_MAX_SHOT_HEIGHT = 3600;
// A28 (the product owner 2026-11-04): pass from mean 3.8 (was 4.0). A27 run 3 never reached 4.0 in six rounds.
export const CRITIC_PASS_MEAN = 3.8;
/** A28: the critic can block only in its first N rounds (calls on the same quality/v<N>.json). From round N+1 its findings are hints. */
export const CRITIC_BLOCKING_ROUNDS = 2;

/**
 * Repair profile (env AIDLC_GATE_MAX_ROUNDS). Default 2 = the speed profile: 2 repair rounds, then hand over. A number N = N rounds. 0 or "unlimited" = quality profile:
 * keep repairing until the gate passes or two consecutive rounds bring no fewer findings (plateau). Anything else falls back to 2.
 * Returns { unlimited, rounds } (rounds is Infinity when unlimited).
 */
export function parseMaxRounds(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'unlimited' || s === '0') return { unlimited: true, rounds: Infinity };
  return { unlimited: false, rounds: /^[1-9]\d{0,2}$/.test(s) ? Number(s) : 2 };
}
/** How many critic calls on the same quality/v<N>.json may block: 2 by default, more with more repair rounds, always in unlimited mode. */
export function criticBlockingRounds(mode = parseMaxRounds(process.env.AIDLC_GATE_MAX_ROUNDS)) {
  return mode.unlimited ? Infinity : Math.max(CRITIC_BLOCKING_ROUNDS, Math.ceil(mode.rounds / 2) + 1);
}
export const CRITIC_MIN_SCORE = 3;
/** Fix hints are required (and an issue is created) for scores up to this value. */
export const CRITIC_ISSUE_MAX_SCORE = 3;
// ASSUMPTION (not read from Bedrock): USD per million tokens of Sonnet-class models. Token counts come from the Bedrock usage
// field. For another model set UI_CRITIC_PRICE_IN_PER_M / UI_CRITIC_PRICE_OUT_PER_M.
export const PRICE_IN_PER_M = 3.0;
export const PRICE_OUT_PER_M = 15.0;
/** The gate prints a warning when one critic call costs more than this (no hard cap, the product owner 2026-11-04). */
export const CRITIC_COST_WARN_USD = 0.3;

// ---- Golden reference (D-37) -------------------------------------------------------------------------------------------
/** Default reference dir, relative to the add-on root (installed: .aidlc-ui/kit/examples/spudtrack). Images: <dir>/screenshots/*.png|jpg. */
export const DEFAULT_REFERENCE_SUBDIR = ['kit', 'examples', 'spudtrack'];
export const REFERENCE_MAX_IMAGES = 4;
export const PARITY_VERDICTS = ['below', 'close', 'equal', 'above'];
