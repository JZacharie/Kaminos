---
target: user-stories
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: before-step:5
    order: 90
  - anchor: before-step:10
    order: 100
  - anchor: before-step:4
    order: 100
---

## fragment: before-step:5

### Step R (ui): read the answers first

The person answers in Canvas. When they say "done", your FIRST tool calls in that turn are a
Read of every `*-questions.md` file of this stage in the record directory (one Read per file,
all in the same message). Do not write, analyze or summarize anything before those Reads
have returned. A file-change notice, a hint shown to you or your memory of what Canvas wrote
is not a read: the answers must come from the Read result, so that this also works in a new
session and on harnesses without file-change notices. If a Read shows a blank `[Answer]:`
in a question that is not part of a summary confirmation, name that question and wait.

## fragment: before-step:10

### Step 9a (ui): Counts come from the file, not from memory

Every number in the completion message and in the summary (stories, personas, requirements
covered) is read from `<record>/inception/user-stories/traceability.json` (`upstream_ids`
and the `coverage` rows) or counted in `stories.md` with a command, in this step. Never
type a count from memory or from an earlier stage. Name the unit exactly: a story
(`US<x>.<y>`) is not a requirement (`FR<n>`) or a sub-requirement (`FR<n>.<m>`).

## fragment: before-step:4

### Step 3a (ui): Anchor the questions about visible elements and give them effects

The prototype is in `<ui>` = `<record>/ui`, the only place of the prototype. Do this in
Step 4, right after you write `user-stories-questions.md` and before you present the
questions or wait for answers, so Canvas can preview each answer. Do it again for each
follow-up question you anchor in Step 6. Skip it when no question is about something the
prototype shows.

1. Add one line `[Anchor]: a-<id>` directly under the `Q<n>.` heading of a question whose
   answer changes what one role sees or can do on a visible element (a column, a filter,
   an action button), before the "Why we ask" text and the options. Use only an `id` of
   `<ui>/ui-map.json` `elements[]`; never invent one. At most one per question; no
   `[Kind]:` line. Questions about story format, breakdown and MoSCoW priority, and about
   catalog modules (login, table, chatbot), get none.
2. For each anchored question, change only the JSON inside the single
   `<script type="application/json" id="aidlc-effects">` block of `<ui>/prototype.html`
   with the Edit tool: keep the existing entries, never add a second block. Add one entry
   per option letter `A` to `D`
   (`{"question":"user-stories-questions#Q<n>","answer":"B","ops":[...]}`) and one with
   `"answer":"*"` for option `X` (a `badge` reading "Other").
3. Every option entry has an op visible on the question's anchor or on another anchored
   element of the same screen. Ops, no others: `text` (`target`, optional `selector`,
   `value`), `hide`, `show`, `class` (`add` and/or `remove`), `badge` (`target`, `text`);
   a `selector` stays inside its target; ops set a final state and never toggle.
4. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"`, fix every
   `ERROR` (`EFFECTS-COVERAGE` and the other `EFFECTS-*` codes), at most 3 tries, then
   `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage user-stories --ref user-stories-questions#Q<n>`
   (one `--ref` per anchored question) and the validator once more.
5. The answer mode was chosen in stage 1.1 and the engine reuses it: do not ask the mode
   again. After the person says "done", read `user-stories-questions.md` with the
   Read tool before you use any answer. A file-change hint or your memory of what
   Canvas wrote is not a read.
