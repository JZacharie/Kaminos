// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// quality-gate main: orchestration. See addon/bin/README.md ("quality-gate") for the contract.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import {
  DESKTOP_WIDTHS, LAYOUT_WIDTHS, SOFT_WIDTHS, DETERMINISTIC_CHECKS, CHECKS, DEFAULT_BUDGET_MS, DEFAULT_CRITIC_MODEL, CRITIC_COST_WARN_USD, DEFAULT_REFERENCE_SUBDIR,
} from './constants.mjs';
import { DepsError, ROOT, playwright, axeSource, chromePath, progressLib, pkgVersion } from './deps.mjs';
import { startServer } from './server.mjs';
import { runPass, runSeedPass } from './passes.mjs';
import { staticNetworkScan } from './network.mjs';
import { runLighthouse } from './lighthouse.mjs';
import { captureScreenshots, runCritic, mockConverse, loadReferences } from './critic.mjs';
import { updateHandover, loadState, saveState } from './handover.mjs';
import { buildFindings, criticIssues, criticHints, mergeWithPrevious, criticVerdictOutdated, validateReport, summaryLines, CHECK_OF_ID } from './report.mjs';

const USAGE = `usage: quality-gate <ui-dir> [options]

  <ui-dir>                 living UI dir (<record>/ui): prototype.html + ui-map.json. Result: <ui-dir>/quality/v<N>.json
  --version N              N of quality/v<N>.json (default: uiVersion of ui-map.json, else 1)
  --only <check,...>       re-run only these checks (${CHECKS.join(', ')}); the others are kept from the previous v<N>.json (rerun:false)
  --no-lighthouse          skip the Lighthouse accessibility check
  --critic                 also run the vision critic (Bedrock; needs AWS credentials). Runs only when the other checks have no issue
  --critic-always          run the critic even when other checks failed
  --critic-model <id>      default ${DEFAULT_CRITIC_MODEL} (or env UI_CRITIC_MODEL; e.g. global.anthropic.claude-opus-5-5)
  --critic-mock <file>     use the file as the model answer instead of calling AWS (tests); implies --critic
  --critic-save-shots <d>  write the critic screenshots (JPEG) to this directory
  --reference-dir <dir>    golden reference for the critic: <dir>/screenshots/*.png are sent first as "REFERENCE (the bar)"
                           (default: ../kit/examples/spudtrack relative to this script, D-37)
  --no-reference           do not send the reference (the critic then uses the rubric anchors alone; no parity)
  --idea "<text>"          idea text for the critic (with ui-map.json app.name)
  --budget-s N             soft time budget of the non-critic checks (default ${DEFAULT_BUDGET_MS / 1000}); axe at 768/375 px is skipped beyond it
  --no-progress            do not write <ui-dir>/progress.jsonl events
  --json                   print only the result JSON on stdout

blocking widths: ${DESKTOP_WIDTHS.join(', ')} px (+ ${LAYOUT_WIDTHS.join(', ')} px for the layout checks); warnings only: ${SOFT_WIDTHS.join(', ')} px (D-36). Exit 0 = PASS, 1 = FAIL, 2 = usage/internal error.`;

class UsageError extends Error {}

export function parseArgs(argv) {
  const o = { uiDir: null, version: null, only: null, noLighthouse: false, critic: false, criticAlways: false, criticModel: null, criticMock: null,
    saveShots: null, referenceDir: null, noReference: false, idea: '', budgetMs: DEFAULT_BUDGET_MS, noProgress: false, json: false, help: false };
  const val = (i, name) => { if (i + 1 >= argv.length) throw new UsageError(`${name} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--help': case '-h': o.help = true; break;
      case '--version': { const v = Number(val(i++, a)); if (!Number.isInteger(v) || v < 1) throw new UsageError('--version must be an integer >= 1'); o.version = v; break; }
      case '--only': {
        o.only = val(i++, a).split(',').map((s) => s.trim()).filter(Boolean);
        const bad = o.only.filter((c) => !CHECKS.includes(c));
        if (!o.only.length || bad.length) throw new UsageError(`--only: unknown check(s) ${bad.join(', ') || '(none given)'}; valid: ${CHECKS.join(', ')}`);
        break;
      }
      case '--no-lighthouse': o.noLighthouse = true; break;
      case '--critic': o.critic = true; break;
      case '--critic-always': o.criticAlways = true; o.critic = true; break;
      case '--critic-model': o.criticModel = val(i++, a); break;
      case '--critic-mock': o.criticMock = resolve(val(i++, a)); o.critic = true; break;
      case '--critic-save-shots': o.saveShots = resolve(val(i++, a)); break;
      case '--reference-dir': o.referenceDir = resolve(val(i++, a)); break;
      case '--no-reference': o.noReference = true; break;
      case '--idea': o.idea = val(i++, a); break;
      case '--budget-s': { const v = Number(val(i++, a)); if (!(v > 0)) throw new UsageError('--budget-s must be > 0'); o.budgetMs = v * 1000; break; }
      case '--no-progress': o.noProgress = true; break;
      case '--json': o.json = true; break;
      default:
        if (a.startsWith('--')) throw new UsageError(`unknown option ${a}`);
        if (o.uiDir) throw new UsageError(`unexpected argument ${a}`);
        o.uiDir = resolve(a);
    }
  }
  if (o.only && o.only.includes('critic')) o.critic = true;
  return o;
}

function freePort() {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

function readUiMap(uiDir) {
  const f = join(uiDir, 'ui-map.json');
  if (!existsSync(join(uiDir, 'prototype.html'))) throw new UsageError(`${uiDir}/prototype.html not found`);
  let map;
  if (!existsSync(f)) {
    // B1-T5: a builder that checks its own work before `ui-brief` has written ui-map.json: take the screens from src/brief.json.
    const bf = join(uiDir, 'src', 'brief.json');
    if (!existsSync(bf)) throw new UsageError(`${f} not found`);
    try {
      const brief = JSON.parse(readFileSync(bf, 'utf8'));
      map = { app: brief.app && brief.app.name ? { name: brief.app.name } : undefined, screens: [{ id: 'shell', route: '#/' }, ...(brief.screens || []).map((sc) => ({ id: sc.id, title: sc.title, route: sc.route }))] };
    } catch (e) { throw new UsageError(`${bf} is not valid JSON: ${e.message}`); }
  } else {
    try { map = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw new UsageError(`${f} is not valid JSON: ${e.message}`); }
  }
  const screens = Array.isArray(map.screens) ? map.screens : [];
  const routes = [];
  const byRoute = {};
  for (const s of screens) {
    if (!s || typeof s.route !== 'string' || !s.route) continue;
    if (s.id !== 'shell' && !byRoute[s.route]) byRoute[s.route] = s.id;
    if (s.id !== 'shell' && !routes.includes(s.route)) routes.push(s.route);
  }
  if (!routes.length) throw new UsageError(`${f} lists no screen with a route (screens[].route, besides "shell")`);
  return { map, routes, byRoute };
}

const sha256File = (f) => { try { return createHash('sha256').update(readFileSync(f)).digest('hex'); } catch (_) { return null; } };

const countBy = (arr, check) => arr.filter((i) => (i.check || CHECK_OF_ID(i.id)) === check);

export async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) { console.log(USAGE); return 0; }
  if (!opts.uiDir) throw new UsageError('missing <ui-dir>');
  const t0 = Date.now();
  const { map, routes, byRoute } = readUiMap(opts.uiDir);
  const version = opts.version ?? (Number.isInteger(map.uiVersion) && map.uiVersion >= 1 ? map.uiVersion : 1);
  const qualityFile = join(opts.uiDir, 'quality', `v${version}.json`);
  let previous = null;
  if (existsSync(qualityFile)) { try { previous = JSON.parse(readFileSync(qualityFile, 'utf8')); } catch (_) { previous = null; } }

  // which checks run
  const requested = opts.only ? new Set(opts.only) : new Set(DETERMINISTIC_CHECKS);
  const criticOn = opts.critic && (opts.only ? requested.has('critic') : true);
  if (criticOn) requested.add('critic');
  const lighthouseSkipped = opts.noLighthouse && requested.has('lighthouse');
  const run = new Set([...requested].filter((c) => !(c === 'lighthouse' && opts.noLighthouse)));
  const browserNeeded = [...run].some((c) => c !== 'critic') || run.has('critic');

  const progress = opts.noProgress ? null : progressLib();
  const emit = (phase, status, check, message, route = null, extra = {}) => {
    if (!progress) return;
    progress.appendProgress(opts.uiDir, { version, phase, status, check, screen: route && byRoute[route] ? byRoute[route] : null, message, ...extra }, { quiet: true });
  };
  const emitGate = (check, status, message, route) => emit(check === 'critic' ? 'critic' : 'gate', status, check, message, route);
  const timings = {};
  const mark = (name, since) => { timings[name] = Date.now() - since; };

  const human = (line) => { if (!opts.json) console.log(line); };
  const warnLines = [];

  for (const c of run) if (c !== 'critic') emitGate(c, 'start', `Checking ${c} on ${routes.length} screen${routes.length === 1 ? '' : 's'}`);
  if (lighthouseSkipped) emitGate('lighthouse', 'skip', 'Lighthouse skipped (--no-lighthouse)');

  const raw = { routes, screens: byRoute, desktop: {}, layout: {}, seed: null, soft: {}, dark: [], staticNet: null, lighthouse: null, softAxeSkipped: false };
  let critic = null;
  let criticSkipped = null;
  let referenceMissing = null;
  let toolVersions = {};

  if (run.has('network')) raw.staticNet = staticNetworkScan(readFileSync(join(opts.uiDir, 'prototype.html'), 'utf8'));

  let server = null, browser = null;
  try {
    if (browserNeeded) {
      const pw = playwright();
      const exe = chromePath();
      const debugPort = run.has('lighthouse') ? await freePort() : null;
      server = await startServer(opts.uiDir);
      browser = await pw.chromium.launch({
        executablePath: exe, headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', ...(debugPort ? [`--remote-debugging-port=${debugPort}`] : [])],
      });
      const axeSrc = run.has('axe') ? axeSource() : null;
      toolVersions = { playwrightCore: pkgVersion('playwright-core'), axeCore: axeSrc ? axeSrc.version : null, chromium: browser.version() };
      const what = { console: run.has('console'), network: run.has('network'), overflow: run.has('overflow'), data: run.has('data'), axe: run.has('axe') };
      const needPass = what.console || what.network || what.overflow || what.data || what.axe;

      // 1. blocking widths
      const tPass = Date.now();
      if (needPass) {
        for (const w of DESKTOP_WIDTHS) {
          raw.desktop[w] = await runPass({ browser, origin: server.origin, routes, width: w, what: { ...what, layout: what.overflow, data: what.data && w === DESKTOP_WIDTHS[0] }, axeSrcPath: axeSrc?.path });
        }
        if (what.overflow) {
          const tLayout = Date.now();
          for (const w of LAYOUT_WIDTHS) raw.layout[w] = await runPass({ browser, origin: server.origin, routes, width: w, what: { layout: true }, axeSrcPath: axeSrc?.path });
          mark('layoutPassMs', tLayout);
        }
        if (what.axe) {
          const counts = Object.fromEntries((raw.desktop[1280] || []).map((r) => [r.route, r.page ? r.page.componentCount : 0]));
          const dense = [...routes].sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
          const darkRoutes = [...new Set([routes[0], dense])];
          raw.dark = await runPass({ browser, origin: server.origin, routes: darkRoutes, width: 1280, theme: 'dark', what: { axe: true }, axeSrcPath: axeSrc.path });
        }
      }
      mark('desktopPassMs', tPass);

      // B1-T5b: seed-fidelity. Only when the build holds the pristine canonical seed (ui-seed-import wrote <ui>/src/seed.json).
      const seedFile = join(opts.uiDir, 'src', 'seed.json');
      if (run.has('data') && existsSync(seedFile)) {
        const tSeed = Date.now();
        let seed = null;
        try { seed = JSON.parse(readFileSync(seedFile, 'utf8')); } catch (e) { raw.seed = { seed: null, error: `src/seed.json is not valid JSON: ${e.message}`, state: null }; }
        if (seed) raw.seed = { seed, ...(await runSeedPass({ browser, origin: server.origin, routes, seed })) };
        mark('seedPassMs', tSeed);
      }

      // early verdicts for the checks that are final after the blocking widths
      const early = buildFindings(raw, run);
      for (const c of ['console', 'network', 'data', 'overflow', 'axe']) {
        if (!run.has(c)) continue;
        const mine = countBy(early.issues, c);
        emitGate(c, mine.length ? 'fail' : 'pass', mine.length ? `${c}: ${mine.length} issue${mine.length === 1 ? '' : 's'}, first: ${mine[0].id}` : `${c}: no issues at ${DESKTOP_WIDTHS.join(' and ')} px`, mine[0]?.route);
      }

      // 2. Lighthouse (desktop preset), one run per route against the same Chrome
      if (run.has('lighthouse')) {
        const tl = Date.now();
        raw.lighthouse = await runLighthouse({ port: debugPort, origin: server.origin, routes });
        mark('lighthouseMs', tl);
        const bad = raw.lighthouse.filter((r) => r.score === null || r.score < 90);
        emitGate('lighthouse', bad.length ? 'fail' : 'pass', bad.length ? `lighthouse: ${bad.length} route${bad.length === 1 ? '' : 's'} below 90 (lowest ${Math.min(...bad.map((r) => r.score ?? 0))})` : `lighthouse: accessibility ${Math.min(...raw.lighthouse.map((r) => r.score))}+ on all routes`, bad[0]?.route);
        toolVersions.lighthouse = raw.lighthouse.find((r) => r.version)?.version || null;
      }

      // 3. warning widths in the same browser
      if (needPass && (what.overflow || what.axe || what.console)) {
        const ts = Date.now();
        const deadline = t0 + opts.budgetMs;
        for (const w of SOFT_WIDTHS) {
          raw.soft[w] = await runPass({ browser, origin: server.origin, routes, width: w, what: { console: what.console, overflow: what.overflow, axe: what.axe }, axeSrcPath: axeSrc?.path, axeDeadline: deadline });
          if (raw.soft[w].some((r) => r.axeSkipped)) raw.softAxeSkipped = true;
        }
        mark('softWidthsMs', ts);
      }
      mark('checksMs', t0);

      // 4. vision critic (after the deterministic checks, only when they are clean unless forced)
      if (run.has('critic')) {
        const fresh = buildFindings(raw, run);
        const blocking = fresh.issues.length > 0 && [...run].some((c) => c !== 'critic');
        if (blocking && !opts.criticAlways) {
          criticSkipped = `skipped: ${fresh.issues.length} blocking issue(s) in the other checks; repair them first (or use --critic-always)`;
          emit('critic', 'skip', 'critic', 'Visual review skipped until the other checks pass');
        } else {
          const tc = Date.now();
          emit('critic', 'start', 'critic', 'Visual review of the screens');
          const model = opts.criticModel || process.env.UI_CRITIC_MODEL || DEFAULT_CRITIC_MODEL;
          const criticSha = sha256File(join(opts.uiDir, 'prototype.html'));
          const shots = await captureScreenshots({ browser, origin: server.origin, routes, screens: byRoute });
          if (opts.saveShots) {
            mkdirSync(opts.saveShots, { recursive: true });
            shots.forEach((s, i) => writeFileSync(join(opts.saveShots, `${String(i + 1).padStart(2, '0')}-${s.theme}-${s.width}.jpg`), s.bytes));
          }
          let references = [];
          if (!opts.noReference) {
            const refDir = opts.referenceDir || join(ROOT, ...DEFAULT_REFERENCE_SUBDIR);
            references = loadReferences(refDir);
            if (!references.length) referenceMissing = `no reference screenshots in ${join(refDir, 'screenshots')}; the critic judges by the rubric anchors alone (parity not reported). Install the kit examples or pass --no-reference.`;
          }
          let converse;
          if (opts.criticMock) {
            converse = mockConverse(opts.criticMock);
            let mockObj = null;
            try { mockObj = JSON.parse(readFileSync(opts.criticMock, 'utf8')); } catch (_) { /* raw text: tests the invalid-JSON path */ }
            if (mockObj && typeof mockObj.error === 'string') critic = { error: mockObj.error, model: 'mock' };
          }
          if (!critic) {
            critic = await runCritic({
              shots, references, appName: map.app && map.app.name, idea: opts.idea, screens: (map.screens || []).filter((s) => s.id !== 'shell'),
              model: opts.criticMock ? 'mock' : model, region: process.env.AWS_REGION || 'us-east-1', converse,
              previous: previous && previous.critic && previous.critic.scores ? previous.critic : null,
            });
          }
          if (critic && !critic.error) critic.prototypeSha = criticSha;
          mark('criticMs', tc);
          if (critic.error) emit('critic', 'fail', 'critic', `Visual review unavailable: ${critic.error}`);
          else emit('critic', critic.pass ? 'done' : 'fail', 'critic', `Visual review: mean ${critic.mean.toFixed(1)}/5 ${critic.pass ? 'pass' : 'needs work'}`);
        }
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }

  // ---- assemble the report ----------------------------------------------------------------------------------------
  const fresh = buildFindings(raw, run);
  if (critic && !critic.error) fresh.issues.push(...criticIssues(critic));
  if (critic && !critic.error) fresh.warnings.push(...criticHints(critic));
  if (critic && critic.error) fresh.warnings.push({ id: 'critic-unavailable', check: 'critic', severity: 'warn', route: null, width: null, message: `Vision critic did not run: ${critic.error}. It does not block the gate by itself (R10).` });
  if (critic && !critic.error && critic.costUsd > CRITIC_COST_WARN_USD) fresh.warnings.push({ id: 'critic-cost', check: 'critic', severity: 'warn', route: null, width: null, message: `One critic call cost ${critic.costUsd.toFixed(3)} USD (above ${CRITIC_COST_WARN_USD} USD; reported, not capped).` });

  if (critic && !critic.error && critic.parity && critic.parity.verdict === 'below') fresh.warnings.push({ id: 'critic-parity', check: 'critic', severity: 'warn', route: null, width: null, message: `Below the golden reference (parity, not blocking): ${critic.parity.reason || 'no reason given'}` });
  if (referenceMissing) fresh.warnings.push({ id: 'critic-reference-missing', check: 'critic', severity: 'warn', route: null, width: null, message: referenceMissing });

  const freshChecks = {};
  for (const c of CHECKS) {
    if (!run.has(c)) { if (c === 'lighthouse' && lighthouseSkipped) freshChecks[c] = { pass: null, skipped: true }; continue; }
    const mine = countBy(fresh.issues, c);
    freshChecks[c] = { pass: mine.length === 0, issues: mine.length };
    if (c === 'lighthouse' && raw.lighthouse) freshChecks[c].scores = Object.fromEntries(raw.lighthouse.map((r) => [r.route, r.score]));
    if (c === 'data') {
      const base = (raw.desktop[1280] || []).filter((r) => r.page);
      freshChecks[c].tables = base.flatMap((r) => r.page.tables.map((t) => ({ route: r.route, selector: t.selector, rows: t.rows })));
      freshChecks[c].lists = base.flatMap((r) => r.page.lists.map((l) => ({ route: r.route, selector: l.selector, items: l.items })));
    }
    if (c === 'critic') {
      if (criticSkipped) { freshChecks[c] = { pass: null, skipped: criticSkipped }; }
      else if (critic && critic.error) freshChecks[c] = { pass: null, error: critic.error };
    }
  }
  if (lighthouseSkipped) freshChecks.lighthouse = { pass: null, skipped: true };

  const currentSha = run.has('critic') ? null : sha256File(join(opts.uiDir, 'prototype.html'));
  const merged = mergeWithPrevious({ run, fresh, freshChecks, previous, all: CHECKS, currentSha });
  // A skipped critic keeps the previous one (rerun:false) so the round counter survives a repair round that failed the other checks.
  const keepPrev = previous && previous.critic ? { ...previous.critic, rerun: false, ...(criticVerdictOutdated(previous, currentSha) ? { outdated: true } : {}) } : null;
  const criticOut = run.has('critic') ? (criticSkipped ? keepPrev : critic) : keepPrev;
  const stateFile = join(opts.uiDir, 'quality', `state-v${version}.json`);
  const hand = updateHandover(loadState(stateFile), merged.issues.filter((i) => i.rerun !== false), run, Date.now(), (i) => i.check || CHECK_OF_ID(i.id));
  const durationMs = Date.now() - t0;
  const report = {
    version, pass: merged.issues.length === 0, checks: merged.checks, issues: merged.issues, warnings: merged.warnings, critic: criticOut,
    durationMs, timings, routes, widths: { blocking: DESKTOP_WIDTHS, layout: LAYOUT_WIDTHS, warning: SOFT_WIDTHS }, tools: toolVersions, partial: run.size < DETERMINISTIC_CHECKS.length + (criticOn ? 1 : 0),
    generatedAt: new Date().toISOString(),
    handover: hand.handover,
  };
  const bad = validateReport(report);
  if (bad.length) throw new Error(`internal: report shape invalid: ${bad.join('; ')}`);
  mkdirSync(join(opts.uiDir, 'quality'), { recursive: true });
  writeFileSync(qualityFile, JSON.stringify(report, null, 2) + '\n');
  saveState(stateFile, hand.state);

  if (opts.json) {
    console.log(JSON.stringify(report));
  } else {
    const soft = merged.warnings.filter((w) => SOFT_WIDTHS.includes(w.width)).length;
    if (soft) emit('gate', 'info', null, `Tablet/phone widths: ${soft} warning${soft === 1 ? '' : 's'} (not blocking)`);
    for (const l of summaryLines({ report }).slice(0, -1)) human(l);
    if (criticSkipped) human(`WARN critic-skipped - - ${criticSkipped}`);
    if (report.critic && !report.critic.error && report.critic.scores) human(`CRITIC mean ${report.critic.mean.toFixed(2)} ${report.critic.pass ? 'pass' : 'fail'} cost ${report.critic.costUsd.toFixed(4)} USD model ${report.critic.model} scores ${JSON.stringify(report.critic.scores)}`);
    if (report.critic && !report.critic.error && report.critic.parity) human(`PARITY ${report.critic.parity.verdict} ${report.critic.parity.reason}`);
    for (const h of hand.handover) human(`HANDOVER ${h.id} ${h.route ?? '-'} ${h.reason === 'plateau' ? 'PLATEAU: two rounds in a row without fewer findings' : `seen in ${h.runs} gate runs`}: stop repairing it; list it in ui-prototype-v1.md and in the final message`);
    human(`TIMING total ${(durationMs / 1000).toFixed(1)}s ${Object.entries(timings).map(([k, v]) => `${k}=${(v / 1000).toFixed(1)}s`).join(' ')}`);
    human(`WROTE ${qualityFile}`);
    human(summaryLines({ report }).slice(-1)[0]);
  }
  void warnLines;
  return report.pass ? 0 : 1;
}

export async function cli(argv) {
  try {
    process.exitCode = await main(argv);
  } catch (e) {
    if (e instanceof UsageError) { console.error(`quality-gate: ${e.message}\n\n${USAGE}`); process.exitCode = 2; return; }
    if (e instanceof DepsError) { console.error(`quality-gate: ${e.message}`); process.exitCode = 2; return; }
    console.error(`quality-gate: internal error: ${e && e.stack ? e.stack : e}`);
    process.exitCode = 2;
  }
}
