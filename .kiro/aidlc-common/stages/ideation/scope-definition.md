---
slug: scope-definition
phase: ideation
execution: ALWAYS
condition: Always executes — defines the scope boundary and prioritized backlog
lead_agent: aidlc-product-agent
support_agents:
  - aidlc-delivery-agent
mode: inline
summary_confirmation: required
produces:
  - scope-document
  - intent-backlog
  - scope-definition-questions
consumes:
  - artifact: intent-statement
    required: true
  - artifact: feasibility-assessment
    required: false
  - artifact: constraint-register
    required: false
requires_stage:
  - intent-capture
  - feasibility
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - enterprise
  - feature
  - mvp
  - ui-first
  - ui-workshop
inputs: Intent statement, feasibility assessment, constraint register
outputs: scope-document.md, intent-backlog.md, scope-definition-questions.md (under this stage's record dir, engine-resolved)
---

# Scope Definition & Prioritization

## Steps

### Step 1: Load Prior Context

- Read intent statement from `<record>/ideation/intent-capture/`
- Read feasibility assessment from `<record>/ideation/feasibility/` (if exists)
- Read constraint register and RAID log (if exist)


<!-- plugin:ui:before-step:2:100:20850016 -->
### Step 1a (ui): Anchor the scope questions that are about interface elements

Version 1 of the interface is in `<record>/ui/` (`prototype.html` and `ui-map.json`).
Scope decisions often name a visible capability (a map legend, a lot search, a CO2 card).
When you write the questions file in Step 2, link such a question to the element that
shows it, so the scope board and the prototype talk about the same thing.

1. Add an anchor only to a question about one visible capability or element that
   version 1 already shows. Sequencing, deadline and dependency questions get none. A
   capability version 1 does not show gets none either. Never force one.
2. Read `<record>/ui/ui-map.json` and use only an `id` from its `elements[]`. Never invent
   an id in this stage.
3. Add one line `[Anchor]: a-<id>` directly under the question's `Q<n>.` heading, before
   the "Why we ask" text and the options. At most one per question. Agent-written
   questions here carry no `[Kind]:` line. Reuse an anchor of an earlier questions file
   when it is the same element.
4. A question about a catalog module (login, table, chatbot) gets no `[Anchor]:`; the
   Canvas app shows it on the module's palette card. Never describe a catalog module's
   internals.
5. Write nothing else for anchors in the questions file: no extra section, no table.
   Follow-up questions created in Step 3 follow the same rules.
6. Step 4's scope document must state clearly which capabilities are in the first
   version, later, or out (catalog modules login, table and chatbot included): stage 1.6
   turns that into the `modules` list of `ui-map.json`.
7. The answer mode was chosen in stage 1.1 and the engine reuses it: do not ask the mode
   again. After the person says "done", read `scope-definition-questions.md` with the
   Read tool before you use any answer. A file-change hint or your memory of what
   Canvas wrote is not a read.
<!-- /plugin:ui:before-step:2:100:20850016 -->

<!-- plugin:ui:before-step:2:110:bbe0d1c3 -->
### Step 1b (ui): Give every anchored question its answer effects

Do this in Step 2, right after you write `scope-definition-questions.md` and before you
present the questions or wait for answers, so Canvas can preview each answer. Do it again
for each follow-up question you anchor in Step 3. Skip it when no question has an
`[Anchor]:` line.

1. `<ui>` is `<record>/ui`, the only place of the prototype. With the Edit tool, change
   only the JSON inside the single `<script type="application/json" id="aidlc-effects">`
   block of `<ui>/prototype.html`: add entries, keep the existing ones, never add a second
   block, never rebuild the file.
2. For each anchored question add one entry per option letter `A` to `D` it has,
   `{"question":"scope-definition-questions#Q<n>","answer":"B","ops":[...]}`, and one entry
   with `"answer":"*"` for option `X` (usually a `badge` reading "Other" in the UI language).
3. Every option entry has at least one op whose effect is visible on the question's anchor
   or on another anchored element of the same screen. Allowed ops and fields, no others:
   `text` (`target`, optional `selector`, `value`), `hide` and `show` (`target`), `class`
   (`target`, optional `selector`, `add` and/or `remove`), `badge` (`target`, `text`). A
   `target` is an `id` of `<ui>/ui-map.json` `elements[]`; a `selector` stays inside its
   target. Ops set a final state and never toggle. Example: "Is the CO2 card in the first
   version?" anchored on `a-co2-card`: "Yes" is a `show`, "Later" a `badge` "Later", "No"
   a `hide`. A hidden element keeps its markup.
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` and fix every
   `ERROR` (`EFFECTS-COVERAGE`: an option has no effect; `EFFECTS-UNKNOWN-TARGET`,
   `EFFECTS-UNKNOWN-QUESTION`, `EFFECTS-BAD-ENTRY`, `EFFECTS-BAD-OP`: an entry breaks the
   format), at most 3 tries. Then publish a new version with one `--ref` per anchored
   question: `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage scope-definition --ref scope-definition-questions#Q<n>`
   and run the validator once more. Its effects rule must report no `ERROR` before this
   stage asks for its completion approval. If the validator does not exist, continue and
   say so in the memory diary.
<!-- /plugin:ui:before-step:2:110:bbe0d1c3 -->
### Step 2: Generate Clarifying Questions

Create `<record>/ideation/scope-definition/scope-definition-questions.md` with questions:
- What is the minimum viable scope that delivers value?
- What capabilities are must-have vs. nice-to-have?
- What are the dependencies between capabilities?
- What is the sequencing preference (risk-first, value-first, dependency-first)?
- Are there hard deadlines tied to specific capabilities?

Follow stage-protocol.md question flow.


<!-- plugin:ui:before-step:3:90:e53fae2f -->
### Step R (ui): read the answers first

The person answers in Canvas. When they say "done", your FIRST tool calls in that turn are a
Read of every `*-questions.md` file of this stage in the record directory (one Read per file,
all in the same message). Do not write, analyze or summarize anything before those Reads
have returned. A file-change notice, a hint shown to you or your memory of what Canvas wrote
is not a read: the answers must come from the Read result, so that this also works in a new
session and on harnesses without file-change notices. If a Read shows a blank `[Answer]:`
in a question that is not part of a summary confirmation, name that question and wait.
<!-- /plugin:ui:before-step:3:90:e53fae2f -->
### Step 3: Collect and Analyze Answers

Run ambiguity detection, contradiction analysis, and scope-vs-timeline validation.

### Step 4: Generate Artifacts

Create scope definition document (in/out boundary), prioritized intent backlog (proto-Units using MoSCoW/WSJF/RICE), and value stream map.

### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage scope-definition --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 6: Present Completion & Request Approval

Completion emoji: :dart:
Review path: `<record>/ideation/scope-definition/`
Standard approval gate (Approve / Request Changes).

## Sensors

This stage's outputs are markdown artefacts under `<record>/ideation/scope-definition/`.

Imports: `required-sections`, `upstream-coverage`.

Upstream targets: `intent-statement`, `feasibility-assessment`, `constraint-register`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.
