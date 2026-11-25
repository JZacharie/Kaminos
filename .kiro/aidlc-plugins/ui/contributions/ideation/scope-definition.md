---
target: scope-definition
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: before-step:3
    order: 90
  - anchor: before-step:2
    order: 100
  - anchor: before-step:2
    order: 110
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

## fragment: before-step:2

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

## fragment: before-step:2

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
