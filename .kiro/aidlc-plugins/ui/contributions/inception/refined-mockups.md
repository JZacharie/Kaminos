---
target: refined-mockups
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: before-step:3
    order: 90
  - anchor: after-step:4
    order: 100
  - anchor: before-step:2
    order: 100
---

## fragment: before-step:3

### Step R (ui): read the answers first

The person answers in Canvas. When they say "done", your FIRST tool calls in that turn are a
Read of every `*-questions.md` file of this stage in the record directory (one Read per file,
all in the same message). Do not write, analyze or summarize anything before those Reads
have returned. A file-change notice, a hint shown to you or your memory of what Canvas wrote
is not a read: the answers must come from the Read result, so that this also works in a new
session and on harnesses without file-change notices. If a Read shows a blank `[Answer]:`
in a question that is not part of a summary confirmation, name that question and wait.

## fragment: after-step:4

### Step 4a (ui): Refine the clickable prototype

In scope ui-first and ui-workshop the prototype is one living file pair in
`<record>/ui/`: `prototype.html` and `ui-map.json`. The mockups of this stage refine
those files; they do not replace them.

1. Start from the current files. Do not regenerate from scratch: the Canvas app may
   have changed them since the last stage; read `<record>/ui/ui-changes.md` for the log.
2. Edit `prototype.html` in place to the fidelity of this stage's mockups. Keep every
   existing `id="a-..."`: never rename, remove or reuse one. Parts you do not change
   stay byte-identical. Elements with `hidden` stay hidden. The offline rules of
   stage 1.6 still apply (single file, no network URL, hash routes).
3. A new element gets a new anchor id (purpose-based `a-` kebab-case, unique, at most
   64 characters) and an `elements[]` entry in `ui-map.json`. Add the question to the
   element's `questionIds` only when the question already carries that element's
   `[Anchor]:` line. Never add an `[Anchor]:` line to a question that is answered.
4. If this stage defines UX ids (`UX{x}.{y}.{n}`, with its own `mockups-preview.html`,
   upstream PR awslabs/aidlc-workflows#2889), add each id to `elements[].uxIds` of the
   element it decides about. The anchor id stays; a UX id never replaces it. If this
   stage defines no UX ids, leave `uxIds` absent.
5. Effects: the single `aidlc-effects` block (Step 1b) must cover every question that
   has an `[Anchor]:` line at this moment, including questions that Canvas rounds or
   the person added. Add missing entries, repair invalid ones, and never remove the
   effects of questions already answered.
6. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` with the
   engine-resolved intent record dir and fix every `ERROR` (at most 3 tries; the
   `EFFECTS-*` codes mean the block is missing, malformed, points at an unknown target or
   question, or lacks coverage). Then publish one new version for this stage run:
   `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage refined-mockups`
   and run the validator once more. If the validator does not exist, continue and say so
   in the memory diary. Never write `ui-changes.md`.
7. An answer with a visible effect (a loading, empty or error state, an undo, a role view)
   must be drawn in `prototype.html` in this step, on an element that has an anchor. Do
   not only write it in the stage documents. Give a question about such a state the
   `[Anchor]:` line of the element that shows it (Step 1b). In `mockups.md` add a section
   `## Answers drawn in the prototype` with one line per answer: `Q<n> <answer> ->
   <anchor id or screen id>`. If an answer cannot be drawn now, list it under
   `## Not drawn` with the reason. Do not ask for approval while a visible answer is
   in neither list: the completion message says which answers are drawn and which are not.

## fragment: before-step:2

### Step 1b (ui): Anchor the questions and give them answer effects

The prototype is in `<ui>` = `<record>/ui`, the only place of the prototype. Do this in
Step 2, right after you write `refined-mockups-questions.md` and before you present the
questions or wait for answers, so Canvas can preview each answer. Do it again for each
follow-up question you anchor in Step 3.

1. Add one line `[Anchor]: a-<id>` directly under the `Q<n>.` heading of every question
   about one element the prototype already has (a state, an interaction pattern, a
   column), using only an `id` of `<ui>/ui-map.json` `elements[]`; never invent one in
   Step 2. At most one per question; no `[Kind]:` line. Questions about the whole app
   (design system, accessibility level, breakpoints) and about catalog modules (login,
   table, chatbot) get none.
2. With the Edit tool, change only the JSON inside the single
   `<script type="application/json" id="aidlc-effects">` block of `<ui>/prototype.html`:
   keep the existing entries, never add a second block. For each anchored question add
   one entry per option letter `A` to `D`
   (`{"question":"refined-mockups-questions#Q<n>","answer":"B","ops":[...]}`) and one with
   `"answer":"*"` for option `X` (a `badge` reading "Other").
3. Every option entry has an op visible on the question's anchor or on another anchored
   element of the same screen. Ops, no others: `text` (`target`, optional `selector`,
   `value`), `hide`, `show`, `class` (`add` and/or `remove`), `badge` (`target`, `text`);
   a `selector` stays inside its target; ops set a final state and never toggle.
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"`, fix every
   `ERROR` (`EFFECTS-COVERAGE` and the other `EFFECTS-*` codes), at most 3 tries, then
   `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage refined-mockups --ref refined-mockups-questions#Q<n>`
   (one `--ref` per anchored question) and the validator once more.
5. The answer mode was chosen in stage 1.1 and the engine reuses it: do not ask the mode
   again. After the person says "done", read `refined-mockups-questions.md` with the
   Read tool before you use any answer. A file-change hint or your memory of what
   Canvas wrote is not a read.
