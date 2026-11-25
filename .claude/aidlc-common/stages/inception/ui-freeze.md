---
slug: ui-freeze
plugin: ui
phase: inception
execution: ALWAYS
condition: Always runs under the ui-first and ui-workshop scopes, after the last Inception stage and before the first Construction stage.
lead_agent: aidlc-design-agent
support_agents:
  - aidlc-product-agent
mode: inline
produces:
  - ui-freeze-record
consumes:
  - artifact: ui-prototype-index
    required: true
  - artifact: wireframes
    required: true
requires_stage:
  - rough-mockups
  - approval-handoff
  - reverse-engineering
  - practices-discovery
  - requirements-analysis
  - user-stories
  - refined-mockups
  - domain-design
  - units-generation
  - contract-design
  - delivery-planning
sensors:
  - upstream-coverage
scopes:
  - ui-first
  - ui-workshop
inputs: ui-prototype-index, wireframes, and every Inception deliverable
outputs: ui-freeze-record.md (under this stage's record dir, engine-resolved)
---

# UI Freeze

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Construction must not start until the person has confirmed that the clickable
prototype (`prototype.html`) and its `ui-map.json`, built in Intent Capture,
consolidated in Rough Mockups and refined during Inception, are the UI the build
will implement. The approval is bound to the SHA-256 digests of those two files.

`<record>` below is the engine-resolved intent record dir (the folder that
contains `ideation/` and `inception/`). The two UI files live in
`<record>/ui/` (the living interface directory). A record made by an older
add-on keeps them in `<record>/ideation/rough-mockups/`; the validator resolves
the right pair, so use its output and never type a path of your own into a hash.
This stage never edits the two files.

## Steps

### Step 1: Load The Prototype And Its Map

Read `ui-prototype-index.md` from `<record>/ideation/rough-mockups/`, then
`prototype.html`, `ui-map.json` and `ui-changes.md` (if present) from
`<record>/ui/`, every `*-questions.md` that carries `[Anchor]:` lines, and the
Inception deliverables that changed the UI (user stories, refined mockups,
requirements).

### Step 2: Validate

Run `.aidlc-ui/bin/validate "<record>"`. It must report 0 errors. If it reports
errors, STOP: show them to the person and say which stage to repeat (stage 2.5
refined-mockups, or the Canvas app) to fix `prototype.html`, `ui-map.json` or a
questions file; this stage does not edit them. If `.aidlc-ui/bin/validate` does
not exist, STOP and tell the person to install the add-on kit into `.aidlc-ui/`:
a freeze without digests is not valid.

### Step 3: Reconcile Prototype And Inception Decisions

Compare the prototype with the Inception decisions: screens or flows that were
renamed or are missing, requirements (`FR-nn` in `ui-map.json` `frIds`) with no
element, elements with unanswered questions, hidden elements that scope or
stories now need. Note each difference with the anchor ids or screen ids
involved; write `None` when there are none. Do not fix them by editing the two
UI files here: either the person accepts the difference, or the prototype is
refined and this stage is run again.

### Step 3b: List The Mock-Only Data

The prototype may show numbers, fields or texts that are hard-coded in `ui/` and that
the backend will not give (a count, a percentage, a named contact, a status). Find
them in `prototype.html` and in any data file of `<record>/ui/`, and compare with the
contract and the units from the Inception stages. Write `<record>/ui/mock-only.md`
(this file is not one of the two frozen files and is not hashed):

- one line per item: where it shows (screen or anchor id), the mock value, why the
  backend will not give it.
- a last line `Backend will give: <what the running app will show instead, for
  example "the seed data of the units, not these counts">`.
- the single word `None` when there is no such data.

`validate --check-freeze` fails when this file is missing or empty.

### Step 4: Write The Freeze Record With The Digests

Run `.aidlc-ui/bin/validate "<record>" --print-digests`. It prints JSON with
`uiVersion`, `prototypeSha256` and `uiMapSha256`. Copy the values exactly from
that output; never type, estimate or recompute a hash by hand.

Write `ui-freeze-record.md` in this stage's record dir. Its first lines are
exactly these three, one per line, with no other text on them:

```
uiVersion: <N>
prototype.html sha256: <64 hex>
ui-map.json sha256: <64 hex>
```

Then the sections, with these exact headings:

- `## Frozen Screens`: one line per screen of `ui-map.json`: id, title, route.
- `## Frozen Elements`: one line per element: anchor id, label, linked FR ids
  (`-` when none).
- `## Open Differences`: the bullets from Step 3, or `None`.
- `## Mock-only data`: the content of `ui/mock-only.md` (Step 3b), copied.
- `## Freeze Statement`: one short paragraph: these two files at this `uiVersion`
  and these digests are the UI that Construction implements; the approval is
  valid only while the digests are current.

### Step 5: Check The Record

Run `.aidlc-ui/bin/validate "<record>" --check-freeze`. Fix `ui-freeze-record.md`
until it reports PASS. If the digests do not match because a UI file changed
meanwhile, run Step 4 again.

### Step 6: Open The Approval Gate

Run `aidlc engine orchestrate report --stage ui-freeze --result awaiting-approval`.

### Step 7: Present Completion & Request Approval

Completion emoji: :snowflake:
Review path: this stage's engine-resolved record dir.
The completion message contains these lines (replace `<N>` with the `uiVersion`):

- `UI FROZEN (v<N>) once approved. Construction will use these exact files.`
- A `Mock-only data` section: the items of `ui/mock-only.md` and its `Backend will give:`
  line, so the person knows which numbers on the screen are not real data. Never leave it out.
- The approval is valid only while the digests in `ui-freeze-record.md` are
  current. If `prototype.html` or `ui-map.json` change after the approval
  (also through the Canvas app), the freeze must be redone and approved again.

Standard 2-option approval (Approve / Request Changes).
STOP for the human response: the approval is a message the person types in this
chat. Never approve on their behalf and never run this stage unattended. Report
Approve with `--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
artifacts (run Steps 3-5 again when the UI files changed), then report
`--result revised` before re-presenting.

## Sensors

This stage's outputs are markdown artefacts under its record dir. The imported `upstream-coverage` sensor checks them.

## Learn

While running this stage, record observations in the engine-created
`<record>/<phase>/<stage>/memory.md`. Treat it as an output-only target:
never read, probe, create, or initialize it. Follow the active harness's
diary-write discipline when inserting entries under Interpretations,
Deviations, Tradeoffs, and Open questions, each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
