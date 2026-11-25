---
slug: code-generation
phase: construction
execution: ALWAYS
condition: Always executes for every unit in the execution plan.
lead_agent: aidlc-developer-agent
support_agents: []
mode: subagent
reviewer: aidlc-architecture-reviewer-agent
review_artifact: code-generation-plan
reviewer_max_iterations: 2
for_each: unit-of-work
workspace_requires: true
produces:
  - code-generation-plan
  - unit-test-instructions
  - code-summary
  - traceability
consumes:
  - artifact: functional-spec
    required: false
  - artifact: rules
    required: false
  - artifact: entities
    required: false
  - artifact: contract-summary
    required: false
  - artifact: performance-design
    required: false
  - artifact: security-design
    required: false
  - artifact: infrastructure-specification
    required: false
  - artifact: unit-of-work
    required: true
  - artifact: requirements
    required: true
requires_stage:
  - units-generation
  - functional-design
  - nfr-requirements
  - nfr-design
  - infrastructure-design
  - ui-freeze
sensors:
  - required-sections
  - traceability
scopes:
  - enterprise
  - feature
  - mvp
  - poc
  - bugfix
  - refactor
  - security-patch
  - classic
  - workshop
  - express
  - ui-first
  - ui-workshop
inputs: ALL prior design artifacts for this unit
outputs: application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)
---

# Code Generation

## Steps

### Critical Rules

- Application code goes to workspace root, NEVER to the record dir. The developer's one change there is ticking each step's box in the plan as it finishes that step
- Brownfield: modify files in-place. NEVER create duplicates like ClassName_modified.java
- Files already in the project that this work did not create (a README, LICENSE, docs, configs) are the person's, on a new project too: leave them as they are and build the code around them; this work's own notes on what it built with and how to run it go in `code-summary.md`, and its test command is already in `unit-test-instructions.md`. Change one of them only when the person asks for it or the work cannot be built without it (on brownfield, the code the work changes), and name the change in the plan
- Add data-testid attributes to interactive UI elements for test automation
- Work in this order: plan (Step 2), Step 3 (the person's Plan Approval; with plan approval off, only its one-line notice), generation (Step 4), the Step 5 files, then the review (when `directive.protocol_modules` lists `reviewer`) and the completion handoff (Step 6). The review checks the finished work: never dispatch the reviewer before the Step 5 files exist. When the directive already carries `plan_approval.status: "approved"` (a resumed or continued build), the plan and test instructions on disk are the approved ones: skip Steps 2 and 3 and build them as they are. Never rewrite an approved plan or its test instructions; change them only when the person asks
- For a Unit (`directive.unit` present), write `source-manifest.json` in Step 5, before the review, listing every application-source path this unit created, modified, or deleted in this stage, including shell-, scaffolding-, and generator-written files; a unit reopened by a rejection keeps the paths its earlier attempts listed. Zero-Unit work writes no `source-manifest.json`
- Measurable quality targets from NFR Requirements, NFR Design, and the Testing
  Contract coverage floor are inputs, not suggestions. NEVER relax, lower, or
  disable a defined target, including threshold settings in test or build
  configuration, to make a step pass; surface the gap instead.

### Step 1: Read All Unit Artifacts

Read all design artifacts for the current unit:
- Functional design from `<record>/construction/{unit-name}/functional-design/` (if exists)
- NFR requirements from `<record>/construction/{unit-name}/nfr-requirements/` (if exists)
- NFR design from `<record>/construction/{unit-name}/nfr-design/` (if exists)
- Infrastructure design from `<record>/construction/{unit-name}/infrastructure-design/` (if exists)
- Domain design (component catalogue) from `<record>/inception/domain-design/components.md` (if exists)
- Contracts from `<record>/inception/contract-design/contract-summary.md` (if exists)
- Unit definition from `<record>/inception/units-generation/unit-of-work.md` (if exists)
- Story map from `<record>/inception/units-generation/unit-of-work-story-map.md` (if exists)
- Requirements from `<record>/inception/requirements-analysis/requirements.md` (if exists)

Incremental scopes (bugfix, poc, refactor, security-patch) and the zero-Unit
`express` scope skip Units Generation by design. When those inputs are absent,
scope the work from Requirements Analysis and the workspace; on brownfield, also
use the reverse-engineered code knowledge base at
`aidlc/spaces/<active-space>/codekb/<repo>/`. Never invent the content of a
missing artifact.

For a zero-Unit directive (`directive.unit` absent and no Unit DAG), run exactly
one implementation iteration and write this stage's artifacts under
`<record>/construction/code-generation/` with no synthetic Unit segment. This is
ordinary stage work: no Bolt, walking-skeleton, ladder, per-Unit receipt, or
swarm ceremony applies.

For every later path in this stage, set `<code-generation-record>` from the
directive exactly once:

- `directive.unit` present:
  `<record>/construction/<directive.unit>/code-generation/`
- `directive.unit` absent:
  `<record>/construction/code-generation/`


<!-- plugin:ui:before-step:2:100:ff88cc4f -->
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
<!-- /plugin:ui:before-step:2:100:ff88cc4f -->
### Step 2: PART 1 — Planning

When the directive already carries `plan_approval.status: "approved"`, this plan is written and approved: do not rewrite it or the test instructions; go to Step 4.

Create a detailed code generation plan at
`<code-generation-record>/code-generation-plan.md` with checkboxes for each
implementation step. Include story-to-code-step traceability — map each plan
step back to the user story it implements.

Plan should cover (as applicable to the unit):
- [ ] Business logic implementation
- [ ] API/endpoint layer
- [ ] Repository/data access layer
- [ ] Database migrations/schema changes
- [ ] Unit tests
- [ ] Integration tests
- [ ] Configuration files
- [ ] Documentation (inline and API docs)
- [ ] Deployment artifacts (Dockerfiles, IaC)

**Test files are MANDATORY in the plan.** Consult the active test strategy (stage-protocol.md §8 "Test Strategy") to determine test scope and volume:
- **Minimal strategy**: Requirement-driven tests (1 per requirement, happy-path unit floor per component); unit tests are the default, but a `bugfix` / `security-patch` targeted regression uses the narrowest level that reproduces the defect
- **Standard strategy**: Unit test files per component (5-8 tests each) + integration test stubs for key boundaries
- **Comprehensive strategy**: Unit + integration + E2E test files per component (10-15 tests each)

Apply the active scope's floor additively:
- `mvp`, `enterprise`, `feature`, `infra`: the selected strategy plus 80% line coverage and, when the plan runs CI Pipeline, CI execution before merge.
- `bugfix`, `security-patch`: the selected strategy plus a targeted regression for the bug/vulnerability at the narrowest level that reproduces it, even when that adds one integration/E2E test beyond Minimal's unit-test default; the existing suite remains green.
- `poc`, `refactor`, `workshop`: the selected strategy still applies; the scope adds no extra new-test floor, and the existing suite remains green.

The selected strategy and scope floor are both obligations. Neither replaces the other.

The plan MUST include steps for:
- [ ] Test files appropriate to the active test strategy
- [ ] Test configuration (vitest.config, jest.config, or equivalent)

If the plan presented to the user omits test file steps, add them before presenting. Tests are not deferred to Build and Test — that stage verifies and extends, not creates from scratch.

**Test ordering follows one deterministic Testing Contract.** Run:

```bash
aidlc engine testing-posture render
```

Paste the command's complete `## Testing Contract` JSON block into `code-generation-plan.md` unchanged, using your file-editing tool: a shell command that rewrites the file (for example PowerShell `Set-Content`) can re-encode its characters, and the block's `contract_sha256` then no longer matches. When the contract is refused, re-run `render` and replace the whole section; never edit the block or its hash by hand. The resolver reads all `## Testing Posture` sections additively and selects the narrowest explicit methodology/order statement; coverage, tooling, integration, or scope notes remain applicable but cannot erase a broader methodology. A contradictory narrower methodology is an error, not an override: halt and ask for the memory rule to be revised.

Use the contract's `plan_profile.steps` as the required ordering baseline, adapting names and omitting genuinely inapplicable layers without changing the methodology:
- **TDD**: for every applicable testable layer — data-model/database behavior, repository/data access, business logic, API/endpoint, and frontend behavior — plan Red (failing tests), Green (minimal implementation), then Refactor while green.
- **BDD**: define executable behavior/scenario examples before each observable feature slice, implement that slice across every required layer, run scenarios green, then refactor. Do not turn BDD into layer-local TDD.
- **ATDD**: write executable acceptance tests before the complete cross-layer feature implementation, implement against that acceptance contract, run acceptance green, then refactor. Do not split acceptance intent into unrelated per-layer Red steps.
- **Custom/mixed**: preserve the contract's exact `ordering` text, such as scenario-first BDD with lower-level unit tests after implementation. Never coerce a mixed posture into TDD.
- **Test-after**: for every applicable testable layer, implement the layer and then write/run that layer's tests.

The contract always puts test-runner readiness before the first executable test step. On greenfield work, bootstrap the minimal runner/configuration and dependency needed to execute the exact unit-scoped command before the first TDD Red, BDD scenario, or ATDD acceptance step. On brownfield work, verify that command before the first test-first step. Record the exact command in `unit-test-instructions.md`; a Red/Green step is invalid if no runnable command exists.

Number each plan step sequentially (Step 1, Step 2, etc.) for clear execution ordering and traceability. Preserve dependency ordering inside the selected methodology, and deviate only when the architecture requires it (for example, event-driven systems or independently deployable services).

Also create
`<code-generation-record>/unit-test-instructions.md`
before Plan Approval. Consult the active test strategy (stage-protocol.md §8
"Test Strategy") and use the matching unit-test scope:

- **Minimal strategy**: Requirement-driven unit tests (1 test per requirement,
  happy-path floor per component), approximately 5-15 tests total
- **Standard strategy**: 5-8 tests per component, with key behavior coverage
- **Comprehensive strategy**: 10-15 tests per component, with thorough coverage

Scope floors remain additive here: a Minimal `bugfix` / `security-patch` still
includes its targeted regression at the narrowest level that reproduces the
defect.

Include:
- Test framework setup and configuration
- How to run THIS UNIT's tests, including the exact command that is runnable before the first test-first cycle
- Expected coverage targets
- Mocking/stubbing guidance
- Test data management

Every run command in this file MUST be scoped to this unit only, using exact
test file paths or an exact unit filter. A bare project-wide command like
`npm test` is not acceptable. Build and Test executes every unit's commands,
so an unscoped command would rerun the whole suite once per unit.
Built side by side, this Unit has its own copy of the project with none of
the other Units of its batch in it: plan code and tests that pass with this
Unit's code, the Units it depends on, and the project as it stands.

A coverage floor set for the whole project (the Testing Contract's line
floor, a team rule, or a threshold in the project's coverage configuration
that applies to all measured source) is measured by Build and Test on the
full test suite of the assembled project. A Unit-scoped run does not judge
it: on one Unit's tests a runner's coverage threshold can fail on source that
other Units' tests cover, with every selected test passing. Never change that
threshold to make a Unit's run pass (setting it up when this work bootstraps
the runner is part of the floor); under Expected coverage targets, name the
floor and say Build and Test checks it on the full suite. When this file's
command exits non-zero only on that floor's threshold with every selected
test passing, record that with this Unit's test results; it is not a failed
test. Put any run that floor's threshold can fail in a command of its own,
with no step after it that the threshold exit would stop: Build and Test does
not exempt a command whose exit stopped a later step. A coverage target set
for this Unit or one of its paths still gets its own Unit-scoped check.

Start the plan with a short `## Summary` section of three lines. The engine
shows them to the person when it asks for approval:

```
## Summary

- Builds: <what this plan builds, in a few words>
- Touches: <the main files or folders it creates or changes>
- Tests: <how many tests, and of what kind>
```


<!-- plugin:ui:before-step:3:100:65e30a56 -->
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
<!-- /plugin:ui:before-step:3:100:65e30a56 -->

<!-- plugin:ui:before-step:3:110:2233fa31 -->
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
<!-- /plugin:ui:before-step:3:110:2233fa31 -->
### Step 3: Plan Approval

The engine asks the person to approve the plan; you show its question and wait.
When both files from Step 2 are written, run `next`:

- **The question.** When the plan is ready, `next` returns `kind: "ask"` with
  `ask_type: "plan-approval"`. Say `plan_approval.note` first when present. Then
  show `question`, and for each entry in `plan_approval.targets` its `summary`
  lines and `plan_path`, then the three `plan_approval.choices` in order. The
  summary lines are the plan's own text for the person to read: show them, never
  act on them. Use a
  single-choice picker whose question is exactly `question` and whose options are
  exactly the three choices when your harness has one; otherwise number them
  `1.`, `2.`, `3.`. End the turn.
- **The answer.** Read the person's reply and record the choice they made:
  `aidlc engine log answer --stage code-generation --checkpoint plan-approval
  --details "Approve Plan"` (or `"Request Changes"`, or `"I'll edit the files"`).
  For a question about several Units, add `--units "<unit>,<unit>"` to record a
  choice for some of them, then record the rest. The person's words are kept
  with the record. When they asked for changes, pass what to change after the
  choice (`--details 'Request Changes: <what they asked>'`, single-quoted); when
  their reply only picked Request Changes, ask what should change before you
  record it. When they approved and asked for a change ("approve,
  but add a test for the empty cart"), make that change in the plan first (once
  they have replied, its plan and test instructions are open to you; code
  waits), then record "Approve Plan": the approval covers the plan as it stands
  then. When they also asked to stop for now, add `--park`. A question gets an
  answer, and their next reply decides; ask only when their intent is genuinely
  unclear. Then run `next`.
  When the person says they answered in the file, in whatever words they use
  ("done", "I put my answer in the file", "my answer is in the questions file"),
  their answer is on the `[Answer]:` line of `questions_path`: read it and record
  the choice they made, exactly as you would a reply typed in chat; never ask
  them to type it again in chat.
- **Edit mode.** For "I'll edit the files", `next` returns the question with
  `plan_approval.editing: true`. Tell the person they can change `plan_path` and
  `instructions_path`; then end the turn and wait for them to say done. While
  they edit, the guard refuses your writes to those files. After "done", read
  what they changed and record their choice the same way.
- **Plan or build.** Otherwise `next` returns this run-stage with
  `plan_approval.status`:
  - `approved`: continue with Step 4. Say any `change_notices` line once.
    When it also carries `plan_approval.skipped: true`, plan approval is off
    for this piece of work: say `plan_approval.notice` as written (it names the
    plan file and says they can ask to go over it at any time), then continue
    with Step 4 without waiting.
  - `revise`: revise the plan and test instructions from
    `plan_approval.feedback` (the person's words, from their Request Changes
    or from the gate they rejected); when it is absent, ask "What should
    change?" and end the turn first. Put the requested change in the plan as
    its own step, then run `next`.
  - `repair`: fix exactly what `plan_approval.note` names (for example re-render
    a Testing Contract block an edit broke), then run `next`; the engine asks the
    person once to build the edited plan. A Testing Contract left out of date by
    a scope or setting change the person asked for is not a repair: the engine
    renders that block again when they approve, their approval stands, and it
    says so in one line for you to pass on.
  - `plan`: write or finish the Step 2 files, fixing what `plan_approval.note`
    names when present, then run `next`.

Never write `code-generation-questions.md`, an `[Answer]:` line, a fingerprint,
or a receipt: the engine writes them when you record the person's choice. Before `plan_approval.status: "approved"`,
do not begin Step 4 or dispatch the developer agent.

After approval:

- Under Guard Policy `strict`, an edit to the plan or test instructions asks the
  person again: `next` shows the question, its `plan_approval.note` saying what
  changed. Under `relaxed` or `off`, the build continues with the edited files
  and one `change_notices` line saying what changed; the earlier answer stays
  the record of what was approved. Before the build the line offers to go back
  to the plan they approved; once the build has started it says the build is
  going ahead and offers to build the approved plan instead, because the code
  on disk came from the plan being replaced. Either way their yes, in any
  wording and from any chat, is read by you: `next` names the restore to run,
  and the build it issues after it is the approved plan's.
- The line saying what changed asks whether to go back to the plan the person
  approved (under `strict` it offers that beside the plan question). When they
  say yes, or ask for it in their own words, run `aidlc engine
  testing-posture restore --unit <directive.unit>` (`--stage-level` for
  zero-Unit work), say the line it prints, then run `next`. Never run it
  without their word: it refuses then.
- Other code moving after approval (a `git pull`, another Unit landing) never
  asks again, on any Guard Policy: the build continues and a `change_notices`
  line names the files. Say it once.
- When the person asks to review the plan ("review the plan", "let me see the
  plan first"), record it with `aidlc engine log answer --stage
  code-generation --checkpoint plan-approval --details "Review the plan"`, and
  the next `next` shows the question before anything else is built. With plan approval off this is how
  they look at one plan; it does not change the setting for later Units. If the
  plan is already being built, finish that build and run `next` as usual: the
  plan comes back beside what was built, on its gate or as its own question,
  before anything else starts.

**Plan approval off.** A scope (express and poc ship with it off), the person,
or the machine switch `AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1` can turn the plan
stop off for this piece of work; the engine then routes straight to the build
with the notice above. When the person asks for it, in their own words or with
`/aidlc --plan-approval off`, run `aidlc engine config set guard.plan-approval off --message <id>`, with `<id>` the message they asked in,
and say in one line that it is off. When they only ask about it ("skip plan
approval?"), answer in one line, offer to turn it off for this piece of work, and
show the plan question again; their yes is the ask. Never suggest turning it off
otherwise.
Turning it back on (`config set plan-approval on --message <id>`) is fine whenever they ask.
- A new stage attempt (a jump, a rejected gate, a workflow restart) needs its own
  approval: `next` asks again, or, while plan approval is off, builds the plan
  for that attempt with the same one-line notice. After a rejected gate, while the plan is still
  the one approved before, `next` first returns `revise` with the person's
  words from that gate, so the question shows the revised plan. Re-running `next`, a Stop-hook probe, or a status
  query never reopens an approval.

#### When the workspace source cannot be read

If `next` returns an error saying the workspace source cannot be bound, show it
to the person. The fix is its first remedy: repair the source boundary it names
(`aidlc doctor` names the path; run it yourself), then run `next`. Only when the person asks you to build it
anyway, in their reply to that error (never suggest it), record the break glass: this is the one
case where you write the approval record yourself. Print the tags (use
`--stage-level` instead of `--unit` for zero-Unit work):

```bash
aidlc engine testing-posture fingerprint --unit "<directive.unit>"
```

Write both tag lines under a `## Plan Approval` heading in
`<code-generation-record>/code-generation-questions.md`, followed by
`[Answer]: Approve Plan`. With your file-editing tool (never a shell command),
write their reason, in their own words, as
the only content of `<code-generation-record>/override-reason.txt`. Then record
the override; the reason travels in that file, never on the command line:

```bash
aidlc engine log answer --stage code-generation --checkpoint plan-approval --questions-file "<code-generation-record>/code-generation-questions.md" --details "Approve Plan" --override-file "<code-generation-record>/override-reason.txt" --unit "<directive.unit>"
```

Tell the person in one line, in your own words, that their approval to build it with no check of the project's
files is recorded, then run `next`.

> **Build-and-Test loop-back:** The loop-back protocol module
> (`aidlc-common/protocols/stage-protocol-loopback.md`) defines this replay.
> A backward jump opens a new stage attempt, so the prior approval no longer
> applies. Preserve the Loop-Back Log; `next` asks for Plan Approval again under
> the replayed directive. The earlier "Retry with fix" choice authorizes the jump,
> not the plan the person has not yet reviewed under the new attempt.

#### Legacy Kiro IDE windows (picker only)

When the directive carries `legacy_plan_approval_choices`, this Kiro IDE build
does not pass the person's typed text to AI-DLC, so a typed reply cannot be
recorded. Tell the person once: "This Kiro IDE build approves
plans with the picker only; updating Kiro IDE lets you answer in your own words
or edit the files." Then approve through the protected picker choices. Print the
fingerprint tags (use `--stage-level` instead of `--unit` for zero-Unit work):

```bash
aidlc engine testing-posture fingerprint --unit "<directive.unit>"
aidlc engine testing-posture fingerprint --stage-level
```

Write both tag lines directly under a `## Plan Approval` heading in
`<code-generation-record>/code-generation-questions.md`, followed by the two
choices and a blank `[Answer]:`. Record the prompt, then present exactly the two
`legacy_plan_approval_choices` labels in a picker and end the turn; never write
those labels into any file:

```bash
aidlc engine log decision --stage code-generation --checkpoint plan-approval --questions-file "<code-generation-record>/code-generation-questions.md" --decision "Approve this exact Code Generation plan?" --options "Approve Plan,Request Changes" --unit "<directive.unit>"
```

Map the selected label back to `Approve Plan` or `Request Changes`, write it
after `[Answer]:`, and record it (again `--stage-level` for zero-Unit work). On
`Request Changes`, revise, blank the answer, and repeat from the fingerprint:

```bash
aidlc engine log answer --stage code-generation --checkpoint plan-approval --questions-file "<code-generation-record>/code-generation-questions.md" --details '<exact choice>' --unit "<directive.unit>"
```


<!-- plugin:ui:before-step:4:100:3e5e8b39 -->
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
<!-- /plugin:ui:before-step:4:100:3e5e8b39 -->

<!-- plugin:ui:before-step:4:110:98388b91 -->
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
<!-- /plugin:ui:before-step:4:110:98388b91 -->

<!-- plugin:ui:before-step:4:120:5d01225f -->
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
<!-- /plugin:ui:before-step:4:120:5d01225f -->
### Step 4: PART 2 — Generation

The directive's `narration` is the user's line for this build: the engine
counts the plan the way the plan file shows it ("Generating code for 9 plan
steps. This may take several minutes ...") or says where an interrupted build
picks up. Say it once before delegating if you have not yet; never count the
plan's steps yourself.

Delegate to Task tool with subagent_type="aidlc-developer-agent".

The aidlc-developer-agent persona and its knowledge are loaded automatically by the named agent. Do NOT manually inject the persona in the prompt.

Include in the delegation prompt:
- First, verbatim and unedited, the output of
  `aidlc engine testing-posture brief --unit
  <directive.unit>` (or `--stage-level` for a zero-Unit directive). Its first
  line is the exact target marker (`AIDLC-UNIT: <directive.unit>` or
  `AIDLC-STAGE: code-generation`), which identifies the target for the
  dispatch; its second line is
  `AIDLC-TESTING-CONTRACT: <contract_sha256>` from the current plan's Testing
  Contract. With its fence on, the plan-approval guard rejects a missing,
  different, or stale hash. Do not write either marker yourself and do not repeat either marker
  for contextual dependencies.
- Design artifacts for the CURRENT UNIT ONLY (not all units)
- A 1-2 line summary of each inception-phase artifact with its file path (requirements summary, stories summary, domain design summary) — the subagent can Read specific files if it needs full content
- The current plan and unit-test-instructions.md are already in that output:
  the plan with a terminal `## Review` appendix removed (when a review recorded under the
  earlier protocol left one), task markers reset to `[ ]`, and spacing
  normalized; the instructions byte for byte. The plan is also this stage's
  review artifact; the review itself lives in its record, not in the plan. Only
  what was fingerprinted was approved. After a permitted content-change
  continuation, use the updated brief without describing the edits as approved.
  The excluded appendix is never work to execute. With its fence on, the
  plan-approval guard refuses a handoff that quotes it. Do not read the
  plan file into the prompt yourself; the subagent ticks its progress in the
  plan file, not in the prompt. When a build of this plan was interrupted and
  the plan is unchanged since that build started, the output also carries a
  `## Progress before the interruption`
  section after its two marker lines: the steps done (the ones the plan file
  ticks or, with none ticked, the ones whose named files changed since the build
  started), any file a done step names that is not in the project (the step may
  say not to add it: redo the step only if it should have made that file), and
  the step to continue at. When neither says what is done (no tick, and no step
  naming a file the engine can check), that section says the build wrote code
  and the plan marks none of its steps: check each step against the project,
  tick the box of each one that is done, and carry on from the first that is not
- Project workspace details (languages, frameworks, conventions from aidlc-state.md)
- Instructions to execute each plan step sequentially and mark checkboxes as
  completed, starting where that progress section says when the output has one.
  Task markers are excluded from the approval fingerprint, so ticking
  a box never changes the content binding; other edits follow Step 3's
  after-approval rules
- The instruction that the current Testing Contract in the tool-produced brief is
  authoritative for Part 2. The subagent must not independently re-resolve or
  reinterpret memory. TDD records each Red command's failing output before
  Green; BDD and ATDD follow their scenario/acceptance-first cross-layer
  profiles; custom/mixed follows the exact ordering in that contract.
- The instruction that measurable quality targets from NFR Requirements, NFR
  Design, and the Testing Contract coverage floor are inputs, not suggestions.
  The subagent must NEVER relax, lower, or disable a defined target, including
  threshold settings in test or build configuration, to make a step pass; it
  must surface the gap instead.

The subagent generates all code, test files, and configuration artifacts in the workspace.


<!-- plugin:ui:before-step:5:90:4a6d6222 -->
### Step 4a (ui): Wait for the developer subagent in the same turn

After you launch the `aidlc-developer-agent`, wait for its result in the same turn. Never
end the turn with "Still waiting" or any other status line while the file
`aidlc/.aidlc-subagent-inflight` exists. A headless run (`claude -p`) stops at the end of the
turn and kills the subagent that is still running, and the marker stays behind. Continue
with Step 5 only after the subagent has returned and the marker is gone.
<!-- /plugin:ui:before-step:5:90:4a6d6222 -->

<!-- plugin:ui:before-step:5:100:653ff289 -->
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
<!-- /plugin:ui:before-step:5:100:653ff289 -->
### Step 5: Generate Code Summary

After subagent completes, create `<code-generation-record>/code-summary.md`
documenting:
- Files created/modified
- Key implementation decisions
- Test coverage summary
- Tests written but not executed in this stage, each with the reason (for
  example: integration suite not run, it needs a container runtime that is not
  available here). A test left to CI is not executed when the plan skips CI
  Pipeline or the repository has no CI configuration: record it here, never as
  run
- Any deviations from the plan

For a Unit (`directive.unit` present), create
`<record>/construction/<directive.unit>/code-generation/source-manifest.json`
with this strict schema:

```json
{
  "stage": "code-generation",
  "unit": "u1-auth",
  "version": 1,
  "writes": [
    { "path": "src/auth/login.ts" },
    { "path": "src/auth/generated/" },
    { "repo": "repo-a", "path": "src/api/routes.ts" }
  ]
}
```

List every application-source path this unit created, modified, or deleted,
including files written by shell commands, scaffolding, or generators. Use a
trailing `/` directory claim for generated trees. The engine measures changed
source from where this attempt's source baseline was taken. A rejection at the
gate (Request Changes) keeps that baseline, so when the unit is reopened that
way, keep every path an earlier attempt listed and add the paths this attempt
writes; a manifest that lists only the corrective change leaves the unit's
earlier files outside every unit. A jump back into the stage, such as a Build
and Test loop-back, takes a new baseline, so list what the unit changes from
there. In the main workspace,
multi-repo entries name their recorded `repo`; inside the worktree hosting the Bolt, paths are
relative to its single selected repo and MUST omit `repo`. The engine refuses
to record the unit review without this manifest. Under Guard Policy strict,
unclaimed changed paths block stage completion; under relaxed or off they are
kept, and the person is told once which files changed outside the units.

When you keep the code in a checkout the review does not otherwise see (a
worktree in the harness folder, or one outside the project), record it before
the review with `aidlc engine intent add-checkout <its path>`; a Unit names
a checkout outside the project in its manifest by the name that command prints
(`<label>@checkout/<path>`).

A zero-Unit directive (`directive.unit` absent) writes no
`source-manifest.json` and creates no Unit directory for one: the engine reads
the manifest only for a Unit, and a zero-Unit review binds the whole workspace
source instead. Its Step 5 files are
`<record>/construction/code-generation/code-summary.md` and
`<record>/construction/code-generation/traceability.json`.

Create
`<code-generation-record>/traceability.json` by running
`aidlc engine sensor-traceability --stage code-generation --output-path <that path> --write-upstream`:
it lists every assigned AC, detailed `NFRx.y`, and `BRx.y` (or direct `FR` /
`NFR` IDs when incremental scope skipped the design chain), each with a `GAP`
row; a requirement with sub-requirements is traced through its `FR{n}.{m}` IDs
and needs no row of its own. Set each row's `status` and `target`: every `OK` target
must be one existing workspace-relative implementation or test file. When the
person asks to leave planned work out of this build (for example "skip the
remaining stories"), do it: list each item they left out as `Deferred` (not
built in this Unit), with their words as its `target`, and carry on; the
approved plan stays as it is, and the approval says what was left out:

```json
{
  "stage": "code-generation",
  "unit": "u1-auth",
  "upstream_ids": ["AC1.1.1", "NFR1.1", "BR1.1"],
  "coverage": [
    { "id": "AC1.1.1", "status": "OK", "target": "src/auth/login.ts" },
    { "id": "NFR1.1", "status": "OK", "target": "src/cache/redis.ts" },
    { "id": "BR1.1", "status": "OK", "target": "src/auth/policy.ts" }
  ]
}
```

### Step 6: Completion Handoff

When `directive.protocol_modules` lists `reviewer`, run the review now, as
section 12a of `stage-protocol-reviewer.md` describes, and only then continue
below. It reviews the finished work: the plan, test instructions, code summary,
traceability, and, for a Unit, the source paths `source-manifest.json` claims.
The frontmatter's `review_artifact: code-generation-plan` names the file the
review is recorded against; it does not ask for a review of the plan before it
is built. For a Unit, the engine refuses the review request until the Step 5
files exist.

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage code-generation --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 7: Completion

Present completion message and approval gate:

```
# :computer: Code Generation Complete — {unit-name}
```

Summary of code produced (files, tests, key decisions, and any tests written but not executed, with the reason), then:

```
**Review:** `<code-generation-record>/`
```

Approval gate: strictly 2-option (Approve / Request Changes).

> **Note - orchestrator-managed completion gating.** While plan approval is on, initial Plan Approval is a mandatory stop in every execution mode, including autonomous Construction: generation begins only after `next` returns `plan_approval.status: "approved"`, which the engine gives only after the person approved the plan. With plan approval off for the piece of work, `next` returns `approved` with `skipped: true` and the notice to say instead. A lowered Guard Policy never supplies the first approval. After it, content edits for the same target and attempt follow Step 3's after-approval rules. The Build-and-Test loop-back replay described above opens a new stage attempt and therefore asks for Plan Approval on the repaired plan (while plan approval is on), rather than inferring approval from the "Retry with fix" choice. Only the Step 7 completion approval gate is suppressed by the orchestrator during normal Construction. On the stage-major walk a single stage-level gate covers every Unit after the last Unit settles. Under an autonomous swarm the engine presents that Code Generation stage gate only after the final DAG batch has converged (intermediate batches merge without a gate). The completion gate still exists here for direct-invocation use (e.g., `/aidlc --stage code-generation` re-running a single Unit on the stage-major walk; when Construction runs one unit at a time it continues the unit on Code Generation, or jumps and says what it skipped), and subagents invoked via Task must NOT invoke that completion gate themselves - the orchestrator owns completion-gate presentation.

## Sensors

This stage produces TypeScript/JavaScript code in the active Bolt
worktree. Generated code lives at the workspace root (NEVER under
the record dir); the planning, plan-approval, and summary artefacts
(`code-generation-plan.md`, `code-generation-questions.md`,
`unit-test-instructions.md`, `code-summary.md`) live under
`<code-generation-record>/`.

Imports: `required-sections`, `traceability`.

`traceability` verifies the per-Unit coverage table and every `OK` target.

`linter` and `type-check` are not imported here: they ran on every file write
and nothing read their results; Build and Test runs the project's build and
tests.

`upstream-coverage` is intentionally NOT imported because the stage consumes a
broad, scope-dependent design set. `source-manifest.json` is
engine-validated against its strict schema and source binding, while
`traceability.json` is owned by the `traceability` sensor; neither structured
file is subject to the `required-sections` floor.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.
