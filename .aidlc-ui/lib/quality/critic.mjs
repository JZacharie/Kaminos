// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Vision critic: screenshots -> Bedrock Converse -> 6 scores (rubric: addon/quality/rubric.md).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import {
  CRITERIA, CRITERIA_LABELS, CRITIC_TEMPERATURE, CRITIC_MAX_TOKENS, CRITIC_MAX_ROUTES, CRITIC_JPEG_QUALITY, CRITIC_MAX_SHOT_HEIGHT,
  CRITIC_PASS_MEAN, CRITIC_MIN_SCORE, CRITIC_ISSUE_MAX_SCORE, PARITY_VERDICTS, REFERENCE_MAX_IMAGES, PRICE_IN_PER_M, PRICE_OUT_PER_M, VIEWPORT_HEIGHT, PLACEHOLDER_PATTERNS,
} from './constants.mjs';
import { bedrock, QUALITY_DIR } from './deps.mjs';
import { routeUrl } from './passes.mjs';
import { collectPage, documentHeight } from './page-fns.mjs';

// ---- pure helpers (unit-tested) -----------------------------------------------------------------------------------
export function priceConstants(env = process.env) {
  const inM = Number(env.UI_CRITIC_PRICE_IN_PER_M), outM = Number(env.UI_CRITIC_PRICE_OUT_PER_M);
  return { inM: Number.isFinite(inM) && inM > 0 ? inM : PRICE_IN_PER_M, outM: Number.isFinite(outM) && outM > 0 ? outM : PRICE_OUT_PER_M };
}
export const costUsd = (inputTokens, outputTokens, env) => {
  const p = priceConstants(env);
  return Number(((inputTokens * p.inM + outputTokens * p.outM) / 1_000_000).toFixed(5));
};

/** Parse the model text into the critic JSON. Throws Error(reason) when it is not valid. */
export function parseCriticText(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in the answer');
  let obj;
  try { obj = JSON.parse(body.slice(a, b + 1)); } catch (e) { throw new Error(`invalid JSON: ${e.message}`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('answer is not a JSON object');
  const scores = obj.scores;
  if (!scores || typeof scores !== 'object') throw new Error('missing "scores" object');
  for (const c of CRITERIA) {
    if (!Number.isInteger(scores[c]) || scores[c] < 1 || scores[c] > 5) throw new Error(`scores.${c} must be an integer 1-5`);
  }
  const reasons = {}, fixes = {};
  for (const c of CRITERIA) {
    reasons[c] = typeof obj.reasons?.[c] === 'string' ? obj.reasons[c].trim() : '';
    fixes[c] = typeof obj.fixes?.[c] === 'string' ? obj.fixes[c].trim() : '';
    if (scores[c] <= CRITIC_ISSUE_MAX_SCORE && !fixes[c]) throw new Error(`fixes.${c} is required because scores.${c} <= ${CRITIC_ISSUE_MAX_SCORE}`);
  }
  // `parity` (D-37) is reported only; a missing or malformed value is dropped instead of forcing a retry.
  let parity = null;
  const p = obj.parity;
  if (p && typeof p === 'object' && PARITY_VERDICTS.includes(p.verdict)) parity = { verdict: p.verdict, reason: typeof p.reason === 'string' ? p.reason.trim() : '' };
  return { scores: Object.fromEntries(CRITERIA.map((c) => [c, scores[c]])), reasons, fixes, parity };
}

/** Golden reference screenshots: <dir>/screenshots/*.png|jpg|jpeg (sorted, at most REFERENCE_MAX_IMAGES). Returns [] when absent. */
export function loadReferences(dir) {
  const shots = join(dir, 'screenshots');
  if (!existsSync(shots)) return [];
  const fmt = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg' };
  return readdirSync(shots).filter((f) => fmt[extname(f).toLowerCase()]).sort().slice(0, REFERENCE_MAX_IMAGES).map((f) => ({
    label: `REFERENCE (the bar): ${basename(f, extname(f)).replace(/^shot-/, '')}`, format: fmt[extname(f).toLowerCase()], bytes: readFileSync(join(shots, f)),
  }));
}

export function verdict(scores) {
  const vals = CRITERIA.map((c) => scores[c]);
  const mean = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  return { mean, pass: mean >= CRITIC_PASS_MEAN && Math.min(...vals) >= CRITIC_MIN_SCORE };
}

/** Notes of the previous round, for the next critic call (A28). `previous` = the critic object of the earlier quality/v<N>.json. */
export function previousRoundText(previous) {
  if (!previous || !previous.scores) return '';
  const out = [`This is a RE-REVIEW (round ${(previous.round || 1) + 1}). The author changed the prototype after your last review (round ${previous.round || 1}). Your previous scores (mean ${Number(previous.mean).toFixed(2)}):`];
  for (const c of CRITERIA) {
    const bits = [`${c} = ${previous.scores[c]}`];
    if (previous.reasons && previous.reasons[c]) bits.push(`reason: ${previous.reasons[c]}`);
    if (previous.fixes && previous.fixes[c]) bits.push(`fix you asked for: ${previous.fixes[c]}`);
    out.push(`- ${bits.join(' | ')}`);
  }
  out.push('Rules for this round: (1) first check each fix you asked for against the new screenshots; (2) keep a score unchanged unless you can point at a specific visible change: raise it when the defect is gone, lower it only for a defect you can name that is new or was ignored; (3) do not raise new demands on criteria that scored 4 or 5, and do not re-judge things you accepted last time; (4) in each reason say in a few words whether the earlier note was fixed.');
  return out.join('\n');
}

export function buildUserText({ appName, idea, screens, referenceCount = 0, previous = null }) {
  const lines = [`App name: ${appName || '(unnamed)'}`];
  if (idea) lines.push(`Idea: ${idea}`);
  if (screens && screens.length) lines.push(`Screens: ${screens.map((s) => `${s.title || s.id} (${s.route})`).join('; ')}`);
  lines.push('Criteria keys: ' + CRITERIA.map((c) => `${c} = ${CRITERIA_LABELS[c]}`).join('; '));
  if (referenceCount) lines.push(`First come ${referenceCount} screenshot(s) labelled "REFERENCE (the bar)": a finished, approved prototype of ANOTHER app. Use it only as the quality bar (see the rubric). After them come the CANDIDATE screenshots, the prototype you judge. Include "parity" in your answer.`);
  else lines.push('No REFERENCE screenshots are given: use the anchors alone and set "parity" to null.');
  const prev = previousRoundText(previous);
  if (prev) lines.push(prev);
  lines.push('Screenshots follow, each preceded by its label. Judge only what you see. Answer with the JSON object only.');
  return lines.join('\n');
}

/** Order routes: the first route, then the densest ones, capped. */
export function chooseRoutes(routes, counts, cap = CRITIC_MAX_ROUTES) {
  if (routes.length <= cap) return routes.slice();
  const rest = routes.slice(1).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).slice(0, cap - 1);
  return [routes[0], ...routes.filter((r) => rest.includes(r))];
}

// ---- screenshots --------------------------------------------------------------------------------------------------
async function shot(ctx, origin, route, collect) {
  const page = await ctx.newPage();
  try {
    await page.goto(routeUrl(origin, route), { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(250);
    const info = collect ? await page.evaluate(collectPage, { data: false, placeholders: PLACEHOLDER_PATTERNS }) : null;
    const width = page.viewportSize().width;
    const h = Math.min(await page.evaluate(documentHeight), CRITIC_MAX_SHOT_HEIGHT);
    const bytes = await page.screenshot({ type: 'jpeg', quality: CRITIC_JPEG_QUALITY, fullPage: true, clip: { x: 0, y: 0, width, height: Math.max(h, VIEWPORT_HEIGHT) } });
    return { bytes, count: info ? info.componentCount : 0 };
  } finally { await page.close(); }
}

export async function captureScreenshots({ browser, origin, routes, screens = {} }) {
  const name = (r) => (screens[r] ? `screen "${screens[r]}" (${r})` : r);
  const out = [];
  const mk = (theme, w) => browser.newContext({ viewport: { width: w, height: VIEWPORT_HEIGHT }, colorScheme: theme, serviceWorkers: 'block' });
  const c1280 = await mk('light', 1280);
  const first = {}, counts = {};
  try {
    for (const r of routes) { const s = await shot(c1280, origin, r, true); first[r] = s.bytes; counts[r] = s.count; }
  } finally { await c1280.close(); }
  const chosen = chooseRoutes(routes, counts);
  for (const r of chosen) out.push({ label: `${name(r)}, light theme, 1280 px wide`, route: r, width: 1280, theme: 'light', bytes: first[r] });
  const c1440 = await mk('light', 1440);
  try {
    for (const r of chosen) out.push({ label: `${name(r)}, light theme, 1440 px wide`, route: r, width: 1440, theme: 'light', bytes: (await shot(c1440, origin, r, false)).bytes });
  } finally { await c1440.close(); }
  const dark = await mk('dark', 1280);
  try {
    out.push({ label: `${name(routes[0])}, DARK theme, 1280 px wide`, route: routes[0], width: 1280, theme: 'dark', bytes: (await shot(dark, origin, routes[0], false)).bytes });
  } finally { await dark.close(); }
  return out;
}

// ---- model call ---------------------------------------------------------------------------------------------------
function makeConverse({ model, region }) {
  const { BedrockRuntimeClient, ConverseCommand } = bedrock();
  const client = new BedrockRuntimeClient({ region, maxAttempts: 3 });
  return async (system, messages) => {
    const res = await client.send(new ConverseCommand({
      modelId: model, system: [{ text: system }], messages,
      inferenceConfig: { maxTokens: CRITIC_MAX_TOKENS },
    }), { abortSignal: AbortSignal.timeout(240_000) });
    const text = (res.output?.message?.content || []).map((c) => c.text || '').join('');
    return { text, inputTokens: res.usage?.inputTokens || 0, outputTokens: res.usage?.outputTokens || 0, stopReason: res.stopReason };
  };
}

/**
 * Run the critic. `converse(system, messages)` is injectable for tests. Returns the `critic` object of quality/v<N>.json.
 * Never throws: any failure becomes { error }.
 */
export async function runCritic({ shots, references = [], appName, idea, screens, model, region, converse, previous = null, env = process.env }) {
  try {
    const system = readFileSync(join(QUALITY_DIR, 'rubric.md'), 'utf8');
    const call = converse || makeConverse({ model, region });
    const content = [{ text: buildUserText({ appName, idea, screens, referenceCount: references.length, previous }) }];
    for (const r of references) {
      content.push({ text: `Screenshot: ${r.label}` });
      content.push({ image: { format: r.format || 'png', source: { bytes: r.bytes } } });
    }
    if (references.length) content.push({ text: 'CANDIDATE screenshots (the prototype to judge) follow.' });
    for (const s of shots) {
      content.push({ text: `Screenshot: ${s.label}` });
      content.push({ image: { format: 'jpeg', source: { bytes: s.bytes } } });
    }
    const messages = [{ role: 'user', content }];
    let inTok = 0, outTok = 0, parsed = null, lastErr = '', attempts = 0;
    for (; attempts < 2 && !parsed;) {
      attempts++;
      const r = await call(system, messages);
      inTok += r.inputTokens; outTok += r.outputTokens;
      try { parsed = parseCriticText(r.text); } catch (e) {
        lastErr = e.message;
        messages.push({ role: 'assistant', content: [{ text: String(r.text || '(empty)') }] });
        messages.push({ role: 'user', content: [{ text: `Your answer is not valid: ${e.message}. Reply again with ONLY the JSON object of the schema in the system prompt.` }] });
      }
    }
    if (!parsed) return { error: `the model did not return valid JSON after a retry (${lastErr})`, costUsd: costUsd(inTok, outTok, env), model };
    const v = verdict(parsed.scores);
    return { round: (previous && previous.scores ? (previous.round || 1) : 0) + 1, scores: parsed.scores, mean: v.mean, pass: v.pass, parity: references.length ? parsed.parity : null, reasons: parsed.reasons, fixes: parsed.fixes, costUsd: costUsd(inTok, outTok, env), model,
      usage: { inputTokens: inTok, outputTokens: outTok, calls: attempts, images: shots.length + references.length, referenceImages: references.length } };
  } catch (e) {
    const name = e && e.name ? `${e.name}: ` : '';
    return { error: `${name}${String(e && e.message ? e.message : e).slice(0, 300)}`, model };
  }
}

/** --critic-mock: the file holds the model answer (JSON object, or {"error": "..."}), or raw text to test the invalid-JSON path. */
export function mockConverse(file) {
  const text = readFileSync(file, 'utf8');
  return async () => ({ text, inputTokens: 0, outputTokens: 0 });
}
