---
slug: rough-mockups
phase: ideation
execution: CONDITIONAL
condition: Execute when user-facing UI is part of the initiative; for API/backend, produce system interaction diagrams. Skip for non-UI, API-only, or infrastructure-only initiatives.
lead_agent: aidlc-design-agent
support_agents:
  - aidlc-product-agent
mode: inline
summary_confirmation: required
reviewer: aidlc-product-lead-agent
review_artifact: wireframes
reviewer_max_iterations: 2
review_class: advisory
produces:
  - wireframes
  - user-flow
  - rough-mockups-questions
  - ui-prototype-index
consumes:
  - artifact: intent-statement
    required: true
  - artifact: scope-document
    required: true
  - artifact: intent-backlog
    required: true
requires_stage:
  - scope-definition
  - team-formation
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - enterprise
  - feature
  - mvp
  - ui-first
  - ui-workshop
inputs: Intent statement, scope definition, intent backlog
outputs: wireframes.md, user-flow.md, rough-mockups-questions.md (under this stage's record dir, engine-resolved)
---

# Rough Mockups & Concept Visualization

## Steps

### Step 1: Load Prior Context

- Read intent statement from `<record>/ideation/intent-capture/`
- Read scope definition and intent backlog from `<record>/ideation/scope-definition/`


<!-- plugin:ui:after-step:1:100:41c96fba -->
### Step 1a (ui): Collect the planned anchors, the decisions and the module scope

`<ui>` is `<record>/ui`, the living interface directory.

1. Read every `*-questions.md` under `<record>/ideation/` (intent-capture, feasibility,
   scope-definition) with the Read tool and list each `[Anchor]: a-<id>` line with its
   question reference `<file stem>#Q<n>` (for example `intent-capture-questions#Q4`), its
   `[Kind]:` (`quick`, `assumption`, `round-<n>` or none) and the answer given. This is
   the list of planned anchors. Every one of them already has an element in `<ui>`
   or gets one in Step 3b.
2. Treat the answers as design decisions. An answered assumption question with another
   letter than its `[Assumed]:` is a correction of version 1. An element whose answer
   puts the capability out of the first version stays in the markup with the `hidden`
   attribute (Step 3b).
3. From the scope document and the intent backlog, list which capabilities are in the
   first version (`mvp`), later (`later`) or out (`out`). Step 3c turns them into the
   `modules` list. Catalog modules are `login`, `table` and `chatbot`: they are listed
   there but never drawn (Steps 3b and 3c). Mark every other capability
   `source: generated`.
4. When no planned anchors exist, continue: Step 2a still anchors this stage's questions.
<!-- /plugin:ui:after-step:1:100:41c96fba -->
### Step 2: Generate Clarifying Questions

Create `<record>/ideation/rough-mockups/rough-mockups-questions.md` with questions:
- What are the primary user entry points and key screens/views?
- What is the core user flow (happy path)?
- What does the information hierarchy look like?
- Are there existing brand guidelines, design systems, or UI patterns to follow?
- What device/form factors must be supported?
- Are there known accessibility requirements (WCAG level, screen reader support, keyboard-only navigation)?
- For non-UI initiatives: what are the key system interactions and data flows?

Follow stage-protocol.md question flow.


<!-- plugin:ui:after-step:2:100:bd3e7851 -->
### Step 2a (ui): Anchor this stage's questions

The interface of stage 1.1 (or a later version) is in `<record>/ui/`. Questions that are
about an element it already has use that element's id; Step 3b creates the elements for
the others.

1. Prefer questions whose answer changes one visible element ("Which indicator fills
   the fourth dashboard slot?") over questions about the overall layout. Ask them
   per element, not as one question about a whole screen.
2. Add one line `[Anchor]: a-<id>` directly under the question's `Q<n>.` heading in
   `rough-mockups-questions.md`, before the "Why we ask" text and the options. At most
   one per question; several questions may share one anchor. A question that is about
   the whole app (devices, accessibility level) gets none.
3. Reuse an id of `<record>/ui/ui-map.json` `elements[]` when the question is about that
   element. A new element gets a new id named by purpose, not by look or position
   (`a-kpi-slot4`, `a-col-bbd`, `a-nav-customer-portal`): `a-` plus kebab-case, at most
   64 characters, unique in the prototype.
4. A question about a catalog module (login, table, chatbot) gets no anchor. Never
   create an id that starts with `a-login-`, `a-table-` or `a-chatbot-`; a stand-in
   element takes an app id (`a-signin-form`, `a-shipments-filters`).
5. Every anchor used here, and every planned anchor from Step 1a, must exist as an
   element in `<record>/ui/prototype.html` and as an entry in `ui-map.json` (Steps 3b
   and 3c).
6. Write nothing else for anchors in the questions file: no extra section, no table.
   Follow-up questions created in Step 3 follow the same rules.
7. When the person answers in Canvas or by editing the file, they say "done" in the
   chat. After that, read every `*-questions.md` of this stage with the Read tool
   before you use any answer. A file-change hint, a notification or your memory of
   what Canvas wrote is not a read.
<!-- /plugin:ui:after-step:2:100:bd3e7851 -->
### Step 3: Collect and Analyze Answers

Run contradiction analysis between UX expectations and scope constraints.


<!-- plugin:ui:before-step:4:100:3c89b928 -->
### Step 3b (ui): Update the interface from the answers

`<ui>` is `<record>/ui`. The interface exists already: version 1 from stage 1.1 and
perhaps newer versions from Canvas. This step updates it in place. It never builds
the interface again from zero and never writes `prototype.html` or `ui-map.json` into
the rough-mockups dir. A record made by an older add-on keeps both files in
`<record>/ideation/rough-mockups/`; edit them there and skip `ui-version` in Step 3e.

1. Read the latest version: `<ui>/prototype.html`, `<ui>/ui-map.json` and `<ui>/ui-changes.md`
   (if present; Canvas appends to it), and the answers of Step 1a and of this stage's
   questions file, read with the Read tool.
2. Bring the markup in line with each answered decision. The `ops` of the chosen option
   in the `aidlc-effects` block say what changes (a number, a label, hidden or shown,
   a badge); write that state as static markup. Capabilities that an answer or the
   scope puts out of the first version stay in the markup with `hidden` and
   `aria-hidden="true"`. Add an element for every anchor of this stage's questions
   that has none, in the screen it belongs to, and add a screen (a `<section>` with
   `data-route` and one `<h1>`, like the existing ones) only when the answers need it.
3. Edit with the Edit tool and a small `old_string`. Every anchored subtree that does
   not need to change stays byte-identical: bytes, whitespace, attribute order. Never
   delete or rename an `id="a-..."`, never remove the wrapper of an anchored subtree,
   never touch the `aidlc-ui-version` meta (`ui-version` sets it).
4. Anchor rules (`.aidlc-ui/ANCHORS.md`): `id="a-<id>"` named by purpose, static markup
   (never only in a script string), unique in the file. An anchored element is a
   self-contained subtree, not nested in another anchored element except a column in its
   table or a field in its form. Never draw a catalog module's internals (login, table or
   chatbot component) and never create an id that starts with `a-login-`, `a-table-` or
   `a-chatbot-`; draw a plain stand-in with an app id (`a-signin-form`, `a-shipments-filters`).
5. Keep the file offline (no `http:`/`https:` URL except the SVG `xmlns`, no CDN, no
   external font or image, no `fetch`) and keep the data realistic: new rows come from the
   dataset the file already has (`window.APP_DATA`); do not paste a second copy into markup.
<!-- /plugin:ui:before-step:4:100:3c89b928 -->

<!-- plugin:ui:before-step:4:110:24b36d73 -->
### Step 3c (ui): UI map

Update `<ui>/ui-map.json` in place so that it describes exactly what `prototype.html`
contains. It must be valid against `.aidlc-ui/schemas/ui-map.schema.json` (schema
version 1.2). Do not change `uiVersion`; `ui-version` raises it in Step 3e.

1. `schemaVersion` stays `"1.2"` (a record of an older add-on keeps its own). `app`:
   `name`, `intent` (the intent folder name, for example `261103-spudtrack`) and
   `language`.
2. `screens[]`: one entry `{id, title, route}` per `data-route` section of the
   prototype, with the same hash route, plus the pseudo-screen `shell`.
3. `elements[]`: one entry per `id="a-..."` of `prototype.html`, none missing, none
   extra: `{id, screen, label, kind, questionIds, frIds, module}`.
   - `screen`: the screen that contains it, or `shell`. `label`: short human name in
     the language of the UI. `kind`: one of region, nav, kpi, chart, table, column,
     form, field, button, list, map, card, badge, text, other.
   - `questionIds`: every question that has this anchor, as `<file stem>#Q<n>`, from
     all questions files of the intent. `frIds`: keep, `[]` when new (stage 2.3 fills it).
   - `module`: `null`. This stage mounts no catalog module.
4. `modules[]`: the capabilities from Step 1a as `{id, name, scope, source, questionIds}`
   with `scope` mvp, later or out. List all three catalog modules `login`, `table` and
   `chatbot` with `source: "catalog"`, `mounted: false`, `scope` from the scope decision
   (`out` when it says nothing) and `catalogVersion` (the `version` of
   `.aidlc-ui/modules/<id>/module.json` when that file exists, else `"1.0.0"`). A module
   may be listed with no element. Every other capability uses `source: "generated"` with
   a kebab-case id. A catalog module that is already `mounted: true` keeps its elements.
5. `flows[]`: one entry `{id, steps}` per flow of `user-flow.md`, steps being screen ids
   (at least two). `assumptions[]` stays as it is.
6. Do not write `ui-changes.md`; the Canvas app appends it.
<!-- /plugin:ui:before-step:4:110:24b36d73 -->

<!-- plugin:ui:before-step:4:115:90577c3e -->
### Step 3d (ui): Answer effects

`<ui>/prototype.html` has exactly one block that tells the Canvas app how each answer
changes the UI. Extend it; never write a second one and never build or insert it by script.

```html
<script type="application/json" id="aidlc-effects">
{"effects":[
  {"question":"rough-mockups-questions#Q3","answer":"B",
   "ops":[{"op":"text","target":"a-kpi-delayed","selector":".k-kpi-value","value":"7"},
          {"op":"badge","target":"a-kpi-delayed","text":"> 12 h"}]},
  {"question":"rough-mockups-questions#Q3","answer":"*",
   "ops":[{"op":"badge","target":"a-kpi-delayed","text":"Other"}]}
]}
</script>
```

1. `question` is `<file stem>#Q<n>`, written exactly as in `ui-map.json`. `answer` is
   an option letter `A` to `D`, or `"*"` for any answer.
2. Allowed ops, and no others, with no other fields: `text` (`target`, optional
   `selector`, `value`), `hide` and `show` (`target`), `class` (`target`, optional
   `selector`, `add` and/or `remove`, each a string or a list of strings; at least
   one), `badge` (`target`, `text`).
3. `target` is an anchor id that exists in `ui-map.json`. `selector` is evaluated
   inside the target only. Never use `:root`, `:scope`, `html`, `body`, `<` or a
   leading `>`, `+` or `~`.
4. Every op is idempotent: it sets a final state (text value, class added or removed,
   hidden or shown, one badge) and never toggles or appends.
5. Keep the entries that exist. Add entries for every question that carries an
   `[Anchor]:` line and has none yet, in all earlier questions files (intent-capture,
   feasibility, scope-definition) and in this stage's own `rough-mockups-questions.md`.
6. Coverage: each option `A` to `D` of such a question has an entry with at least one
   op whose effect is visible on its anchored element or on another anchored element
   of the same screen. Option `X` (free text) is covered by one entry with answer
   `"*"`, usually a `badge` reading "Other" in the language of the UI.
7. Capabilities that an answer puts out of the first version are hidden with `hide`;
   their markup stays.
<!-- /plugin:ui:before-step:4:115:90577c3e -->

<!-- plugin:ui:before-step:4:120:b1da4af4 -->
### Step 3e (ui): Validate and publish the new version

1. If `.aidlc-ui/bin/validate` exists, run `.aidlc-ui/bin/validate "<record>"` with the
   engine-resolved intent record dir (the folder that contains `ideation/`). Fix every
   `ERROR` line in `prototype.html`, `ui-map.json` or the questions files and run it
   again, at most 3 tries. A `WARN UNUSED-ANCHOR` is acceptable; a `WARN UNMAPPED-ANCHOR`
   means an anchor is missing in `ui-map.json`: add it. If errors remain after 3 tries,
   stop, list them for the person and record them under Open questions in the diary.
   - `MODULE-UNMOUNTED-HAS-ELEMENT`, `MODULE-UNMOUNTED-PREFIX-ID`, `MODULE-PREFIX`:
     an element or id belongs to a catalog module. Rename it to an app id with
     `module: null`, or remove it.
   - `MODULE-MOUNTED-NO-ELEMENT`: set `mounted: false` (this stage mounts nothing).
   - `EFFECTS-MISSING`, `EFFECTS-DUPLICATE`: exactly one `aidlc-effects` block is needed.
   - `EFFECTS-BAD-JSON`, `EFFECTS-BAD-ENTRY`, `EFFECTS-UNKNOWN-OP`, `EFFECTS-BAD-OP`:
     the block or one entry breaks the format of Step 3d.
   - `EFFECTS-UNKNOWN-TARGET`, `EFFECTS-UNKNOWN-QUESTION`: the op target is not in
     `ui-map.json` `elements[]`, or the question reference has no `## Q<n>.` heading.
   - `EFFECTS-SELECTOR-ESCAPE`: a `selector` could leave its target; narrow it.
   - `EFFECTS-COVERAGE`: the line names a question and an option letter without an
     effect; add the entry. A `WARN EFFECTS-OFF-SCREEN` is acceptable.
2. If `.aidlc-ui/bin/validate` does not exist, continue and say in the memory diary
   (Deviations) that the prototype was not validated.
3. Publish the new version, even when little changed:
   `.aidlc-ui/bin/ui-version "<record>/ui" --cause agent-stage --stage rough-mockups`.
   It raises `uiVersion` and the `aidlc-ui-version` meta by one, writes
   `versions/v<N>/` and prints `v<N>`. Run `.aidlc-ui/bin/validate "<record>"` once more;
   it must report no `ERROR`.
<!-- /plugin:ui:before-step:4:120:b1da4af4 -->
### Step 4: Generate Artifacts

For UI initiatives: Create low-fidelity wireframes (ASCII art or structured descriptions), core user flow diagram, information architecture outline. Include a one-line accessibility note per screen: heading level (h1–h3), primary landmark regions (header/main/nav/footer), keyboard entry point.

For non-UI initiatives: Create system context diagram, key interaction flow sketches.

All diagrams follow ASCII diagram standards from stage-protocol.md.


<!-- plugin:ui:after-step:4:100:006304bb -->
### Step 4a (ui): Wireframes, flow and index from the prototype

Write `wireframes.md` and `user-flow.md` from what `<record>/ui/prototype.html` and
`ui-map.json` show (Step 4 above): the same screens, routes, elements and flows, not
a second design from the questions alone. If you wrote them before Step 3b ran, correct
them now so they match.

1. Write `<record>/ideation/rough-mockups/ui-prototype-index.md`, the deliverable this
   contribution declares. It lists: the files of `<record>/ui/` (`prototype.html`,
   `ui-map.json`, `ui-changes.md` if present, the latest `versions/v<N>/`) with one
   line each, plus `wireframes.md` and `user-flow.md`; a table of the screens (id,
   title, route); the flows with their steps; the `uiVersion`; the number of anchored
   elements and of questions that carry an `[Anchor]:`; and the assumptions and open
   questions.
2. Tell the person how to look at the result: open `<record>/ui/prototype.html` in a
   browser, or use the Canvas app if it is running.
<!-- /plugin:ui:after-step:4:100:006304bb -->
### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage rough-mockups --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 6: Present Completion & Request Approval

Completion emoji: :pencil2:
Review path: `<record>/ideation/rough-mockups/`
Standard approval gate (Approve / Request Changes).

## Sensors

This stage's outputs are markdown artefacts under `<record>/ideation/rough-mockups/`.

Imports: `required-sections`, `upstream-coverage`.

Upstream targets: `intent-statement`, `scope-document`, `intent-backlog`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.
