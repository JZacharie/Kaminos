// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Child process of lighthouse.mjs: runs Lighthouse (accessibility, desktop preset) for the given routes, one after the other,
// against the shared Chrome. Lighthouse cannot run twice at once inside one process (global performance marks), so the
// parallelism is one process per slice of routes.
// argv[2] = JSON {port, origin, routes:[...]}; stdout = one JSON line per result.
import { lighthouse as loadLighthouse } from './deps.mjs';
import { routeUrl } from './passes.mjs';
import { summariseLhr } from './lighthouse-summary.mjs';

const { port, origin, routes } = JSON.parse(process.argv[2]);
const { lighthouse, desktopConfig } = await loadLighthouse();
// Accessibility needs no throttling: "simulate" keeps the quiet windows short (the other methods force >= 5 s each), and the
// windows are set to 0 because the page is a local single file.
const flags = {
  port, output: 'json', logLevel: 'silent', onlyCategories: ['accessibility'], throttlingMethod: 'simulate', disableStorageReset: true,
  disableFullPageScreenshot: true, pauseAfterFcpMs: 0, pauseAfterLoadMs: 0, networkQuietThresholdMs: 0, cpuQuietThresholdMs: 0,
  maxWaitForFcp: 15_000, maxWaitForLoad: 25_000,
};
for (const route of routes) {
  let out = null;
  for (let attempt = 1; attempt <= 2 && !out; attempt++) {
    try {
      const r = await lighthouse(routeUrl(origin, route), flags, desktopConfig);
      if (!r || !r.lhr) throw new Error('no result');
      if (r.lhr.runtimeError) throw new Error(`${r.lhr.runtimeError.code}: ${String(r.lhr.runtimeError.message).slice(0, 200)}`);
      out = { route, ...summariseLhr(r.lhr), version: r.lhr.lighthouseVersion };
    } catch (e) {
      if (attempt === 2) out = { route, score: null, failing: [], error: String(e && e.message ? e.message : e).slice(0, 300) };
    }
  }
  process.stdout.write(JSON.stringify(out) + '\n');
}
process.exit(0);
