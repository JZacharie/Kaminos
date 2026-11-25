---
target: requirements-analysis
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: before-step:7
    order: 90
  - anchor: after-step:10
    order: 100
  - anchor: before-step:6
    order: 100
  - anchor: before-step:6
    order: 110
  - anchor: before-step:6
    order: 120
---

## fragment: before-step:7

### Step R (ui): read the answers first

The person answers in Canvas. When they say "done", your FIRST tool calls in that turn are a
Read of every `*-questions.md` file of this stage in the record directory (one Read per file,
all in the same message). Do not write, analyze or summarize anything before those Reads
have returned. A file-change notice, a hint shown to you or your memory of what Canvas wrote
is not a read: the answers must come from the Read result, so that this also works in a new
session and on harnesses without file-change notices. If a Read shows a blank `[Answer]:`
in a question that is not part of a summary confirmation, name that question and wait.

## fragment: after-step:10

### Step 10a (ui): Link the requirements to the prototype elements

After `requirements.md` has its requirement IDs, update `<record>/ui/ui-map.json`:

1. For every element whose question (`[Anchor]:` line) produced a requirement, set the
   element's `frIds`. The map uses the form `FR-<nn>` / `NFR-<nn>`: write `FR1` as
   `FR-01`, `FR12` as `FR-12`, `NFR3` as `NFR-03`, and a sub-requirement `FR1.2` as
   its parent `FR-01`. A requirement may appear on several elements.
2. Add to the element's `questionIds` each `requirements-analysis-questions#Q<n>` that
   carries its anchor.
3. Edit `ui-map.json` only; do not change `prototype.html` in this step. A mismatch you
   notice (a requirement with no element, an element with no answer) goes under Open
   questions in the diary; stage ui-freeze lists it as an open difference.
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` with the
   engine-resolved intent record dir and fix every `ERROR` (at most 3 tries). Then publish
   the change as a new version:
   `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage requirements-analysis`
   (it raises `uiVersion` and the `aidlc-ui-version` meta together and writes
   `versions/v<N>/`) and run the validator once more. If the validator does not exist,
   continue and say so in the memory diary.

## fragment: before-step:6

### Step 5a (ui): Anchor the questions about prototype elements

The prototype (`<record>/ui/prototype.html`) exists and its elements are listed in
`<record>/ui/ui-map.json` `elements[]`.

1. When you write `requirements-analysis-questions.md` in Step 6, add one line
   `[Anchor]: a-<id>` directly under the `Q<n>.` heading of every question that is about
   one element of the prototype (an alert rule, a column, a filter, a form field), before
   the "Why we ask" text and the options. At most one per question. Agent-written
   questions here carry no `[Kind]:` line. Questions about scale, security or hosting get
   none.
2. Use only ids that already exist in `ui-map.json` `elements[]`. Never invent an id
   here; if the question is about an element that is missing, ask it without an anchor
   and note the gap under Open questions in the diary.
3. Write nothing else for anchors in the file. The `Consolidated Summary
   Confirmation` entry (it is not anchored) and all `[Answer]:` tags stay as the stage
   defines them. Follow-up questions from Step 8 follow the same rules.
4. The answer mode was chosen in stage 1.1 and the engine reuses it: do not ask the mode
   again. After the person says "done", read `requirements-analysis-questions.md` with
   the Read tool before you use any answer. A file-change hint or your memory of what
   Canvas wrote is not a read.

## fragment: before-step:6

### Step 5b (ui): Give every anchored question its answer effects

Do this in Step 6, right after you write `requirements-analysis-questions.md` and before
you present the questions or wait for answers, so Canvas can preview each answer. Do it
again for each follow-up question you anchor in Step 8. Skip it when no question has an
`[Anchor]:` line.

1. `<ui>` is `<record>/ui`, the only place of the prototype. With the Edit tool, change
   only the JSON inside the single `<script type="application/json" id="aidlc-effects">`
   block of `<ui>/prototype.html`: add entries, keep the existing ones, never add a second
   block, never rebuild the file.
2. For each anchored question add one entry per option letter `A` to `D` it has,
   `{"question":"requirements-analysis-questions#Q<n>","answer":"B","ops":[...]}`, and one
   entry with `"answer":"*"` for option `X` (usually a `badge` reading "Other" in the UI
   language).
3. Every option entry has at least one op whose effect is visible on the question's anchor
   or on another anchored element of the same screen. Allowed ops and fields, no others:
   `text` (`target`, optional `selector`, `value`), `hide` and `show` (`target`), `class`
   (`target`, optional `selector`, `add` and/or `remove`), `badge` (`target`, `text`). A
   `target` is an `id` of `<ui>/ui-map.json` `elements[]`; a `selector` stays inside its
   target. Ops set a final state and never toggle. Example: "What counts as a delayed
   shipment?" anchored on `a-kpi-delayed`: each option is a `text` op with a different
   value in the card's number plus a `badge` with the rule ("> 2 h", "> 12 h", "> 24 h").
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` and fix every
   `ERROR` (`EFFECTS-COVERAGE`: an option has no effect; `EFFECTS-UNKNOWN-TARGET`,
   `EFFECTS-UNKNOWN-QUESTION`, `EFFECTS-BAD-ENTRY`, `EFFECTS-BAD-OP`: an entry breaks the
   format), at most 3 tries. Then publish a new version with one `--ref` per anchored
   question: `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage requirements-analysis --ref requirements-analysis-questions#Q<n>`
   and run the validator once more. Its effects rule must report no `ERROR` before this
   stage asks for its completion approval. If the validator does not exist, continue and
   say so in the memory diary.

## fragment: before-step:6

### Step 5c (ui): Ask explicitly whether the app needs real sign-in

When you write `requirements-analysis-questions.md` in Step 6, include this question unless
an earlier answer of this record already settles it. Give it no `[Anchor]:` line.

```
Does this need real sign-in?
A. None, demo only (anyone who reaches the app can use it)
B. Shared secret (one password or key for the whole team)
C. Cognito or company SSO (each person signs in)
X. Other (please specify)
[Answer]:
```

If the person has said who may use the app ("internal staff only", "only the ops team"),
keep that answer next to this one. Option A does not satisfy such a restriction, so say that
in the question text and let the person choose again.
