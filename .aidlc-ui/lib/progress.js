// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// Append-only progress events for Canvas: <ui dir>/progress.jsonl (contract: addon/templates/progress-events.md).
const fs = require('node:fs');
const path = require('node:path');

const PHASES = ['brief', 'screen', 'assemble', 'gate', 'repair', 'critic', 'publish', 'done'];
const STATUSES = ['start', 'done', 'pass', 'fail', 'info', 'skip'];
const CHECKS = ['console', 'overflow', 'axe', 'lighthouse', 'network', 'data', 'critic'];

function currentVersion(uiDir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(uiDir, 'ui-map.json'), 'utf8'));
    if (Number.isInteger(m.uiVersion) && m.uiVersion >= 1) return m.uiVersion;
  } catch (_) { /* no ui-map yet */ }
  return 1;
}

/** Build and validate one event. Throws Error with a clear message on invalid input. */
function makeEvent(uiDir, ev) {
  const e = {
    schemaVersion: 1,
    ts: new Date().toISOString(),
    version: ev.version != null ? Number(ev.version) : currentVersion(uiDir),
    phase: ev.phase,
    status: ev.status,
    screen: ev.screen == null ? null : String(ev.screen),
    check: ev.check == null ? null : String(ev.check),
    n: ev.n == null ? null : Number(ev.n),
    of: ev.of == null ? null : Number(ev.of),
    message: String(ev.message == null ? '' : ev.message).replace(/\s+/g, ' ').trim().slice(0, 140),
  };
  if (!PHASES.includes(e.phase)) throw new Error(`invalid phase "${e.phase}" (${PHASES.join('|')})`);
  if (!STATUSES.includes(e.status)) throw new Error(`invalid status "${e.status}" (${STATUSES.join('|')})`);
  if (e.check !== null && !CHECKS.includes(e.check)) throw new Error(`invalid check "${e.check}" (${CHECKS.join('|')})`);
  if (e.screen !== null && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.screen)) throw new Error(`invalid screen id "${e.screen}"`);
  if (!Number.isInteger(e.version) || e.version < 1) throw new Error('invalid version');
  if (e.n !== null && !(Number.isInteger(e.n) && e.n >= 0)) throw new Error('invalid n');
  if (e.of !== null && !(Number.isInteger(e.of) && e.of >= 1)) throw new Error('invalid of');
  if (!e.message) throw new Error('message is required');
  return e;
}

/** Append one event as one line with a single O_APPEND write. Never throws for I/O problems when opts.quiet. */
function appendProgress(uiDir, ev, opts = {}) {
  try {
    const e = makeEvent(uiDir, ev);
    fs.mkdirSync(uiDir, { recursive: true });
    fs.appendFileSync(path.join(uiDir, 'progress.jsonl'), JSON.stringify(e) + '\n', { flag: 'a' });
    return e;
  } catch (err) {
    if (opts.quiet) return null;
    throw err;
  }
}

module.exports = { appendProgress, makeEvent, PHASES, STATUSES, CHECKS };
