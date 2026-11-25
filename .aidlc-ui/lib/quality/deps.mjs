// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Resolves the gate dependencies from <addon>/quality/node_modules (installed: <project>/.aidlc-ui/quality/node_modules),
// independent of the current directory. Layout: <root>/lib/quality/deps.mjs, <root>/quality/package.json.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const QUALITY_DIR = join(ROOT, 'quality');
const requireQ = createRequire(join(QUALITY_DIR, 'package.json'));
const requireLib = createRequire(import.meta.url);

export class DepsError extends Error {}

function need(name) {
  try {
    return requireQ(name);
  } catch (e) {
    throw new DepsError(`dependency "${name}" not found under ${join(QUALITY_DIR, 'node_modules')}. Run: (cd "${QUALITY_DIR}" && npm ci --omit=dev --ignore-scripts)`);
  }
}

export const playwright = () => need('playwright-core');
export const pkgVersion = (name) => { try { return requireQ(`${name}/package.json`).version; } catch (_) { return null; } };
export const bedrock = () => need('@aws-sdk/client-bedrock-runtime');

export function axeSource() {
  const p = requireQ.resolve('axe-core/axe.min.js');
  return { path: p, version: need('axe-core/package.json').version };
}

/** Lighthouse is ESM-only with an exports map: import the entry file by absolute URL. */
export async function lighthouse() {
  const dir = join(QUALITY_DIR, 'node_modules', 'lighthouse');
  if (!existsSync(join(dir, 'core', 'index.js'))) {
    throw new DepsError(`dependency "lighthouse" not found under ${join(QUALITY_DIR, 'node_modules')}. Run: (cd "${QUALITY_DIR}" && npm ci --omit=dev --ignore-scripts)`);
  }
  const mod = await import(pathToFileURL(join(dir, 'core', 'index.js')).href);
  const desktop = await import(pathToFileURL(join(dir, 'core', 'config', 'desktop-config.js')).href);
  return { lighthouse: mod.default, desktopConfig: desktop.default };
}

/** Progress library of the add-on (CommonJS). */
export const progressLib = () => requireLib('../progress.js');

/** Chromium path: CHROME_PATH, else Playwright's own path (PLAYWRIGHT_BROWSERS_PATH is honoured), else a clear error. */
export function chromePath() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new DepsError(`CHROME_PATH=${fromEnv} does not exist`);
    return fromEnv;
  }
  let p = null;
  try { p = playwright().chromium.executablePath(); } catch (e) { if (e instanceof DepsError) throw e; }
  if (p && existsSync(p)) return p;
  throw new DepsError('no Chromium found. Set CHROME_PATH to a Chrome/Chromium binary, or install the Playwright build ' +
    '(PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers, npx playwright-core install chromium).');
}
