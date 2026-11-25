// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// B1-T5b: bound the repair loop. quality/state-v<N>.json remembers how many times (gate runs at least MIN_GAP_MS apart) each finding has been seen.
// A finding that is still there after 3 evaluations (the first one plus two repair rounds), or after 2 for a vision-critic finding (one repair round),
// is listed under `handover` in v<N>.json and as a HANDOVER line: the stage text stops repairing it and reports it instead of looping.
// AIDLC_GATE_MAX_ROUNDS=N changes the 2; 0 or "unlimited" removes the count and stops only on a PLATEAU: two consecutive rounds (gate runs MIN_GAP_MS apart) that did not
// bring fewer findings than the round before. Then every remaining finding is handed over (reason "plateau").
import { readFileSync, writeFileSync } from 'node:fs';
import { parseMaxRounds } from './constants.mjs';

export const MIN_GAP_MS = 15_000;
/** Gate runs after which a finding is handed over: the first evaluation plus `rounds` repair rounds (default 3), a critic finding after one repair round (default 2). */
export const handoverRuns = (mode) => mode.rounds + 1;
export const handoverRunsCritic = (mode) => Math.max(2, Math.ceil(mode.rounds / 2) + 1);

/** Stable key of a finding: id + route + the message with its numbers blanked (widths and counts change between runs). */
export const findingKey = (i) => (i.id.startsWith('critic') ? i.id : `${i.id}|${i.route || ''}|${String(i.message).replace(/\d+(\.\d+)?/g, '#').slice(0, 120)}`);

/**
 * state: { seen: { key: { n, at } } } from the previous run (or {}). issues: the findings this run evaluated.
 * checksRun: Set of checks that ran now (findings of other checks are kept untouched). Returns { state, handover[] }.
 */
export function updateHandover(state, issues, checksRun, now = Date.now(), checkOf = (i) => i.check, mode = parseMaxRounds(process.env.AIDLC_GATE_MAX_ROUNDS)) {
  const seen = { ...(state && state.seen) };
  const current = new Map(issues.map((i) => [findingKey(i), i]));
  for (const [key, rec] of Object.entries(seen)) {
    if (checksRun.has(rec.check) && !current.has(key)) delete seen[key];   // resolved
  }
  const handover = [];
  const limit = (i) => (i.id.startsWith('critic') ? handoverRunsCritic(mode) : handoverRuns(mode));
  for (const [key, i] of current) {
    const prev = seen[key];
    const n = prev ? (now - prev.at >= MIN_GAP_MS ? prev.n + 1 : prev.n) : 1;
    seen[key] = { n, at: prev && now - prev.at < MIN_GAP_MS ? prev.at : now, check: checkOf(i), id: i.id, route: i.route || null };
    if (!mode.unlimited && n >= limit(i)) handover.push({ id: i.id, route: i.route || null, runs: n, reason: 'rounds', message: i.message });
  }
  // rounds = gate runs at least MIN_GAP_MS apart, with the number of findings each one evaluated
  const rounds = [...((state && state.rounds) || [])];
  const last = rounds[rounds.length - 1];
  if (last && now - last.at < MIN_GAP_MS) rounds[rounds.length - 1] = { at: last.at, count: current.size };
  else rounds.push({ at: now, count: current.size });
  const r = rounds.slice(-3);
  const plateau = mode.unlimited && current.size > 0 && r.length === 3 && r[1].count >= r[0].count && r[2].count >= r[1].count;
  if (plateau) for (const i of current.values()) handover.push({ id: i.id, route: i.route || null, runs: seen[findingKey(i)].n, reason: 'plateau', message: i.message });
  return { state: { seen, rounds: rounds.slice(-6) }, handover };
}

export function loadState(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { return { seen: {} }; }
}
export function saveState(file, state) {
  try { writeFileSync(file, JSON.stringify(state, null, 1) + '\n'); } catch (e) { /* the loop bound is advisory */ }
}
