// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// aidlc-sensor-ui-v1-present.ts - ADVISORY check that the UI-first stage 1.1 delivered version 1.
//
// Sensor `ui-v1-present` of the `ui` plugin (manifest: sensors/aidlc-ui-v1-present.md).
// Fires at the approval gate of intent-capture, once per declared deliverable that exists.
// It reports (never blocks) when, for a record of scope ui-first or ui-workshop:
//   - <record>/ideation/intent-capture/ui-prototype-v1.md is missing, or
//   - <record>/ui/prototype.html is missing, or
//   - <record>/ui/ui-map.json is missing, or
//   - <record>/ui/prototype.html has no <script id="aidlc-effects"> block.
// Records of other scopes pass untouched. Records of schema 1.0/1.1 that keep the prototype in
// ideation/rough-mockups/ are accepted as the fallback location.
//
// Contract with the engine (core/tools/aidlc-sensor.ts):
//   - invoked with `--stage <slug> --output-path <deliverable>` (the manifest declares output_path);
//   - prints ONE JSON line {pass, findings, findings_count, ...} on stdout and exits 0;
//   - on a native install the engine imports this file and calls main(argv): it must export main()
//     and must not call process.exit() or run on import.
// Self-contained (node:fs and node:path only). Reads only the record. No network.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

interface Result {
  pass: boolean;
  findings_count: number;
  findings: string[];
  record?: string;
  checked?: string[];
  skipped?: string;
}

const UI_SCOPES = new Set(["ui-first", "ui-workshop"]);
const STAGE_DIR = "intent-capture";
const FIX_HINT =
  "run the 1.1 build step (Step 1b of intent-capture) to create it; if the add-on kit is missing, install it into .aidlc-ui/ first (add-on installer)";

function flagValue(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

function pass(extra: Partial<Result> = {}): Result {
  return { pass: true, findings_count: 0, findings: [], ...extra };
}

function readScope(record: string): string | undefined {
  const file = join(record, "aidlc-state.md");
  if (!existsSync(file)) return undefined;
  const match = /^- \*\*Scope\*\*:\s*(\S+)/m.exec(readFileSync(file, "utf-8"));
  return match ? match[1] : undefined;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Fire dedupe: the engine fires a gate sensor once per existing deliverable. Only one of them reports, so
// one gate shows one set of findings: the first .md of the stage dir in sorted order that is not a
// questions file or the memory note; when the dir holds only those, the first .md of all.
function isFirstDeliverable(outputPath: string): boolean {
  const names = readdirSync(dirname(outputPath))
    .filter((n) => n.endsWith(".md"))
    .sort();
  const eligible = names.filter((n) => !n.endsWith("-questions.md") && n !== "memory.md");
  const reporter = eligible[0] ?? names[0];
  return reporter === undefined || reporter === basename(outputPath);
}

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find(isFile);
}

export function evaluate(outputPath: string): Result {
  const out = resolve(outputPath);
  const stageDir = dirname(out);
  if (basename(stageDir) !== STAGE_DIR || basename(dirname(stageDir)) !== "ideation") {
    return pass({ skipped: "not a deliverable of intent-capture" });
  }
  const record = dirname(dirname(stageDir));
  const scope = readScope(record);
  if (scope === undefined || !UI_SCOPES.has(scope)) {
    return pass({ record, skipped: `scope ${scope ?? "unknown"} is not a UI-first scope` });
  }
  if (!out.endsWith(".md") || !isFirstDeliverable(out)) {
    return pass({ record, skipped: "reported on another deliverable of this fire" });
  }

  const findings: string[] = [];
  const checked: string[] = [];

  const index = join(stageDir, "ui-prototype-v1.md");
  checked.push("ideation/intent-capture/ui-prototype-v1.md");
  if (!isFile(index)) {
    findings.push(
      `ideation/intent-capture/ui-prototype-v1.md is missing: the 1.1 index of version 1 was not written; ${FIX_HINT}.`,
    );
  }

  const uiDir = join(record, "ui");
  const legacyDir = join(record, "ideation", "rough-mockups");
  const proto = firstExisting([join(uiDir, "prototype.html"), join(legacyDir, "prototype.html")]);
  const map = firstExisting([join(uiDir, "ui-map.json"), join(legacyDir, "ui-map.json")]);

  checked.push("ui/prototype.html");
  if (proto === undefined) {
    findings.push(`ui/prototype.html is missing: version 1 of the interface was not built; ${FIX_HINT}.`);
  } else {
    checked.push("ui/prototype.html#aidlc-effects");
    const html = readFileSync(proto, "utf-8");
    if (!/<script\b[^>]*\bid\s*=\s*["']aidlc-effects["']/i.test(html)) {
      findings.push(
        "ui/prototype.html has no aidlc-effects block (<script type=\"application/json\" id=\"aidlc-effects\">): " +
          "answers cannot be previewed in Canvas; run the 1.1 build step again so ui-build inlines the effects the step writes " +
          "(if the add-on kit is missing, install it into .aidlc-ui/ first).",
      );
    }
  }

  checked.push("ui/ui-map.json");
  if (map === undefined) {
    findings.push(`ui/ui-map.json is missing: the element map of version 1 was not written; ${FIX_HINT}.`);
  }

  return findings.length === 0
    ? pass({ record, checked })
    : { pass: false, findings_count: findings.length, findings, record, checked };
}

export function main(argv: string[]): void {
  const outputPath = flagValue(argv, "--output-path");
  if (outputPath === undefined) {
    process.stderr.write("aidlc-sensor-ui-v1-present: --output-path is required\n");
    process.exitCode = 1;
    return;
  }
  let result: Result;
  try {
    result = evaluate(outputPath);
  } catch (error) {
    // A crash must not read as a verdict: exit non-zero so the engine records "could not run".
    process.stderr.write(
      `aidlc-sensor-ui-v1-present: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

// Direct run (`bun aidlc-sensor-ui-v1-present.ts --stage s --output-path p`). Not taken when the
// engine imports the module.
if ((import.meta as { main?: boolean }).main === true) main(process.argv.slice(2));
