// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Playwright passes: one page load per (route, width); console, network, overflow, data and axe are collected in the same load.
import { readFileSync } from 'node:fs';
import { VIEWPORT_HEIGHT, PLACEHOLDER_PATTERNS } from './constants.mjs';
import { classifyRequest } from './network.mjs';
import { collectPage, runAxe } from './page-fns.mjs';
import { collectLayout } from './layout-fns.mjs';
import { readSeedState, readSelectorTexts } from './seed-fns.mjs';

let axeCache = null;
const axeText = (p) => (axeCache ||= readFileSync(p, 'utf8'));

export const routeUrl = (origin, route) => `${origin}/prototype.html${route.startsWith('#') ? route : '#' + route}`;

/**
 * Load every route at one width and collect.
 * what: { console, network, overflow, data, axe, layout } booleans (layout: broken words, narrow rows, header wrap, text outside its card). axeSrcPath: path of axe.min.js.
 * Returns [{ route, width, theme, consoleErrors, pageErrors, blocked, extraFiles, page: collectPage result|null, axe: []|null }]
 */
export async function runPass({ browser, origin, routes, width, theme = 'light', what, axeSrcPath, axeDeadline = null }) {
  const ctx = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT }, colorScheme: theme, serviceWorkers: 'block', javaScriptEnabled: true,
  });
  const results = [];
  try {
    for (const route of routes) {
      const page = await ctx.newPage();
      const rec = { route, width, theme, consoleErrors: [], pageErrors: [], blocked: [], extraFiles: [], page: null, layout: null, axe: null, axeSkipped: false, error: null };
      const blockedUrls = new Set();
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const loc = m.location() ? m.location().url : '';
        if (blockedUrls.has(loc) || /\/favicon\.ico$/.test(loc)) return;
        rec.consoleErrors.push(m.text().slice(0, 300));
      });
      page.on('pageerror', (e) => rec.pageErrors.push(String(e && e.message ? e.message : e).slice(0, 300)));
      await page.route('**/*', (r) => {
        const url = r.request().url();
        const kind = classifyRequest(url, origin);
        if (kind === 'allow') return r.continue();
        blockedUrls.add(url);
        if (kind === 'external') { rec.blocked.push(url.slice(0, 200)); return r.abort(); }
        rec.extraFiles.push(new URL(url).pathname.slice(0, 200));
        return r.continue();
      });
      try {
        await page.goto(routeUrl(origin, route), { waitUntil: 'load', timeout: 30_000 });
        await page.waitForTimeout(150);
        rec.page = await page.evaluate(collectPage, { data: !!what.data, placeholders: PLACEHOLDER_PATTERNS });
        if (what.layout) rec.layout = await page.evaluate(collectLayout, { width });
        if (what.axe) {
          if (axeDeadline && Date.now() > axeDeadline) rec.axeSkipped = true;
          else {
            await page.addScriptTag({ content: axeText(axeSrcPath) });
            rec.axe = await page.evaluate(runAxe);
          }
        }
      } catch (e) {
        rec.error = String(e && e.message ? e.message : e).slice(0, 300);
      }
      await page.close();
      results.push(rec);
    }
  } finally {
    await ctx.close();
  }
  return results;
}

/**
 * B1-T5b seed-fidelity: load the first route once at 1280 px, read window.CANON and the canonical collections of window.APP_DATA, and for every agree rule that
 * carries a `selector` hint read the visible text of that element (on rule.route, else on every route until one matches).
 * Returns { error, state: { canon, data, kpis, dom: { <agree id>: { route, selector, texts } } } }.
 */
export async function runSeedPass({ browser, origin, routes, seed }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: VIEWPORT_HEIGHT }, serviceWorkers: 'block', javaScriptEnabled: true });
  const names = Object.keys(seed.collections || {});
  try {
    const page = await ctx.newPage();
    await page.route('**/*', (r) => (classifyRequest(r.request().url(), origin) === 'allow' ? r.continue() : r.abort()));
    await page.goto(routeUrl(origin, routes[0]), { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(150);
    const state = await page.evaluate(readSeedState, names);
    state.dom = {};
    for (const rule of (seed.agree || []).filter((a) => a.selector)) {
      const order = rule.route ? [rule.route] : routes;
      let found = { route: rule.route || null, selector: rule.selector, texts: [] };
      for (const route of order) {
        await page.goto(routeUrl(origin, route), { waitUntil: 'load', timeout: 30_000 });
        await page.waitForTimeout(100);
        const texts = await page.evaluate(readSelectorTexts, rule.selector);
        if (texts.length) { found = { route, selector: rule.selector, texts }; break; }
      }
      state.dom[rule.id] = found;
    }
    return { error: null, state };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e).slice(0, 300), state: null };
  } finally {
    await ctx.close();
  }
}
