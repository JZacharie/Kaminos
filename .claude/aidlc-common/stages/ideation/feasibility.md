---
slug: feasibility
name: Feasibility & Constraints
phase: ideation
execution: CONDITIONAL
condition: Execute when there are integration constraints, regulatory requirements, or significant technical uncertainty. Skip for trivial changes with no technical risk.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-aws-platform-agent
  - aidlc-compliance-agent
mode: inline
summary_confirmation: required
produces:
  - feasibility-assessment
  - constraint-register
  - raid-log
  - feasibility-questions
consumes:
  - artifact: intent-statement
    required: true
  - artifact: competitive-analysis
    required: false
  - artifact: market-trends
    required: false
  - artifact: build-vs-buy
    required: false
requires_stage:
  - intent-capture
  - market-research
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - enterprise
  - feature
  - mvp
  - ui-first
  - ui-workshop
inputs: Intent statement from intent-capture stage, market research from market-research stage (if executed)
outputs: feasibility-assessment.md, constraint-register.md, raid-log.md, feasibility-questions.md (under this stage's record dir, engine-resolved)
---

# Feasibility & Constraint Analysis

## Steps

### Step 1: Load Prior Context

- Read intent statement from `<record>/ideation/intent-capture/`
- Read market research from `<record>/ideation/market-research/` (if exists)
- Load guardrails from
  `aidlc/spaces/<active-space>/memory/{org,team,project}.md`


<!-- plugin:ui:before-step:2:100:351ebf42 -->
### Step 1a (ui): Anchor the questions about the interface

Version 1 of the interface is in `<record>/ui/` (`prototype.html` and `ui-map.json`).
When you write the questions file in Step 2, link a question to the element it affects
when the answer changes what a person will see or operate, for example the integration
question that decides an "order source" badge, or the notification question that decides
an alerts panel.

1. Most feasibility questions (compliance, budget, team skills, AWS accounts) have no
   visible element: give them no anchor. Never force one.
2. Read `<record>/ui/ui-map.json` and use only an `id` from its `elements[]`. Never invent
   an id in this stage. A question about something version 1 does not show gets no anchor.
3. Add one line `[Anchor]: a-<id>` directly under the question's `Q<n>.` heading, before
   the "Why we ask" text and the options. At most one per question. Agent-written
   questions here carry no `[Kind]:` line. Reuse an anchor of an earlier questions file
   when the question is about the same element.
4. A question about a catalog module (login, table, chatbot) gets no anchor; the Canvas
   app shows it on the module's palette card.
5. Write nothing else for anchors in the questions file: no extra section, no table.
   Follow-up questions created in Step 3 follow the same rules.
6. The answer mode was chosen in stage 1.1 and the engine reuses it: do not ask the mode
   again. After the person says "done", read `feasibility-questions.md` with the
   Read tool before you use any answer. A file-change hint or your memory of what
   Canvas wrote is not a read.
<!-- /plugin:ui:before-step:2:100:351ebf42 -->

<!-- plugin:ui:before-step:2:110:5d205f2b -->
### Step 1b (ui): Give every anchored question its answer effects

Do this in Step 2, right after you write `feasibility-questions.md` and before you present
the questions or wait for answers, so Canvas can preview each answer. Do it again for each
follow-up question you anchor in Step 3. Skip it when no question has an `[Anchor]:` line.

1. `<ui>` is `<record>/ui`, the only place of the prototype. With the Edit tool, change only the JSON inside the single
   `<script type="application/json" id="aidlc-effects">` block of `<ui>/prototype.html`:
   add entries, keep the existing ones, never add a second block, never rebuild the file.
2. For each anchored question add one entry per option letter `A` to `D` it has,
   `{"question":"feasibility-questions#Q<n>","answer":"B","ops":[...]}`, and one entry with
   `"answer":"*"` for option `X` (usually a `badge` reading "Other" in the UI language).
3. Every option entry has at least one op whose effect is visible on the question's anchor
   or on another anchored element of the same screen. Allowed ops and fields, no others:
   `text` (`target`, optional `selector`, `value`), `hide` and `show` (`target`), `class`
   (`target`, optional `selector`, `add` and/or `remove`), `badge` (`target`, `text`). A
   `target` is an `id` of `<ui>/ui-map.json` `elements[]`; a `selector` stays inside its
   target. Ops set a final state and never toggle. Example: an integration question
   anchored on `a-shipments-table` gets a `badge` per option: "Source: ERP", "Source:
   carrier API", "Source: CSV upload".
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` and fix every
   `ERROR` (`EFFECTS-COVERAGE`: an option has no effect; `EFFECTS-UNKNOWN-TARGET`,
   `EFFECTS-UNKNOWN-QUESTION`, `EFFECTS-BAD-ENTRY`, `EFFECTS-BAD-OP`: an entry breaks the
   format), at most 3 tries. Then publish a new version with one `--ref` per anchored
   question: `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage feasibility --ref feasibility-questions#Q<n>`
   and run the validator once more. Its effects rule must report no `ERROR` before this
   stage asks for its completion approval. If the validator does not exist, continue and
   say so in the memory diary.
<!-- /plugin:ui:before-step:2:110:5d205f2b -->
### Step 2: Generate Clarifying Questions

Create `<record>/ideation/feasibility/feasibility-questions.md` with questions:
- What existing systems must this integrate with?
- Are there regulatory/compliance requirements (PCI, HIPAA, SOC2, data residency)?
- What is the team's current tech stack and skill profile?
- What are the budget and timeline constraints?
- Are there organizational blockers (change freeze, competing priorities)?
- What AWS services and accounts are currently in use?

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

Run ambiguity detection and contradiction analysis.

### Step 4: Generate Artifacts

Create feasibility assessment (technical viability, risk analysis), constraint register (technical, organizational, regulatory), and RAID log (Risks, Assumptions, Issues, Dependencies).

The orchestrator will pass these artifacts to aidlc-aws-platform-agent for AWS landscape assessment and aidlc-compliance-agent for regulatory scanning, then synthesize all inputs.

### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage feasibility --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 6: Present Completion & Request Approval

Completion emoji: :test_tube:
Review path: `<record>/ideation/feasibility/`
Standard approval gate (Approve / Request Changes).

## Sensors

This stage's outputs are markdown artefacts under `<record>/ideation/feasibility/`.

Imports: `required-sections`, `upstream-coverage`.

Upstream targets: `intent-statement`, `competitive-analysis`, `market-trends`, `build-vs-buy`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.
