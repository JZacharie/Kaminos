# Anchor convention (v1.2)

Shared interface between the add-on (A), the Canvas app (B) and the module catalog (C).
It links three files in an AI-DLC stage record directory:

```
<record>/ui/prototype.html                        element  id="a-kpi-delayed"   (v1.2: was ideation/rough-mockups/)
<record>/**/<stage>-questions.md                 question [Anchor]: a-kpi-delayed
<record>/ui/ui-map.json                           elements[].id = "a-kpi-delayed"
```

`<record>` is the engine-resolved intent record dir
(`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`). The schema of `ui-map.json` is
`addon/schemas/ui-map.schema.json`. Requirement IDs: R-CORE-04, R-CORE-05, R-UI-02, R-UI-07,
R-REFINE-02/03/05, R-MOD-02.

## 1. Anchor id

- Format: `a-` + kebab-case, regex `^a-[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters.
- Unique in `prototype.html` (all screens are in one document) and in `ui-map.json`.
- Stable: an id never changes meaning. If an element is redesigned but keeps its purpose, it keeps
  its id. If it is removed, its id is not reused for something else in the same intent.
- Name by purpose, not by look or position: `a-kpi-delayed`, `a-shipments-table`,
  `a-col-unit`, `a-nav-customer-portal`. Not `a-red-box`, `a-left-panel-2`.
- Module elements are prefixed with the module id: `a-login-form`, `a-chatbot-panel`,
  `a-table-filters`. App elements must not start with a catalog module id followed by `-`.
- **Only a mounted catalog module creates module-prefixed ids (v1.1, D-21).** The Canvas palette
  is the only thing that mounts a catalog module. Stages 1.1-1.6 and the refinement agent never
  draw a catalog module's internals and never create `a-<module>-…` ids. A stage that needs a
  stand-in for something a catalog module will provide draws an app element with its own id
  (`a-signin-form`, `a-shipments-filters`). Questions about a catalog module that is not mounted
  carry no `[Anchor]:`; they appear in the Canvas question list and on the module's palette card.

## 2. In `prototype.html`

- The anchored element carries `id="<anchor id>"`. Nothing else is required on it.
- The `<head>` carries `<meta name="aidlc-ui-version" content="<uiVersion>">`, equal to
  `ui-map.json` `uiVersion`.
- Each screen is reachable through the hash route listed in `ui-map.json` `screens[].route`.
  An anchored element exists in the DOM when its screen's route is active (it may be hidden by a
  scope or answer effect; then it has the `hidden` attribute or `aria-hidden="true"`, never removed).
- Elements shown on every screen (top bar, navigation) use the pseudo-screen id `shell`, which must
  also be listed in `screens[]`.
- An anchored element is a self-contained subtree: refinement edits of one anchor replace that
  subtree only, so everything outside it stays byte-identical (R-REFINE-05). Do not nest one
  anchored element inside another unless the inner one is a column/field of the outer table/form.
- Same file rules as stage 1.6: one file, no network access (no `http:`/`https:` URLs except SVG
  `xmlns`, no `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`), inline CSS/JS/SVG,
  works from `file://`.

### 2b. Answer effects block (v1.1, D-22, R-UI-03)

`prototype.html` carries exactly one block that tells Canvas how each answer changes the UI:

```html
<script type="application/json" id="aidlc-effects">
{"effects":[
  {"question":"rough-mockups-questions#Q3","answer":"B",
   "ops":[{"op":"text","target":"a-kpi-delayed","selector":".kpi-value","value":"7"},
          {"op":"badge","target":"a-kpi-delayed","text":"> 12 h"}]},
  {"question":"scope-definition-questions#Q2","answer":"C",
   "ops":[{"op":"hide","target":"a-co2-card"}]}
]}
</script>
```

- `question` is a question reference (§3). `answer` is an option letter `A`-`D`, or `"*"` for any
  answer (used with `X`, free text). Multi-select answers apply every matching letter in order.
- Ops: `text {target, selector?, value}`, `hide {target}`, `show {target}`,
  `class {target, selector?, add?, remove?}`, `badge {target, text}`. `target` is an anchor id;
  `selector` is a CSS selector evaluated inside the target only. Ops never reach outside anchored
  elements, never add network access, and are idempotent (Canvas re-applies them after every DOM
  change). Canvas applies them; the HTML stays as generated.
- Coverage rule: for every anchored question, every option `A`-`D` has at least one entry with at
  least one op whose effect is visible on that question's anchor or on another anchored element
  of the same screen. `X` is covered by a `"*"` entry (usually a `badge` with the free text
  marker "Otro" / "Other").
- UI questions (EV1). A **UI question** is a question with `[Kind]: round-<n>`, or an anchored
  question without a `[Kind]:` line in `intent-capture-questions.md` of a schemaVersion >= 1.2
  record (how `ui-brief` writes the round-1 questions). It must visibly change the screen, not
  only label it:
  - every option `A`-`D` has at least one op besides `badge`: a `text` on real content (a KPI
    value, a column, a status, a label), or `show`, `hide`, `class`. A `text` op whose selector
    reaches only a block title (`.k-b-title`, `.k-b-titles`, `.k-b-sub`, `.k-b-head`,
    `.k-card-title`) does not count. Otherwise: error `EFFECTS-BADGE-ONLY`;
  - two options of one question never have identical ops (canonical JSON compare). Otherwise:
    error `EFFECTS-IDENTICAL`.
  Exempt: `[Kind]: quick`, `[Kind]: assumption`, `[Kind]: stock` and every question without an
  `[Anchor]:`. `ui-brief --check` applies the same rule to `brief.json` (`BRIEF-EFFECTS-BADGE-ONLY`,
  `BRIEF-EFFECTS-IDENTICAL`); round 1 has no fixed cap on how many UI questions it asks.
- Refinement adds no effects in v1.1. A question created by refinement (`newQuestion`) gets its
  effect when the next run of stage 1.6 or 2.5 regenerates the prototype; until then Canvas shows
  the "answered" chip (pin to check, flash, version, toast).

### 2c. Sketch before the record (v1.1, D-23; v1.2: out of the lab path, D-34)

Before `/aidlc ui-workshop` creates the intent record, Canvas writes a sketch to
`<project>/ui-sketch/prototype.html` and `<project>/ui-sketch/ui-map.json` (`schemaVersion` 1.1,
no `app.intent`, `uiVersion` 1, no `[Anchor]:` questions yet, no `aidlc-effects` required). The
sketch follows every rule of §1-§2 and is not an AI-DLC artifact: it decides nothing. Stage 1.1
reuses its anchor ids for its questions; stage 1.6 starts from it, keeps every id that still
fits, and writes `prototype.html` v(n+1) in its own record dir. From then on the record's file
is the prototype, and Canvas never edits `ui-sketch/` again.

## 3. In `*-questions.md`

AI-DLC v2 question files keep their stock format. The add-on adds at most one line per question,
directly under the question heading, before the context and options:

```markdown
## Q3. [Product owner] What counts as a delayed shipment?
[Anchor]: a-kpi-delayed

Why we ask: the "Delayed" KPI and the row badges are computed from this rule.

- A. More than 2 hours after the planned ETA
- B. More than 12 hours after the planned ETA
- C. More than 24 hours after the planned ETA
- D. The retailer's SLA, per customer
- X. Other (please specify)

[Answer]:
```

- `[Anchor]:` is optional. A question without it is shown in the Canvas question list, not as a pin.
- At most one `[Anchor]:` per question. The pin goes on that element.
- The anchor must exist in `ui-map.json` `elements[]` and in `prototype.html`.
- Answers stay stock: `[Answer]: B`, `[Answer]: A, C` (multi-select) or `[Answer]: X — <text>`.
  The Canvas writes only the value after `[Answer]:` and never edits other lines.
- The engine reads answers with line-anchored `^\[Answer\]:` patterns, so the extra line is ignored
  by stock AI-DLC v2.11.2 (proof: `tests/evidence/2026-11-03/plan/addon-feasibility/logs/18-anchor-compat.log`).

### Question reference

Other files refer to a question as `<questions file stem>#Q<n>`, for example
`rough-mockups-questions#Q3`. `<n>` is the number in the `## Q<n>.` heading. Question numbers are
never reused inside one file; a removed question leaves a gap.

## 4. In `ui-map.json`

One `elements[]` entry per anchor id, with `screen`, `label`, `questionIds` (question references),
`frIds` (`FR-nn` / `NFR-nn` produced by those questions, empty until requirements exist) and
`module` (module id or `null`). An element that is not meant to have a question (an alert feed, a map legend) may set
`"questions": false`; `addon/bin/validate` then skips its `UNUSED-ANCHOR` warning (default: absent = warn as before). Modules on the scope board are in `modules[]` with
`scope: mvp | later | out`. Elements whose module is `out` are dimmed by the Canvas (R-UI-05).

A `modules[]` entry with `source: catalog` has `mounted` (v1.1, D-21). `mounted: false` (or absent)
means "listed on the scope board, not placed yet": no element carries that module, and the
Canvas palette shows the module as "recommended, drag it in", not as "added". Dragging it in
mounts its UI, adds its elements and sets `mounted: true`. Removing it (undo) sets it back to
`false`. Scope `out` dims a mounted module and greys out an unmounted one on the palette.

From stage 2.5 (refined-mockups) on, an element may also list `uxIds`: the story-keyed experience
decision ids `UX{x}.{y}.{n}` of upstream PR
[awslabs/aidlc-workflows#2889](https://github.com/awslabs/aidlc-workflows/pull/2889). This gives the
trace chain `a-<id>` (element) → `<file>#Q<n>` (question) → `FR-nn` → `UX{x}.{y}.{n}` → endpoint → test.
Anchor ids are not replaced by UX ids: an anchor names an element from 1.6 on, a UX id names a
decision about it from 2.5 on.

## 5. Validation (`addon/bin/validate <record-dir>`)

Exit 0 = PASS, 1 = FAIL with one line per finding. Checks:

1. `ui-map.json` is valid against `addon/schemas/ui-map.schema.json`.
2. Every `elements[].id` is unique, matches an `id` in `prototype.html`, and its `screen` is in `screens[]`.
3. Every `[Anchor]:` in any `*-questions.md` under the record exists in `elements[]`.
4. Every question reference in `ui-map.json` resolves to an existing `## Q<n>.` heading.
5. Every `elements[].module` and `modules[].id` pair is consistent (an element's module is listed).
6. `prototype.html` has no network URL or network API (§2), and its `aidlc-ui-version` equals `uiVersion`.
7. Warning (not failure): an anchored element in `prototype.html` that no question uses.
8. (v1.1) A catalog module with `mounted: false` has no element and no `a-<module>-` id in
   `prototype.html`; one with `mounted: true` has at least one element.
9. (v1.1) `#aidlc-effects` exists, parses, uses only the ops of §2b on existing anchors, and covers
   every option of every anchored question (§2b coverage rule). Missing coverage is a failure in
   the record's `ideation/rough-mockups/` and later; a warning in `ui-sketch/`.
   (EV1) A UI question's options also change the screen and differ from each other (§2b, UI questions).

## 6. v1.2 additions (F3, D-27..D-33)

### 6.1 One living UI directory
The prototype lives in `<record>/ui/` (add-on owned, never a declared AI-DLC deliverable, so Canvas
may rewrite it at any time without tripping review fingerprints or freezes; proof
`tests/evidence/2026-11-04/plan-f3/P1-engine/FINDINGS.md` §3):

```
<record>/ui/prototype.html  ui-map.json  ui-changes.md
<record>/ui/versions/v<N>/{prototype.html, ui-map.json, meta.json}
<record>/ui/quality/v<N>.json          (quality gate result, D-33)
<project>/aidlc/.ui-first/pending-quick.json   (chip answers given before the record exists, D-29)
```
Stage 1.1 creates it (deliverable `ui-prototype-v1.md` in its own stage dir is only an index);
stage 1.6 consolidates it (deliverable `ui-prototype-index.md`); `ui-freeze` digests
`<record>/ui/prototype.html` and `ui-map.json`. Validation (§5) reads `<record>/ui/`; for v1.0/1.1
records it falls back to `ideation/rough-mockups/`.

`meta.json` of a version: `{"version": N, "parent": N-1, "createdAt": ISO, "cause": {"kind":
"agent-stage" | "answer" | "round" | "refine" | "restore", "stage": "<slug>", "refs": ["<file>#Q<n>"]}}`.
Versions are never rewritten; "switch back to v3" creates v(N+1) with `cause.kind: restore`.

### 6.2 Question kind lines (stock-compatible, like `[Anchor]:`)
Directly under the `## Q<n>.` heading, after `[Anchor]:` if any, at most one of each:
- `[Kind]: quick` — one of the three chips (who uses it / device / main job). No anchor. Always Q1-Q3
  of `intent-capture-questions.md`.
- `[Kind]: assumption` plus `[Assumed]: <A-D>` — a decision v1 already made. Canvas shows it in the
  assumptions list ("Assumed: desktop · change"); it is listed in `ui-map.json` `assumptions[]`.
  Accepting it writes `[Answer]: <assumed letter>`; correcting it writes another answer.
- `[Kind]: stock` — a question of the stock AI-DLC engine (problem, customer, success, trigger, ...)
  that Step 2 of intent-capture adds after version 1. It MAY carry an `[Anchor]:`; it needs no
  `[Assumed]:` and no `[Source]:`. The stock engine ignores the line; Canvas shows stock questions
  between the quick questions and the UI rounds. The file is never reordered or renumbered.
- `[Kind]: round-<n>` plus `[Source]: canvas-round` — a question proposed by the bridge for round n
  and appended by Canvas (D-31). Agent-written questions carry no `[Source]:` line.
`[Answer]:` stays blank until the person answers (stock rule); Canvas writes it (D-14).

## 7. Versioning

This document and the schema carry version `1.2` (`schemaVersion`). 1.2 adds §6 (living `ui/` dir, versions, kind lines, `assumptions[]`); 1.1 is additive over 1.0
(`modules[].mounted`, §2b effects, §2c sketch, network APIs in rule 6). A breaking change bumps the
major version; the validator accepts the current and the previous major version, and 1.0 files.

Related shared contracts: `addon/schemas/refine-result.schema.json` (the refinement agent's
output, D-19), `addon/schemas/round-result.schema.json` (one bridge call per round, D-31) and `ui-changes.md` (`docs/EXECUTION-PLAN.md` §4.2; first line `# UI changes`, D-20).
