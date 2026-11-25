// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use strict';
// KF2: two Kiro workspace agents for the first-UI crew, derived at install time from the installed AI-DLC developer agent.
//   <project>/.kiro/agents/aidlc-ui-screen-builder.json   (one stage per screen)
//   <project>/.kiro/agents/aidlc-ui-data-builder.json     (the data stage)
// A Kiro `subagent` stage with `role: <agent name>` runs on the `model` field of that agent's JSON (probe: Kiro CLI 2.37.1). The AI-DLC core
// agent files are never changed: these are NEW files that copy aidlc-developer-agent.json (tools, allowedTools, toolsSettings, hooks, resources,
// includeMcpJson, prompt) and differ only in `name`, `description`, when configured `model`, and one added `postToolUse` hook (KA1, activity log).
// The only edit of a core file: the same hook is appended to `.kiro/agents/aidlc.json`, the main agent `ws start` opens (see patchMainAgent).
//   model for the screen agent: env AIDLC_UI_SCREEN_MODEL at install time     model for the data agent: env AIDLC_UI_DATA_MODEL
//   no value (or empty)     = no `model` field = the stage inherits the session model (what the add-on did before)
// A re-run of the installer rebuilds both files from the developer agent as it is NOW and the env as it is NOW (set the env again to keep a model).
// Same ownership rules as the Claude agents: `.aidlc-ui/.installed-kiro-agents` records "<file> <sha256 of the version the installer wrote>";
// a file that differs from both the new content and the recorded one was edited by the person and is kept with a WARN unless --force.
// Usage: node kiro-agents.js --project <dir> --kit <.aidlc-ui dir> [--force] [--dry-run]
// Output: human lines, then one machine line `KIRO-AGENTS changed=<0|1>`.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEV = 'aidlc-developer-agent';
const MAIN = 'aidlc';           // the agent `ws start` opens (chat.defaultAgent): KA1 adds the activity hook to it too
const AGENTS = [
  { name: 'aidlc-ui-screen-builder', env: 'AIDLC_UI_SCREEN_MODEL', what: 'builds ONE screen of the first UI (src/screens/NN-<id>.html) or repairs it' },
  { name: 'aidlc-ui-data-builder', env: 'AIDLC_UI_DATA_MODEL', what: 'builds the ONE shared dataset of the first UI (src/data.js) or repairs it' },
];
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };

// KA1: ONE extra `postToolUse` hook on both agents: `node <kit>/bin/activity-hook` appends one line per tool call to
// <project>/aidlc/.ui-first/kiro-activity.jsonl, which Canvas shows as "What Kiro is doing". postToolUse is advisory (an exit other than 0 only
// warns), the hook always exits 0 and stops after 1 s on its own; `timeout_ms` is the outer guard.
function activityHook(kitRel) {
  return { matcher: '*', command: `node ${kitRel}/bin/activity-hook`, timeout_ms: 3000 };
}
function withActivityHook(hooks, kitRel) {
  const h = hooks && typeof hooks === 'object' && !Array.isArray(hooks) ? hooks : {};
  const hook = activityHook(kitRel);
  const post = Array.isArray(h.postToolUse) ? h.postToolUse : [];
  return { ...h, postToolUse: post.some((x) => x && x.command === hook.command) ? post : [...post, hook] };
}

// KA1 (live check on kiro-cli 2.37.1): the main agent `aidlc` has no activity hook, and it is the agent that does the coordinating. ONE small edit of
// <project>/.kiro/agents/aidlc.json: the hook is appended to hooks.postToolUse when it is not there yet (idempotent, nothing else changes).
// Cost: `aidlc config` sees that file as locally modified and keeps it (`--force` restores the shipped file; re-run this installer to add the hook again).
// A missing or unreadable file is a WARN, never an error.
function patchMainAgent(adir, kitRel, log, dry) {
  const file = path.join(adir, `${MAIN}.json`);
  const text = read(file);
  if (text === null) { log(`note: ${file} not found: the main agent '${MAIN}' has no activity hook (Canvas shows only the builder agents' tool calls).`); return 0; }
  let obj;
  try { obj = JSON.parse(text.replace(/^\ufeff/, '')); } catch (_) { obj = null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { log(`WARN: ${file} is not a JSON object: the main agent has no activity hook.`); return 0; }
  const hooks = withActivityHook(obj.hooks, kitRel);
  if (JSON.stringify(hooks.postToolUse) === JSON.stringify(obj.hooks && obj.hooks.postToolUse)) { log(`main agent ${MAIN}.json already has the activity hook`); return 0; }
  if (dry) return 0;
  fs.writeFileSync(file, JSON.stringify({ ...obj, hooks }, null, 2) + '\n');
  log(`added the activity hook to ${MAIN}.json (the main agent)`);
  return 1;
}

// The derived file: key order of the developer agent kept; `name`, `description` replaced; `model` right after `description` when set;
// `hooks` = the developer agent's hooks plus the activity hook (kitRel = the kit folder relative to the project, e.g. `.aidlc-ui`).
function derive(devObj, agent, model, kitRel = '.aidlc-ui') {
  const out = {};
  for (const [k, v] of Object.entries(devObj)) {
    if (k === 'model') continue;
    if (k === 'hooks') { out.hooks = withActivityHook(v, kitRel); continue; }
    if (k === 'name') { out.name = agent.name; continue; }
    if (k === 'description') {
      out.description = `AI-DLC UI-first add-on: ${agent.what}. Same tools, hooks and rules as ${DEV}; the stage task names the agent file to follow.`;
      if (model) out.model = model;
      continue;
    }
    out[k] = v;
  }
  if (!('hooks' in out)) out.hooks = withActivityHook({}, kitRel);
  if (!('name' in out)) out.name = agent.name;
  if (!('description' in out)) { out.description = `AI-DLC UI-first add-on: ${agent.what}.`; if (model) out.model = model; }
  return JSON.stringify(out, null, 2) + '\n';
}

function modelOf(text) {
  try { const m = JSON.parse(text).model; return typeof m === 'string' && m ? m : 'inherit'; } catch (_) { return '?'; }
}

// KF5: a re-install without the model env must not drop a configured model silently.
function droppedModelWarn(file, cur, model, log) {
  const prev = modelOf(cur);
  if (!model && prev !== 'inherit' && prev !== '?') {
    log(`WARN: ${file} had model '${prev}' and the model env is empty now: the stage will inherit the session model. Set it again to keep it (re-run with the env).`);
  }
}

function run(argv, env = process.env, log = (l) => process.stdout.write(l + '\n')) {
  const a = { project: '', kit: '', force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--project') a.project = argv[++i] || '';
    else if (x === '--kit') a.kit = argv[++i] || '';
    else if (x === '--force') a.force = true;
    else if (x === '--dry-run') a.dry = true;
    else { log(`unknown option: ${x}`); return 2; }
  }
  if (!a.project || !a.kit) { log('usage: kiro-agents.js --project <dir> --kit <dir> [--force] [--dry-run]'); return 2; }
  const adir = path.join(a.project, '.kiro', 'agents');
  const devFile = path.join(adir, `${DEV}.json`);
  const mark = path.join(a.kit, '.installed-kiro-agents');
  const kitRel = (path.relative(path.resolve(a.project), path.resolve(a.kit)) || '.aidlc-ui').split(path.sep).join('/');

  const models = {};
  for (const ag of AGENTS) {
    const v = (env[ag.env] || '').trim();
    if (v && !MODEL_RE.test(v)) { log(`ERROR: ${ag.env}='${v}' is not a model id (letters, digits, . _ : / - only)`); return 1; }
    models[ag.name] = v;
  }
  const desc = AGENTS.map((ag) => `${ag.name}: ${models[ag.name] || 'inherit'}`).join(', ');

  if (a.dry) {
    log(`[dry-run] would write ${AGENTS.map((g) => g.name + '.json').join(' and ')} to ${adir}, copied from ${DEV}.json (models: ${desc}; no model = inherit the session model)`);
    log('KIRO-AGENTS changed=0');
    return 0;
  }

  const devText = read(devFile);
  if (devText === null) {
    log(`WARN: ${devFile} not found: the Kiro builder agents (${AGENTS.map((g) => g.name).join(', ')}) were NOT written. The crew stages use role ${DEV}. Run the installer with --harness kiro after \`aidlc config --harness kiro\`.`);
    log('KIRO-AGENTS changed=0');
    return 0;
  }
  let devObj;
  try { devObj = JSON.parse(devText.replace(/^\ufeff/, '')); } catch (e) { devObj = null; }
  if (!devObj || typeof devObj !== 'object' || Array.isArray(devObj)) {
    log(`WARN: ${devFile} is not a JSON object: the Kiro builder agents were NOT written. The crew stages use role ${DEV}.`);
    log('KIRO-AGENTS changed=0');
    return 0;
  }
  const recorded = {};
  for (const l of (read(mark) || '').split(/\r?\n/)) { const m = /^(\S+) ([0-9a-f]{64})$/.exec(l); if (m) recorded[m[1]] = m[2]; }
  fs.mkdirSync(adir, { recursive: true });
  fs.mkdirSync(a.kit, { recursive: true });
  let changed = 0, warn = 0, newMark = '';
  const onDisk = [];
  for (const ag of AGENTS) {
    const file = `${ag.name}.json`, dst = path.join(adir, file);
    const want = derive(devObj, ag, models[ag.name], kitRel);
    const wsha = sha(want);
    const rec = recorded[file] || '';
    let keep = rec;
    const cur = read(dst);
    if (cur === null) {
      fs.writeFileSync(dst, want); keep = wsha; changed = 1;
      log(`installed ${file} (model: ${models[ag.name] || 'inherit'})`);
    } else {
      const dsha = sha(cur);
      if (dsha === wsha) keep = wsha;
      else if (a.force) { droppedModelWarn(file, cur, models[ag.name], log); fs.writeFileSync(dst, want); keep = wsha; changed = 1; log(`restored ${file} (--force; model: ${models[ag.name] || 'inherit'})`); }
      else if (rec && rec === dsha) { droppedModelWarn(file, cur, models[ag.name], log); fs.writeFileSync(dst, want); keep = wsha; changed = 1; log(`updated ${file} (unedited older copy replaced; model: ${models[ag.name] || 'inherit'})`); }
      else {
        warn = 1;
        log(`WARN: ${dst} differs from what the installer would write and was NOT overwritten (you edited it?). Restore: re-run with --force.`);
      }
    }
    if (keep) newMark += `${file} ${keep}\n`;
    onDisk.push(`${ag.name} model=${modelOf(read(dst) || '')}`);
  }
  if (patchMainAgent(adir, kitRel, log, false)) changed = 1;
  if ((read(mark) ?? '') !== newMark) fs.writeFileSync(mark, newMark);
  if (!changed && !warn) log('kiro builder agents already installed (unchanged)');
  log(`kiro builder agents ok: ${onDisk.join(', ')}`);
  log(`KIRO-AGENTS changed=${changed}`);
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2)));
module.exports = { run, derive, activityHook, patchMainAgent, AGENTS, DEV };
