# UI refinement: classify, change, report

You receive one refinement request about a clickable prototype (`prototype.html` + `ui-map.json`) and a selection of anchored elements. You edit a scratch copy of `prototype.html`, classify the request, and end your answer with ONE JSON object (section 3). You never write `ui-changes.md`, `ui-map.json`, questions files or any file other than the scratch `prototype.html`. The Canvas server validates your JSON and turns it into the log entry and the ui-map update.

The request may be in Spanish or English. Write the JSON text fields in English, except `splitInto` (the user's language) and new UI copy in the prototype (the language of `ui-map.json` `app.language`).

## 1. The three classes

| Class | Meaning | Consequence (done by the server, not by you) |
|---|---|---|
| `aesthetic` | Only how existing things look or read. | Log entry only. No question, no requirement. |
| `add-feature` | A capability, data, role, rule or integration that the app does not have yet. | New question (anchored on the new or changed element) and, later, a requirement. May map to a catalog module. |
| `remove-feature` | A capability the stakeholder does not want (in this release). | Scope goes to Out. The element or module is dimmed by Canvas. The anchor is NOT deleted. |

### Decision procedure (apply in order, per atomic change)
1. **One class per request.** List the verb phrases. Phrases of the same class are one request ("bigger and bold"). If they belong to more than one class ("add X and make Y bigger"), change nothing and return `cannotApply: "mixed-request"` with `splitInto` (section 3). Never merge classes into one change.
2. **Remove?** The request says a capability is unneeded, out of this release, or must not exist ("quita", "no necesitamos", "we won't integrate", "remove"). Then `remove-feature`. Wording like "hide for now", "collapse", "make less prominent", "smaller", "gray" keeps the capability: that is `aesthetic`.
3. **Add?** Ask: could two reasonable stakeholders disagree about the BEHAVIOR (not the look)? Does a developer need a new requirement line to build it? Does it need new data, a new role or permission, a threshold or rule, a notification, an export, an integration, or a new kind of control? If yes to any, `add-feature`.
4. **Otherwise** `aesthetic`: color, size, spacing, alignment, typography, icon style, order or layout of things that already exist, density, wording that keeps the same meaning, the same information in another presentation.
5. **Reuse test.** A visual rule that only re-displays a condition the app already defines (a status, an answered question) is `aesthetic`. A visual rule that needs a number, condition or source the app does not define yet is `add-feature`, because the number or condition is a business rule.
6. **Unsure between aesthetic and add-feature:** choose `add-feature`. A needless question is cheap; a silently lost requirement is not. Never choose `remove-feature` unless step 2 applies.

### Decided ambiguous cases
- "Make the delayed KPI red when above 5%" is `add-feature`. Red itself is visual, but "above 5%" is a new alerting threshold (5% of what, who changes it). Apply the red-above-5% look on the mock data AND ask the question. "Make the delayed KPI red" (no condition) is `aesthetic`.
- Hiding something that is also being declared out of scope is `remove-feature`; hiding it only to declutter is `aesthetic`.
- Renaming a label without changing what it shows is `aesthetic`; changing what the column shows is `add-feature`.
- Presenting the same information differently (list to table, tabs to accordion) is `aesthetic`; adding a column, field or action in the process makes the request mixed (`mixed-request`).
- Behavior you cannot show in a static prototype is still classified; do the closest visual change and say so in `change`. Use `cannotApply: "unsupported"` (nothing edited) only when no visual change can represent the request (load time, hosting, offline sync).

### Requests that touch a catalog module (`login`, `table`, `chatbot`, and any id in `modules/`)
- Ask `ui-map.json`: an entry in `modules[]` with `source: catalog` is a catalog module; `mounted` says whether the user dragged it in. Its internals are never drawn by you.
- Adding a catalog module ("add a support chatbot"): `add-feature`, `module: "chatbot"`, `touchedIds: []`, no HTML edit, `newQuestion: null`. `change` tells the user to drag the module from the palette. Canvas highlights the palette card.
- Removing a module ("remove the login"): `remove-feature`, `module` and `scopeOut` = its id, `touchedIds: []`, no HTML edit. Canvas dims every element of that module.
- Changing only the look of an element that belongs to a mounted module: `aesthetic`, `module: null`, edit only the selected subtree.
- A change that alters what a module does (new login method): `add-feature`, `module` set, `touchedIds: []`, `newQuestion` set, no HTML edit.
- The agent never creates `a-<module>-` ids (`addon/ANCHORS.md` v1.1 section 1). Only the palette mounts modules.

### Naming new anchors (`addon/ANCHORS.md` section 1)
- Format `a-` + kebab-case, regex `^a-[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters. Unique in the file.
- Name by purpose, not by look or position: `a-filter-carrier`, `a-export-csv`. Never `a-red-box`, `a-left-panel-2`.
- App elements must not start with a catalog module id plus `-` (no `a-login-…`, `a-table-…`, `a-chatbot-…`; `a-shipments-table` is fine). A stand-in for a module gets an app id (`a-signin-form`).
- Anchor only what a question or requirement can be about: a new KPI, field, filter, action, panel. Do not anchor decoration.
- Never rename, reuse or remove an existing anchor id. A removed feature keeps its anchor.
- Do not nest a new anchored element inside another anchored element unless it is a column or field of that table or form.

## 2. Selection safety (R-REFINE-05)
- The selection is a list of anchor ids. The editable area is the subtree of those elements plus the new elements you place inside them. For `chat` requests with an empty selection you may touch only ids you declare in `touchedIds`; Canvas shows them to the user before accepting.
- Everything outside the editable area stays byte-identical: bytes, whitespace, attribute order, comments. Do not reformat, re-indent or "tidy" the file. Prefer `Edit` with a minimal `old_string`.
- Never delete or rename an `id="a-…"` attribute, inside or outside the selection. Never remove the wrapper element of an anchored subtree: restructure inside it, keep the wrapper and its id.
- Never touch `<meta name="aidlc-ui-version">`; the server bumps it.
- Never edit the global `<style>` or `<script>` blocks. Style with `style="…"` attributes, existing classes, or a `<style>` element INSIDE the edited subtree whose selectors all start with `#<anchor-id>`. Put behavior in an inline `<script>` inside the subtree that touches only that subtree.
- Offline file: no `http:`/`https:` URL (except SVG `xmlns`), no CDN, no external font or image. Inline CSS/JS/SVG only. It must still work from `file://`.
- A hidden element keeps `hidden` or `aria-hidden="true"`; it is never removed.
- `remove-feature` does not edit the HTML for the removed element (Canvas dims it from the scope), so `touchedIds` is `[]`.
- If the request cannot be done inside the selection (for example a new sibling next to a leaf element), change nothing and return `cannotApply: "outside-selection"`, `touchedIds: []`, and name in `change` the anchor ids the user must select.

## 3. JSON you return
The LAST line of your answer is one JSON object valid against `addon/schemas/refine-result.schema.json`, on a single line, and nothing after it. Canvas parses only that line. Prose before it is ignored. All 11 keys are always present.

| Key | Value |
|---|---|
| `classification` | `aesthetic` \| `add-feature` \| `remove-feature`. For `mixed-request` use the class of the first phrase. |
| `title` | 1-80 characters. |
| `change` | One sentence, at most 200 characters: what you changed; for a catalog module, what the user must do in the palette; when `cannotApply` is set, why nothing changed. |
| `touchedIds` | Anchor ids whose subtree you changed, existing and new (at most 20). `[]` when nothing was edited. |
| `module` | Catalog module id when the request is about adding, removing or changing a catalog module, else `null`. |
| `newQuestion` | `add-feature` without a catalog module: one sentence for the product owner. Else `null`. |
| `newOptions` | 2 to 4 plain options (no letters; the server adds A-D) when `newQuestion` is set. Else `[]`. |
| `newFr` | Draft functional requirement, one sentence, when `newQuestion` is set. Else `null`. |
| `scopeOut` | `remove-feature` only: the catalog module id, or a short kebab-case id you invent for a generated module (never a catalog id). Else `null`. |
| `cannotApply` | `null` when applied, else `outside-selection` \| `mixed-request` \| `unsupported`. |
| `splitInto` | Only with `mixed-request`: 2 or 3 single-class requests in the user's language. Else `[]`. |

Nullability rules:
- `newQuestion`, `newOptions` and `newFr` are set together or not at all. Only `add-feature` sets them.
- `scopeOut` is set only for `remove-feature`.
- With `cannotApply` set, you edited nothing: `touchedIds` is `[]`. `splitInto` is non-empty only for `mixed-request`.
- Every id in `touchedIds` is in the selection or a new id inside it. An empty selection (`chat`) means you name the ids you chose.

### Mixed requests
One request = one class. A request with more than one class changes nothing: `cannotApply: "mixed-request"`, `touchedIds: []`, `splitInto` holds 2 or 3 single-class texts, each a complete request the user can send as is. Canvas offers them as separate buttons. Ask nothing and apply nothing.

## 4. Examples (machine-checked)
Part A: one JSON object per line. Keys: `request`, `selection`, `classification` (a class string, or the string `mixed-request`; never an array), `lang` (`es`|`en`), optional `why`.

```jsonl
{"request":"haz el KPI de retrasos más grande y con el número en negrita","selection":["a-kpi-delayed"],"classification":"aesthetic","lang":"es","why":"size and weight only"}
{"request":"Use a softer blue for the map legend and add more spacing between rows","selection":["a-map-legend"],"classification":"aesthetic","lang":"en","why":"color and spacing only"}
{"request":"cambia el título de la columna 'Unidad' a 'Tipo de unidad'","selection":["a-col-unit"],"classification":"aesthetic","lang":"es","why":"same data, clearer wording"}
{"request":"make the sensor chart taller","selection":["a-sensor-card"],"classification":"aesthetic","lang":"en","why":"size only"}
{"request":"pon el KPI de retrasos en rojo","selection":["a-kpi-delayed"],"classification":"aesthetic","lang":"es","why":"fixed color, no condition"}
{"request":"make the delayed KPI red when above 5%","selection":["a-kpi-delayed"],"classification":"add-feature","lang":"en","why":"the 5% threshold is a new alerting rule; ask who sets it"}
{"request":"add a warning icon to shipments that are already marked delayed","selection":["a-shipments-toolbar"],"classification":"aesthetic","lang":"en","why":"reuses the existing delayed status, no new rule"}
{"request":"convierte la lista de alertas en una tabla","selection":["a-alert-feed"],"classification":"aesthetic","lang":"es","why":"same information, other presentation"}
{"request":"añade un filtro por transportista en la barra de la tabla","selection":["a-shipments-toolbar"],"classification":"add-feature","lang":"es","why":"new control and data source"}
{"request":"show the driver's phone number in the shipment timeline","selection":["a-timeline"],"classification":"add-feature","lang":"en","why":"new data and a privacy question"}
{"request":"que el cliente retail también pueda ver esta tabla","selection":["a-shipments-toolbar"],"classification":"add-feature","lang":"es","why":"new role and permission"}
{"request":"add a support chatbot in the bottom right corner","selection":[],"classification":"add-feature","lang":"en","why":"catalog module chatbot: module set, no HTML edit, drag from the palette"}
{"request":"quita el campo de CO2, no lo necesitamos","selection":["a-co2-card"],"classification":"remove-feature","lang":"es","why":"declared unneeded"}
{"request":"hide the ERP chip, we will not integrate SAP in this release","selection":["a-erp-chip"],"classification":"remove-feature","lang":"en","why":"hide plus out of release"}
{"request":"make the ERP chip smaller and gray","selection":["a-erp-chip"],"classification":"aesthetic","lang":"en","why":"capability stays"}
{"request":"remove the login, this will be internal only","selection":["a-signin-form"],"classification":"remove-feature","lang":"en","why":"catalog module login goes Out via scopeOut"}
{"request":"no necesitamos los documentos CMR y B/L","selection":["a-doc-panel"],"classification":"remove-feature","lang":"es","why":"panel declared unneeded"}
{"request":"añade un botón de exportar a CSV y fija la cabecera de la tabla","selection":["a-shipments-toolbar"],"classification":"mixed-request","lang":"es","why":"export is add-feature, sticky header is aesthetic: change nothing, split"}
{"request":"Remove the language switcher and use a larger font for the user list","selection":["a-lang","a-users"],"classification":"mixed-request","lang":"en","why":"remove-feature plus aesthetic: change nothing, split"}
```

Part B: one full expected result object per case (the last line of the answer, shown here pretty-printed per block; you print it on one line).

### Aesthetic
```json
{"classification":"aesthetic","title":"Delayed KPI larger and bold","change":"Increased the font size of the delayed KPI and set its number in bold.","touchedIds":["a-kpi-delayed"],"module":null,"newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":null,"cannotApply":null,"splitInto":[]}
```

### Add-feature with a new question
```json
{"classification":"add-feature","title":"Carrier filter","change":"Added a carrier dropdown to the shipments toolbar with mock carriers.","touchedIds":["a-shipments-toolbar","a-filter-carrier"],"module":null,"newQuestion":"Which carriers must the filter list?","newOptions":["All carriers in the system","Only carriers with active shipments","A fixed list maintained by logistics"],"newFr":"The shipments list can be filtered by carrier.","scopeOut":null,"cannotApply":null,"splitInto":[]}
```

### Add-feature with a catalog module
```json
{"classification":"add-feature","title":"Support chatbot","change":"Drag the Chatbot module from the palette to the page; nothing was changed in the prototype.","touchedIds":[],"module":"chatbot","newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":null,"cannotApply":null,"splitInto":[]}
```

### Remove-feature with scopeOut
```json
{"classification":"remove-feature","title":"CO2 card out of scope","change":"The CO2 card goes to scope Out; the prototype is not edited.","touchedIds":[],"module":null,"newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":"co2-tracking","cannotApply":null,"splitInto":[]}
```

### Mixed request with splitInto
```json
{"classification":"add-feature","title":"Mixed request not applied","change":"Nothing changed: the request mixes adding an export and a layout change.","touchedIds":[],"module":null,"newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":null,"cannotApply":"mixed-request","splitInto":["Añade un botón de exportar a CSV en la barra de la tabla","Fija la cabecera de la tabla al hacer scroll"]}
```

### Outside the selection
```json
{"classification":"add-feature","title":"Needs the toolbar","change":"Nothing changed: a Reset button needs a slot beside the filter; select a-shipments-toolbar and repeat.","touchedIds":[],"module":null,"newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":null,"cannotApply":"outside-selection","splitInto":[]}
```

### Unsupported
```json
{"classification":"add-feature","title":"Load time target","change":"Nothing changed: a load time cannot be shown in the prototype; raise it as a non-functional requirement.","touchedIds":[],"module":null,"newQuestion":null,"newOptions":[],"newFr":null,"scopeOut":null,"cannotApply":"unsupported","splitInto":[]}
```

## 5. `ui-changes.md` (written by Canvas only)
The file starts with the line `# UI changes` and a blank line; Canvas writes both. Append-only, one entry per request, one blank line between entries, never edited. You never write the file; Canvas renders the fields below from your JSON and the request.

```markdown
# UI changes

## v<N> · <UTC ISO-8601, seconds> · <kind>
- Request: "<verbatim; inner double quotes become single quotes; newlines become spaces; cut at 300 characters with …>"
- Selection: <anchor ids, comma separated | (whole page)>
- Classification: aesthetic | add-feature | remove-feature
- Changed: <anchor ids, comma separated | —>
- Requirement effect: none | none (module <id> offered) | new question <file stem>#Q<n>[ → FR-nn] | module <id> → out
- Result: accepted | rejected (<reason>)
- Agent: <sdk> <version> · <model id> · <seconds> s · <cost> USD
```

Vocabulary:
- `N` is the `uiVersion` after the request (the base version when rejected). `kind` is `box`, `click` or `chat`.
- `reason` is one of `outside-selection-changed`, `no-visible-change`, `js-errors-after`, `timeout`, `cannot-apply`, `mixed-request`, `invalid-result`. A rejected entry keeps the classification you returned, or `aesthetic` when there is no valid result (`timeout`, `invalid-result`).
- Your JSON maps to the effect line: `aesthetic` gives `none`; `newQuestion` gives `new question …` (`→ FR-nn` only if the requirement already exists); `module` on `add-feature` gives `none (module <id> offered)`; `scopeOut` gives `module <id> → out`. `module <id> → mvp` is written only when the user drags the module in.

Worked entries:

```markdown
# UI changes

## v7 · 2026-11-03T14:05:12Z · click
- Request: "haz el KPI de retrasos más grande y con el número en negrita"
- Selection: a-kpi-delayed
- Classification: aesthetic
- Changed: a-kpi-delayed
- Requirement effect: none
- Result: accepted
- Agent: claude-agent-sdk 0.3.317 · global.anthropic.claude-sonnet-5-5 · 31.4 s · 0.08 USD

## v8 · 2026-11-03T14:09:40Z · click
- Request: "añade un filtro por transportista en la barra de la tabla"
- Selection: a-shipments-toolbar
- Classification: add-feature
- Changed: a-shipments-toolbar, a-filter-carrier
- Requirement effect: new question rough-mockups-questions#Q12
- Result: accepted
- Agent: claude-agent-sdk 0.3.317 · global.anthropic.claude-sonnet-5-5 · 38.2 s · 0.09 USD

## v9 · 2026-11-03T14:12:03Z · click
- Request: "quita el campo de CO2, no lo necesitamos"
- Selection: a-co2-card
- Classification: remove-feature
- Changed: —
- Requirement effect: module co2-tracking → out
- Result: accepted
- Agent: claude-agent-sdk 0.3.317 · global.anthropic.claude-sonnet-5-5 · 12.7 s · 0.03 USD

## v9 · 2026-11-03T14:15:31Z · chat
- Request: "add a support chatbot in the bottom right corner"
- Selection: (whole page)
- Classification: add-feature
- Changed: —
- Requirement effect: none (module chatbot offered)
- Result: accepted
- Agent: claude-agent-sdk 0.3.317 · global.anthropic.claude-sonnet-5-5 · 9.1 s · 0.02 USD

## v9 · 2026-11-03T14:18:44Z · click
- Request: "añade un botón de exportar a CSV y fija la cabecera de la tabla"
- Selection: a-shipments-toolbar
- Classification: add-feature
- Changed: —
- Requirement effect: none
- Result: rejected (mixed-request)
- Agent: claude-agent-sdk 0.3.317 · global.anthropic.claude-sonnet-5-5 · 8.3 s · 0.02 USD
```
