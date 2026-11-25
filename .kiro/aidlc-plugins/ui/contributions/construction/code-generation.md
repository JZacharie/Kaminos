---
target: code-generation
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
  requires_stage:
    - ui-freeze
fragments:
  - anchor: before-step:5
    order: 90
  - anchor: before-step:2
    order: 100
  - anchor: before-step:3
    order: 100
  - anchor: before-step:4
    order: 100
  - anchor: before-step:5
    order: 100
  - anchor: before-step:3
    order: 110
  - anchor: before-step:4
    order: 110
  - anchor: before-step:4
    order: 120
---

## fragment: before-step:5

### Step 4a (ui): Wait for the developer subagent in the same turn

After you launch the `aidlc-developer-agent`, wait for its result in the same turn. Never
end the turn with "Still waiting" or any other status line while the file
`aidlc/.aidlc-subagent-inflight` exists. A headless run (`claude -p`) stops at the end of the
turn and kills the subagent that is still running, and the marker stays behind. Continue
with Step 5 only after the subagent has returned and the marker is gone.

## fragment: before-step:2

### Step 1b (ui): The backend data comes from the frozen UI

What the person approved at the UI freeze must be what runs. The backend's initial data
(seed, fixtures, migrations, in-memory store) is generated from the frozen UI data, never invented.

1. If `<record>/ui/src/data.js` exists, run
   `.aidlc-ui/bin/ui-seed-export "<record>/ui"`. It writes `<record>/ui/seed.json` with every
   collection of the UI mock as is.
2. Put a plan step "generate the backend initial data from `seed.json`" in the code-generation plan, and
   in the delegation prompt of Step 4 tell the developer agent to load `seed.json` (or a copy of it) at
   build time. Never write a second data set by hand.
3. A field or collection the backend cannot give is listed in `<record>/ui/mock-only.md`
   with the reason. Do not drop it silently and do not invent a substitute.
4. After the backend builds, save a collection dump of its initial data (or an endpoint response) as JSON and run
   `.aidlc-ui/bin/ui-seed-check "<record>/ui/seed.json" <backend.json>`. A difference that
   `mock-only.md` does not explain is a failed check: fix the backend, do not edit `seed.json`.
5. Build and Test repeats the same check and reports its result.

## fragment: before-step:3

### Step 2b (ui): Run every test command once before the plan is approved

Do this at the end of Step 2, before you present the plan for approval. The approval
covers `unit-test-instructions.md` byte for byte, so a command that cannot run must be
found now.

1. For each distinct test command in `unit-test-instructions.md` and in the plan (the
   runner and its path or glob form), run it once in a scratch folder that holds one
   stub test that passes, using the same runtime and version the unit will use. Check
   the folder form (`dir/`), the glob form and any flag the instructions name.
2. When a command fails to start or finds no test (for example a folder path that the
   installed Node version does not accept), change the instruction to a form that ran,
   then write it in the plan before approval.
3. List in the plan, under the test instructions, each command with the line `ran: ok`
   or `fixed: <old command> -> <new command>`. Delete the scratch folder.

## fragment: before-step:4

### Step 3a (ui): Say when the app runs on sample data

Add this rule to the delegation prompt of Step 4. When the app you generate runs on sample
data (a fixed clock, sample carriers, sample readings, a seeded dataset, a stub in place of a
real service), it must say so:

1. The UI shows a visible "Demo data" label in the header or the footer of every screen, in
   the UI language, as plain text in the existing layout. Do not edit `kit.js` or `kit.css`.
2. The `README.md` the build generates has a "Demo data" section that lists what is
   simulated (for example the fixed clock and the sample sources) and what a real version
   would need instead.

Leave the label out only when every data source is real and say so in the README.

## fragment: before-step:5

### Step 4b (ui): Fixing an approved command that cannot run

When an approved test or build command cannot run during generation, you may change it
to a form that runs, so the build does not stall. The approved text is never changed in
silence:

1. In the same turn, show the person both lines in the stage output, as
   `command changed: <old command> -> <new command>`, with the reason in a few words.
2. Update the instructions file to the new command and add the same line under a
   `## Changed after approval` heading in it. This edit follows the after-approval rules
   of Step 3 (the guard may ask the person again). Never say the person approved the
   new text as written.
3. Count tests only from a run you made. Write the number that run printed.

## fragment: before-step:3

### Step 2c (ui): Commit each unit, or say in the plan that you will not

Do this at the end of Step 2, after the test-command check and before you present the
plan. Read the answers of the practices stage (branch and commit practices).

1. When the workspace is a git repository and the practices ask for commits per chunk
   or unit of work, make the last step of the plan a checkbox `Commit this unit`. In
   it, once the unit's tests pass, run `git add` for the paths of this unit (its source,
   tests and scripts, and the AI-DLC record files written so far) and one
   `git commit -m "feat(<unit>): <what the unit does>"` on the branch the practices name.
2. Never push, never amend, never skip hooks, never change git config, and never add
   files of other units.
3. When the practices say not to commit, or the workspace is not a git repository,
   write the line `Commits: none, because <reason>` at the end of the plan instead.

## fragment: before-step:4

### Step 3b (ui): Front-end code must load in a browser

Apply this to every unit that has front-end code (a page, a script or a module the page
loads). Node tests run in Node with a fake page, so they stay green when the real page
cannot start. Find that now, not in Build and Test after all the units.

1. Add this rule to the delegation prompt of Step 4: code that the page loads must not
   import any `node:*` module (`node:fs`, `node:path` and the like). A browser cannot
   load them, and every screen stays blank. The page gets its data with `fetch` of a path
   the app serves, or by importing an ES module or JSON file the app serves. Code that
   only Node runs (test helpers, build scripts, seed tools) lives under `tests/` or
   `tools/` and is never loaded by a page.
2. After the developer agent returns and before you write the code summary (Step 5),
   load the app's entry page once in a headless browser. Do this in Unit 1 and in every
   unit that adds a page. Start the app on this machine (the command from
   `build-instructions.md` or the unit's plan), then run Chromium against it with no new
   dependency. The binary is `CHROME_PATH`, else the Chromium of Playwright, as for the quality gate:
   `"$CHROME_PATH" --headless=new --no-sandbox --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=5000 --dump-dom http://127.0.0.1:<port>/ > page.html 2> console.log`.
   Stop the app afterwards.
3. The unit fails when `console.log` holds an error line (`Uncaught`, `Access to script`,
   `Failed to load`, `ERR_`) or when the `<body>` of `page.html` has no text and no
   element inside the app's root. Fix the code and run the check again. Do not present
   the unit for approval while it fails.
4. Write the result in the code summary: `browser load check: ok (<url>)` or the failing
   line. When no Chromium exists on this machine, write `browser load check: not run, no Chromium found`
   there. Never skip it without saying so.

## fragment: before-step:4

### Step 3c (ui): The frozen UI is read only in Construction

The person approved `<record>/ui/` at the UI freeze. A change to it in Construction forces a
UI-freeze redo and a restart of Construction, so the developer agent never makes one.

1. Add this rule to the delegation prompt of Step 4: never create, edit or delete anything
   under `<record>/ui/` (`prototype.html`, `ui-map.json`, `src/`, `data.js`). The page is
   read only. When the page and the contract disagree (for example a call that throws where
   the contract says it returns a result), the backend or an adapter file outside `ui/`
   adapts to the page. A difference that cannot be adapted is added to `<record>/ui/mock-only.md`
   with the reason, which is the only file under `ui/` the agent may change.
2. After the developer agent returns and before you present the unit, run
   `.aidlc-ui/bin/validate "<record>" --check-freeze`. On `FREEZE-DIGEST-MISMATCH`, restore
   `<record>/ui/prototype.html` and `<record>/ui/ui-map.json` from
   `<record>/ui/versions/v<uiVersion>/` (the `uiVersion` of the freeze record), run the check
   again, and write in the unit summary which file the agent changed and how it was restored.
   Do not leave the mismatch for the next unit to find.
3. Show every `mock-only.md` entry the unit added in the unit summary.
