'use strict';
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Render check (KQ1): opens every screen of a built prototype.html in headless Chromium and reports
//   - blocks that show "This <name> block cannot be shown" or "failed to render" (the red box; core.js marks them with data-k-block-error)
//   - uncaught page errors and console.error lines ("screen render #N failed: ...")
// Runs without the quality gate's dependencies: it finds playwright-core and a Chromium in several places and, when it finds none,
// reports "skipped" (never a failure: a missing browser must not stop a run). Contract: addon/bin/README.md ("ui-render-check").

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ADDON = path.join(__dirname, '..');                       // <addon> in the repo, <project>/.aidlc-ui in a project
const DEFAULT_BUDGET_MS = 20000;
const PAGE_SETTLE_MS = 350;
const PAGE_RETRY_MS = 400;
const CONCURRENCY = 3;

/** playwright-core: the quality gate's install, the add-on's, Canvas' (workshop host), a plain require. null when none. */
function findPlaywright() {
  const cands = [
    process.env.AIDLC_PLAYWRIGHT_CORE,
    path.join(ADDON, 'quality', 'node_modules', 'playwright-core'),
    path.join(ADDON, 'node_modules', 'playwright-core'),
    path.join(ADDON, '..', 'canvas', 'node_modules', 'playwright-core'),
    '/opt/aidlc-ui-first/canvas/node_modules/playwright-core',
    'playwright-core',
  ].filter(Boolean);
  for (const c of cands) {
    try { return require(c); } catch (_) { /* next */ }
  }
  return null;
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } };
const listDir = (d) => { try { return fs.readdirSync(d); } catch (_) { return []; } };

/** A Chromium binary: CHROME_PATH, Playwright's own path, a Playwright browsers folder, then the system. null when none. */
function findChromium(pw) {
  if (process.env.CHROME_PATH) return isFile(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  try { const p = pw && pw.chromium.executablePath(); if (p && isFile(p)) return p; } catch (_) { /* fall through */ }
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of roots) {
    const names = listDir(root).sort().reverse();                 // newest build first
    for (const n of names.filter((x) => /^chromium-\d+$/.test(x))) {
      for (const sub of listDir(path.join(root, n)).filter((x) => /^chrome-linux/.test(x))) {
        const p = path.join(root, n, sub, 'chrome');
        if (isFile(p)) return p;
      }
    }
    for (const n of names.filter((x) => /^chromium_headless_shell-\d+$/.test(x))) {
      for (const sub of listDir(path.join(root, n)).filter((x) => /^chrome-headless-shell-linux/.test(x))) {
        const p = path.join(root, n, sub, 'chrome-headless-shell');
        if (isFile(p)) return p;
      }
    }
  }
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
      if (dir && isFile(path.join(dir, bin))) return path.join(dir, bin);
    }
  }
  return null;
}

/** Routes of the prototype: the data-route sections without parameters; [''] for a one-page prototype that uses blocks or render functions. */
function routesOf(html) {
  const routes = [...new Set([...html.matchAll(/<section\b[^>]*\sdata-route\s*=\s*"([^"]+)"/g)].map((m) => m[1]))].filter((r) => !/[:*]/.test(r));
  if (routes.length) return routes;
  return /data-k-block|APP_RENDER/.test(html) ? [''] : [];
}

/** route -> screen id, from ui-map.json (names the screens/NN-<id> file in the message); {} when it is missing. */
function screenIds(uiDir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(uiDir, 'ui-map.json'), 'utf8'));
    const out = {};
    for (const s of m.screens || []) if (s && s.route) out[s.route] = s.id || s.name || null;
    return out;
  } catch (_) { return {}; }
}

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').slice(0, n);

/** One-line fix hint from the error text: the three causes seen in the KL1 runs (KQ1 report). */
function hintFor(message) {
  if (/is not a function|is not defined/.test(message)) {
    return 'A name is used that the code in another file does not define (or defines as a value, not a function). Open the file that defines it and call it the way it is written; screens/*.blocks.js load AFTER data.js, so a render function must not call anything defined in a .blocks.js.';
  }
  if (/undefined \(reading '(filter|map|find|forEach|length|slice|reduce)'\)/.test(message)) {
    return 'The config reads a collection that does not exist where it looks: entities are D.<name>, but derived series are D.series.<name> and figures D.kpis.<name> (see brief.json dataEntities / dataDerived).';
  }
  if (/undefined \(setting /.test(message) || /undefined \(reading /.test(message)) {
    return 'An object is undefined at this point: check the load order (screen script, then data.js runs every APP_RENDER function, then the .blocks.js files) and the names in window.APP_DATA.';
  }
  return 'Find the line that throws and make it use names that exist (window.APP_DATA of brief.json).';
}

/**
 * renderCheck(uiDir, { budgetMs, concurrency, file })
 * -> { status: 'pass'|'fail'|'skipped', reason?, routes: n, checked: n, findings: [...], ms }
 * finding: { kind: 'block', route, screen, block, cfg, message } | { kind: 'error', route, screen, message }
 */
async function renderCheck(uiDir, opts = {}) {
  const t0 = Date.now();
  const budgetMs = opts.budgetMs || DEFAULT_BUDGET_MS;
  const file = opts.file || path.join(uiDir, 'prototype.html');
  const done = (o) => ({ routes: 0, checked: 0, findings: [], ...o, ms: Date.now() - t0 });
  if (!isFile(file)) return done({ status: 'skipped', reason: `${file} not found` });
  const html = fs.readFileSync(file, 'utf8');
  const routes = routesOf(html);
  if (!routes.length) return done({ status: 'pass', reason: 'no screens with blocks or render functions' });
  const pw = findPlaywright();
  if (!pw) return done({ status: 'skipped', routes: routes.length, reason: 'playwright-core not found (install the add-on quality dependencies: npm ci in .aidlc-ui/quality)' });
  const exe = findChromium(pw);
  if (!exe) return done({ status: 'skipped', routes: routes.length, reason: 'no Chromium found (set CHROME_PATH or PLAYWRIGHT_BROWSERS_PATH)' });

  const ids = screenIds(uiDir);
  const url = pathToFileURL(file).href;
  const deadline = t0 + budgetMs;
  let browser;
  try {
    browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  } catch (e) {
    return done({ status: 'skipped', routes: routes.length, reason: `Chromium did not start: ${clip(e && e.message, 160)}` });
  }
  const perRoute = [];
  let checked = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const queue = routes.slice();
    const worker = async () => {
      for (;;) {
        const route = queue.shift();
        if (route === undefined || Date.now() > deadline) return;
        const page = await ctx.newPage();
        const rec = { route, errors: [], blocks: [] };
        page.on('pageerror', (e) => rec.errors.push(clip(e && e.message, 200)));
        page.on('console', (m) => { if (m.type() === 'error') rec.errors.push(clip(m.text(), 200)); });
        try {
          await page.goto(url + route, { waitUntil: 'load', timeout: 8000 });
          await page.waitForTimeout(PAGE_SETTLE_MS);
          // a block redrawn by a later update() clears its marker: look again before calling it broken
          for (let look = 0; look < 3; look++) {
            rec.blocks = await page.evaluate(() => [...document.querySelectorAll('[data-k-block-error]')].map((el) => ({
              block: el.getAttribute('data-k-block') || '', cfg: el.getAttribute('data-k-cfg') || '', message: el.getAttribute('data-k-block-error') || '',
              visible: !!(el.getClientRects().length && el.offsetParent !== null),
            })));
            if (!rec.blocks.length || Date.now() > deadline) break;
            await page.waitForTimeout(PAGE_RETRY_MS);
          }
          checked++;
        } catch (e) {
          rec.errors.push(`the page did not load: ${clip(e && e.message, 120)}`);
        }
        perRoute.push(rec);
        await page.close().catch(() => {});
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency || CONCURRENCY, routes.length) }, worker));
  } finally {
    await browser.close().catch(() => {});
  }

  // merge: a block that fails on every route (blocks mount once, hidden screens too) is one finding, on the route where it is visible
  perRoute.sort((a, b) => routes.indexOf(a.route) - routes.indexOf(b.route));
  const findings = [];
  const seenBlock = new Map();
  const seenErr = new Set();
  for (const rec of perRoute) {
    const screen = ids[rec.route] || null;
    for (const b of rec.blocks) {
      const key = `${b.block}|${b.cfg}|${b.message}`;
      const prev = seenBlock.get(key);
      if (prev) { if (b.visible && !prev.visible) { prev.f.route = rec.route; prev.f.screen = screen; prev.visible = true; } continue; }
      const f = { kind: 'block', route: rec.route, screen, block: b.block, cfg: b.cfg, message: clip(b.message, 220) };
      seenBlock.set(key, { f, visible: b.visible });
      findings.push(f);
    }
    for (const m of rec.errors) {
      if (seenErr.has(m)) continue;
      seenErr.add(m);
      findings.push({ kind: 'error', route: rec.route, screen, message: m });
    }
  }
  const out = { status: findings.length ? 'fail' : 'pass', routes: routes.length, checked, findings };
  if (checked < routes.length) out.reason = `time budget of ${Math.round(budgetMs / 1000)} s reached: ${checked} of ${routes.length} screens checked`;
  return done(out);
}

/** The ERROR / WARN lines the CLI prints for a result. */
function lines(res) {
  const out = [];
  for (const f of res.findings) {
    const where = f.route || '(page)';
    const file = f.screen ? ` Fix in screens/NN-${f.screen}.blocks.js / .html or data.js.` : '';
    if (f.kind === 'block') {
      out.push(`ERROR render-block ${where}: the ${f.block || '?'} block "${f.cfg || '?'}" cannot be shown: ${f.message}. ${hintFor(f.message)}${file}`);
    } else {
      out.push(`ERROR render-error ${where}: ${f.message}. ${hintFor(f.message)}${file}`);
    }
  }
  if (res.status === 'skipped') out.push(`WARN render-skipped: ${res.reason}. The screens were NOT rendered, so broken blocks would not be seen.`);
  else if (res.reason && res.status !== 'pass') out.push(`WARN render-partial: ${res.reason}`);
  return out;
}

module.exports = { renderCheck, lines, findPlaywright, findChromium, routesOf, hintFor };
