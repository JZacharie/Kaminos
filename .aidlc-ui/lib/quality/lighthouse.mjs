// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Lighthouse accessibility score per route, desktop preset, run against the shared Chrome (remote debugging port).
// Strategy (measured, numbers in tests/evidence/2026-11-04/addon/F3/A23-gate-timing.log): one Lighthouse navigation run per
// route, `accessibility` category only, throttling "simulate" with 0 ms quiet windows (any other method forces >= 5 s quiet
// windows: 14 s per route instead of 3 s), no full-page screenshot, LIGHTHOUSE_CONCURRENCY child processes in parallel
// (Lighthouse cannot run twice at once inside one process).
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGHTHOUSE_CONCURRENCY } from './constants.mjs';

export { summariseLhr } from './lighthouse-summary.mjs';
const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'lh-worker.mjs');

function runSlice({ port, origin, routes, timeoutMs, onResult }) {
  return new Promise((resolve) => {
    const got = [];
    const child = spawn(process.execPath, [WORKER, JSON.stringify({ port, origin, routes })], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '', err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        try { const r = JSON.parse(line); got.push(r); if (onResult) onResult(r); } catch (_) { /* ignore noise */ }
      }
    });
    child.stderr.on('data', (d) => { err = (err + d).slice(-500); });
    child.on('close', () => {
      clearTimeout(timer);
      for (const route of routes) if (!got.find((g) => g.route === route)) got.push({ route, score: null, failing: [], error: `Lighthouse worker ended without a result. ${err.trim().slice(-200)}` });
      resolve(got);
    });
  });
}

export async function runLighthouse({ port, origin, routes, onResult, timeoutMs = 240_000 }) {
  const n = Math.min(LIGHTHOUSE_CONCURRENCY, routes.length);
  const slices = Array.from({ length: n }, () => []);
  routes.forEach((r, i) => slices[i % n].push(r));
  const parts = await Promise.all(slices.map((s) => runSlice({ port, origin, routes: s, timeoutMs, onResult })));
  const all = parts.flat();
  return routes.map((r) => all.find((x) => x.route === r));
}
