// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// B1-T5: progress events that do not depend on a model remembering to emit them.
// Under Kiro the builders run as subagents that never call `ui-progress`, so Canvas stayed near 7 % for the whole build. The main agent calls
//   ui-progress <ui> --plan     once brief.json exists: "brief done" (N screens planned) + a `screen start` per screen (and the dataset)
//   ui-progress <ui> --sync     after any builder returns: a `screen done` for every file that now exists
//   ui-progress <ui> --watch    once, before dispatching: a detached process that runs --plan and --sync every few seconds while the build runs
// All three are idempotent (an event that is already in progress.jsonl for the current version is never written twice) and only derive facts
// from files: <ui>/src/brief.json, src/screens/NN-<id>.html (or src/body.html in single mode) and src/data.js.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { appendProgress } = require('./progress.js');

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\ufeff/, '')); } catch (_) { return null; } };
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } };

function eventsOf(uiDir) {
  const text = read(path.join(uiDir, 'progress.jsonl')) || '';
  const out = [];
  for (const line of text.split('\n')) { if (!line.trim()) continue; try { out.push(JSON.parse(line)); } catch (_) { /* partial line */ } }
  return out;
}

function currentVersion(uiDir) {
  const m = readJson(path.join(uiDir, 'ui-map.json'));
  return m && Number.isInteger(m.uiVersion) && m.uiVersion >= 1 ? m.uiVersion : 1;
}

/** What the sources say right now. */
function inspect(uiDir) {
  const src = path.join(uiDir, 'src');
  const brief = readJson(path.join(src, 'brief.json'));
  const screens = brief && Array.isArray(brief.screens) ? brief.screens.filter((s) => s && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id || '')) : [];
  const single = isFile(path.join(src, 'body.html')) && !fs.existsSync(path.join(src, 'screens'));
  const files = {};
  const dir = path.join(src, 'screens');
  let names = [];
  try { names = fs.readdirSync(dir); } catch (_) { /* no screens yet */ }
  screens.forEach((s) => {
    const name = names.find((n) => new RegExp(`^\\d+-${s.id}\\.html$`).test(n));
    const text = name ? read(path.join(dir, name)) : null;
    files[s.id] = !!(text && text.length > 200 && /<\/section>\s*$/i.test(text));   // a complete screen ends with its closing section
  });
  const body = read(path.join(src, 'body.html'));
  const data = read(path.join(src, 'data.js'));
  return {
    briefReady: screens.length > 0,
    screens,
    files,
    single,
    bodyDone: !!(body && body.length > 500 && /<\/main>/i.test(body)),
    dataDone: !!(data && data.length > 200 && /APP_RENDER/.test(data)),
    title: (s) => String(s.title || s.id).replace(/\s+/g, ' ').trim().slice(0, 60),
  };
}

/**
 * Emit the events the sources justify and the log does not have yet. `plan` adds the start events, `sync` adds the done events.
 * Returns the list of written events (for tests and the CLI line).
 */
function syncProgress(uiDir, { plan = false, sync = false } = {}) {
  const st = inspect(uiDir);
  const cur = currentVersion(uiDir);
  const have = new Set(eventsOf(uiDir).filter((e) => e.version == null || e.version === cur).map((e) => `${e.phase}|${e.status}|${e.screen || ''}`));
  const written = [];
  const emit = (ev) => {
    const key = `${ev.phase}|${ev.status}|${ev.screen || ''}`;
    if (have.has(key)) return;
    const e = appendProgress(uiDir, ev, { quiet: true });
    if (e) { have.add(key); written.push(e); }
  };
  if (!st.briefReady) return written;
  const N = st.screens.length;
  if (plan) {
    emit({ phase: 'brief', status: 'done', of: N, message: `Design brief ready: ${N} screen${N === 1 ? '' : 's'}` });
    if (st.single) emit({ phase: 'screen', status: 'start', screen: 'all', n: 1, of: 1, message: 'Building: the whole first UI' });
    else {
      st.screens.forEach((s, i) => emit({ phase: 'screen', status: 'start', screen: s.id, n: i + 1, of: N, message: `Building: ${st.title(s)}` }));
      emit({ phase: 'screen', status: 'start', screen: 'data', message: 'Building: shared dataset' });
    }
  }
  if (sync) {
    if (st.single) {
      if (st.bodyDone && st.dataDone) emit({ phase: 'screen', status: 'done', screen: 'all', n: 1, of: 1, message: 'Built: the whole first UI' });
    } else {
      st.screens.forEach((s, i) => {
        if (!st.files[s.id]) return;
        emit({ phase: 'screen', status: 'start', screen: s.id, n: i + 1, of: N, message: `Building: ${st.title(s)}` });
        emit({ phase: 'screen', status: 'done', screen: s.id, n: i + 1, of: N, message: `Built: ${st.title(s)}` });
      });
      if (st.dataDone) emit({ phase: 'screen', status: 'done', screen: 'data', message: 'Built: shared dataset' });
    }
  }
  return written;
}

const pidFile = (uiDir) => path.join(uiDir, 'src', '.progress-watch.pid');

/** True when the build is over: a `done` or `publish done` event exists. */
function finished(uiDir, sinceMs = 0) {
  return eventsOf(uiDir).some((e) => (e.phase === 'done' || (e.phase === 'publish' && e.status === 'done')) && Date.parse(e.ts) >= sinceMs);
}

/** Detached watcher loop (runs in the child started by startWatcher). Stops at the first end-of-build event, after maxMinutes, or when its pid file is gone. */
async function watchLoop(uiDir, { intervalMs = 3000, maxMinutes = 45 } = {}) {
  const startedAt = Date.now() - 1000;
  const deadline = Date.now() + maxMinutes * 60_000;
  const mine = String(process.pid);
  while (Date.now() < deadline) {
    if (read(pidFile(uiDir)) !== mine) return;
    syncProgress(uiDir, { plan: true, sync: true });
    if (finished(uiDir, startedAt)) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  try { if (read(pidFile(uiDir)) === mine) fs.unlinkSync(pidFile(uiDir)); } catch (_) { /* gone */ }
}

/** Start (or keep) the detached watcher. Returns { pid, started }. */
function startWatcher(uiDir, script, { intervalSec = 3, maxMinutes = 45 } = {}) {
  fs.mkdirSync(path.join(uiDir, 'src'), { recursive: true });
  const old = Number(read(pidFile(uiDir)));
  if (old) { try { process.kill(old, 0); return { pid: old, started: false }; } catch (_) { /* stale pid file */ } }
  const child = spawn(process.execPath, [script, uiDir, '--watch-loop', '--interval', String(intervalSec), '--max-minutes', String(maxMinutes)],
    { detached: true, stdio: 'ignore', cwd: uiDir });
  child.unref();
  fs.writeFileSync(pidFile(uiDir), String(child.pid));
  return { pid: child.pid, started: true };
}

function stopWatcher(uiDir) {
  const old = Number(read(pidFile(uiDir)));
  try { fs.unlinkSync(pidFile(uiDir)); } catch (_) { /* none */ }
  if (old) { try { process.kill(old); } catch (_) { /* already gone */ } }
  return old || null;
}

module.exports = { syncProgress, startWatcher, stopWatcher, watchLoop, inspect, eventsOf, pidFile };
