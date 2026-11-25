# addon/bin/validate

Validates an AI-DLC UI-first intent record, or a Canvas sketch directory, against `addon/ANCHORS.md` v1.2 sections 5 and 6 and `addon/schemas/ui-map.schema.json` (`schemaVersion` 1.0, 1.1 and 1.2).

```
addon/bin/validate <record-dir> [--json] [--print-digests] [--check-freeze]
```

Requires Node 22 and `npm ci` in `addon/` (one dependency: `ajv@8.17.1`, pinned in `package-lock.json`).
The script loads the schema from `../schemas/`, so the whole `addon/` directory can be copied elsewhere
(for example to `<project>/.aidlc-ui/`).

| Exit | Meaning |
|---|---|
| 0 | PASS (warnings allowed) |
| 1 | FAIL, one line per finding on stdout: `ERROR <code> <file relative to record>: <message>` / `WARN ...` |
| 2 | usage error or internal error (message on stderr) |

A one-line summary (`PASS (n errors, m warnings)`) goes to stderr.

| Option | Effect |
|---|---|
| `--json` | stdout is `{"ok": bool, "errors": [{code,file,message}], "warnings": [...]}` |
| `--print-digests` | stdout is `{"uiVersion","prototypeSha256","uiMapSha256"}` (SHA-256 of the raw bytes of the two prototype files of the resolved layout, see below); no validation. Exit 1 with findings on stderr if a file is missing or `uiVersion` is unreadable. Cannot be combined with `--check-freeze`. |
| `--check-freeze` | also compares `inception/ui-freeze/ui-freeze-record.md` (always at that path) with the current files of the resolved layout; in the `ui/` layout it also fails with `FREEZE-MOCK-ONLY-MISSING` when `ui/mock-only.md` is missing or empty, and warns `ANSWER-NOT-IN-UI` for answered anchored questions that no `ui/versions/v<N>/meta.json` refs |

## Layouts

The prototype files are resolved once per run, and every finding, `--print-digests` and `--check-freeze` use the same files.
Detection order (first match wins):

1. **record, `ui/`** (v1.2, ANCHORS.md section 6.1): `ui/ui-map.json` or `ui/prototype.html` exists.
2. **record, `ideation/rough-mockups/`** (v1.0/1.1): `ideation/rough-mockups/ui-map.json` or `prototype.html` exists.
3. **sketch dir** (ANCHORS.md section 2c, `<project>/ui-sketch/`): `ui-map.json` or `prototype.html` sits directly in the given directory.
4. Otherwise the directory is treated as a record and reports `MISSING-UI-MAP` / `MISSING-PROTOTYPE` for the `ideation/rough-mockups/` paths.

A record layout wins over stray root-level files, so a leftover `prototype.html` at the root of a record never switches rule 9 to
the lenient sketch mode. If both record locations hold a prototype, `ui/` is validated and `WARN LAYOUT-BOTH` is printed.
Findings name the real relative path (`ui/prototype.html`, `ideation/rough-mockups/ui-map.json`, `prototype.html`).

In a sketch dir, file names in findings are `ui-map.json` and `prototype.html`, and:

- rule 9 findings (all `EFFECTS-*`) are **warnings**, not errors;
- no `*-questions.md` is read: question references, `[Anchor]:` checks, `EFFECTS-UNKNOWN-QUESTION`, `EFFECTS-COVERAGE` and `UNUSED-ANCHOR` are skipped;
- `app.intent` is not required (the schema never requires it);
- rules 1-8 are unchanged and stay errors; `--print-digests` reads the two root files; `--check-freeze` reports `FREEZE-RECORD-MISSING`.

## Files read

- the two prototype files of the resolved layout (`ui/ui-map.json` + `ui/prototype.html`, or the `ideation/rough-mockups/` pair, or the two root files of a sketch dir)
- records only: `ui/versions/v<N>/{prototype.html,ui-map.json,meta.json}` and `ui/quality/v<N>.json` when those directories exist
- every `**/*-questions.md` under the record (directories `versions/`, `node_modules/`, `.git/` are skipped)
- with `--check-freeze`: `inception/ui-freeze/ui-freeze-record.md`, which must contain the lines
  `uiVersion: <N>`, `prototype.html sha256: <64 hex>`, `ui-map.json sha256: <64 hex>` (a leading `- `, backticks or `**` around names and values are tolerated; if a line occurs several times, the last one wins)

## Codes

| Code | Level | Meaning |
|---|---|---|
| `SCHEMA` | error | `ui-map.json` is not valid JSON, has an unsupported `schemaVersion`, or violates the schema (one line per violation) |
| `MISSING-UI-MAP` / `MISSING-PROTOTYPE` | error | file not found |
| `DUP-ELEMENT` | error | `elements[].id` repeated |
| `DUP-SCREEN` / `DUP-MODULE` | error | `screens[].id` / `modules[].id` repeated |
| `ELEMENT-NOT-IN-HTML` | error | element id has no `id="..."` on a markup element of `prototype.html` (ids that only appear inside `<script>`/`<style>`/comments do not count) |
| `UNKNOWN-SCREEN` | error | `elements[].screen` or a `flows[].steps` entry is not in `screens[]` |
| `ANCHOR-NOT-IN-MAP` | error | an `[Anchor]:` target is not in `elements[]` |
| `ANCHOR-MALFORMED` | error | a line starting `[Anchor]:` does not match `a-kebab-case` (max 64 chars) |
| `MULTIPLE-ANCHORS` | error | more than one `[Anchor]:` under one `## Q<n>.` heading |
| `ANCHOR-OUTSIDE-QUESTION` | error | `[Anchor]:` not under a `## Q<n>.` heading (a later `#`/`##` heading ends the question; fenced code blocks are ignored) |
| `QUESTION-REF-UNRESOLVED` | error | a `<stem>#Q<n>` reference in an element or module has no file `<stem>.md` with a `## Q<n>.` heading |
| `MODULE-NOT-LISTED` | error | `elements[].module` is not in `modules[]` |
| `MODULE-UNMOUNTED-HAS-ELEMENT` | error | rule 8: a `source: catalog` module with `mounted` false or absent has an element whose `module` is that id (absent means false, also in `schemaVersion` 1.0 files) |
| `MODULE-UNMOUNTED-PREFIX-ID` | error | rule 8: such a module has an id `a-<module id>` or `a-<module id>-...` in `prototype.html` |
| `MODULE-MOUNTED-NO-ELEMENT` | error | rule 8: a `source: catalog` module with `mounted: true` has no element |
| `MODULE-PREFIX` | error | element id is `a-<catalog-module-id>` or starts with `a-<catalog-module-id>-` but its `module` is not that module |
| `DUP-ID-IN-HTML` | error | an anchor-shaped id (`a-...`) occurs more than once in `prototype.html` |
| `NETWORK-URL` | error | `prototype.html` contains an absolute `http(s)/ws(s)/ftp://` URL anywhere (attributes, text, CSS, JS), a protocol-relative `//host` in `src/href/srcset/...`, CSS `url()`/`@import`, or a JS string, or uses `fetch()`, `XMLHttpRequest`, `WebSocket`, any reference to `EventSource` or `sendBeacon`, `importScripts`, `import()`. The standard `w3.org` namespace identifiers (svg, xlink, xhtml, xmlns, XML, MathML) are allowed. HTML comments are ignored. |
| `UI-VERSION-MISSING` / `UI-VERSION-MISMATCH` | error | `<meta name="aidlc-ui-version">` absent / different from `uiVersion` |
| `FREEZE-RECORD-MISSING` | error | `--check-freeze`: record absent, or it lacks one of the three lines |
| `FREEZE-DIGEST-MISMATCH` | error | `--check-freeze`: a listed SHA-256 differs from the current file |
| `FREEZE-VERSION-MISMATCH` | error | `--check-freeze`: listed `uiVersion` differs from `ui-map.json` |
| `EFFECTS-MISSING` | error (warning in a sketch dir) | rule 9: no `<script type="application/json" id="aidlc-effects">` in the markup (a script string or comment does not count) |
| `EFFECTS-DUPLICATE` | error (sketch: warning) | rule 9: more than one such block (the first is validated) |
| `EFFECTS-BAD-JSON` | error (sketch: warning) | rule 9: block without `type="application/json"`, a JSON parse error, or not `{"effects": [...]}` |
| `EFFECTS-BAD-ENTRY` | error (sketch: warning) | rule 9: entry without a `question` string, `answer` not `A`-`D` or `"*"`, or `ops` not a non-empty array |
| `EFFECTS-UNKNOWN-OP` | error (sketch: warning) | rule 9: `op` other than `text`, `hide`, `show`, `class`, `badge` |
| `EFFECTS-BAD-OP` | error (sketch: warning) | rule 9: missing or invalid fields per op (`text {target, selector?, value}`, `hide`/`show {target}`, `class {target, selector?, add?, remove?}` with at least one of `add`/`remove` (string or array of strings), `badge {target, text}`); unknown fields are rejected |
| `EFFECTS-UNKNOWN-TARGET` | error (sketch: warning) | rule 9: op `target` is not an `elements[].id` (needs a schema-valid `ui-map.json`) |
| `EFFECTS-UNKNOWN-QUESTION` | error (skipped in a sketch dir) | rule 9: entry `question` does not resolve to a `## Q<n>.` heading |
| `EFFECTS-SELECTOR-ESCAPE` | error (sketch: warning) | rule 9: an op `selector` that could leave its target (see below) |
| `EFFECTS-COVERAGE` | error (skipped in a sketch dir) | rule 9: for a question with an `[Anchor]:` line, an option `A`-`D` listed as `- A. ...` has no entry for that question and letter with at least one valid op, or option `X` has no entry with answer `"*"`. One finding per missing (question, letter). A `"*"` entry does not cover `A`-`D`. |
| `EFFECTS-OFF-SCREEN` | warning | rule 9: an op target is on a different screen than the question's anchored element and neither is on screen `shell` |
| `EFFECTS-BADGE-ONLY` | error (skipped in a sketch dir) | rule 9, EV1: an option `A`-`D` of a **UI question** has no op that changes content: only `badge` ops, or only `text` ops whose selector reaches just a block title (`.k-b-title`, `.k-b-titles`, `.k-b-sub`, `.k-b-head`, `.k-card-title`). `text` on real content, `show`, `hide` and `class` count. UI question = `[Kind]: round-<n>`, or an anchored question without `[Kind]:` in `intent-capture-questions.md` of a schemaVersion >= 1.2 record; `quick`, `assumption`, `stock` and unanchored questions are exempt |
| `EFFECTS-IDENTICAL` | error (skipped in a sketch dir) | rule 9, EV1: two options of one UI question have identical ops (compared as canonical JSON, key and op order ignored) |
| `UNUSED-ANCHOR` | warning | anchored element that no `[Anchor]:` line points at (not reported for an element with `"questions": false` in `ui-map.json`) |
| `UNMAPPED-ANCHOR` | warning | anchor-shaped id in `prototype.html` that is not in `elements[]` |

### v1.2 codes (ANCHORS.md section 6, records only; a sketch dir reads no questions, versions or quality files)

| Code | Level | Meaning |
|---|---|---|
| `LAYOUT-BOTH` | warning | `ui/` and `ideation/rough-mockups/` both hold a prototype; `ui/` is validated, the other is ignored |
| `KIND-OUTSIDE-QUESTION` | error | `[Kind]:`, `[Assumed]:` or `[Source]:` is not under a `## Q<n>.` heading (fenced code blocks are ignored) |
| `KIND-DUPLICATE` | error | more than one `[Kind]:`, `[Assumed]:` or `[Source]:` under one question |
| `KIND-UNKNOWN` | error | `[Kind]:` value is not `quick`, `assumption`, `stock` or `round-<n>` (n >= 1) |
| `KIND-QUICK-WRONG-PLACE` | error | `[Kind]: quick` outside Q1-Q3 of a file whose stem is `intent-capture-questions` |
| `KIND-QUICK-HAS-ANCHOR` | error | a `quick` question also has an `[Anchor]:` line |
| `QUICK-MISSING` | warning | schemaVersion >= 1.2 and Q1-Q3 of `intent-capture-questions.md` are not all `[Kind]: quick` (one warning per file, lists the missing ones) |
| `ASSUMED-MISSING` | error | `[Kind]: assumption` without an `[Assumed]:` line |
| `ASSUMED-BAD-LETTER` | error | `[Assumed]:` is not `A`-`D`, or not one of the question's listed option letters |
| `ASSUMED-WITHOUT-KIND` | error | `[Assumed]:` on a question that is not `[Kind]: assumption` |
| `SOURCE-KIND-MISMATCH` | error | `[Kind]: round-<n>` without `[Source]: canvas-round`, or `[Source]: canvas-round` on a question that is not `round-<n>` |
| `SOURCE-UNKNOWN` | error | `[Source]:` value is not `canvas-round` |
| `KIND-MISPLACED` | warning | `[Kind]:`, `[Assumed]:` or `[Source]:` after the first option of its question (they belong directly under the heading, like `[Anchor]:`) |
| `ASSUMPTION-UNRESOLVED` | error | `assumptions[].question` does not resolve to a question that carries `[Kind]: assumption` |
| `ASSUMPTION-LETTER-MISMATCH` | error | `assumptions[].assumed` differs from the question's `[Assumed]:` letter |
| `ASSUMPTION-DUP` | error | `assumptions[].id` repeated |
| `ASSUMPTION-NOT-LISTED` | warning | a `[Kind]: assumption` question has no `assumptions[]` entry |
| `VERSION-FILE-MISSING` | error | `ui/versions/v<N>/` lacks `prototype.html`, `ui-map.json` or `meta.json` (checked when `ui/versions/` exists; entries not named `v<N>` are ignored) |
| `VERSION-META-INVALID` | error | `meta.json` is not valid JSON or breaks ANCHORS.md section 6.1: `version` = N, `parent` = N-1 (`null` for v1), ISO 8601 `createdAt`, `cause.kind` in `agent-stage`/`answer`/`round`/`refine`/`restore`, string `cause.stage`, array of strings `cause.refs` |
| `VERSION-LATEST-MISMATCH` | warning | the highest version's `prototype.html` differs from `ui/prototype.html` |
| `QUALITY-FILE-INVALID` | error | `ui/quality/v<N>.json` is not a JSON object with an integer `version` equal to N, a boolean `pass` and an `issues` array. Pass or fail is not judged here. |

The kind lines are stock-compatible like `[Anchor]:`: the engine reads answers with line-anchored `^\[Answer\]:` patterns and ignores them,
and the validator never changes how `[Answer]:` is read. Order among `[Anchor]:`, `[Kind]:`, `[Assumed]:` and `[Source]:` is free.

### Rule 9 selector rule

An op `selector` is evaluated inside its target. It is rejected (`EFFECTS-SELECTOR-ESCAPE`) when it contains `:root` or `:scope`,
selects the type `html` or `body` (as a whole compound or after a space, combinator, comma or `(`; `.html-view`, `#body-cell` and
`[data-x="html"]` are fine), contains `<`, or has a leading combinator (`>`, `+`, `~`) at the start or after a comma.

Rule 9 needs a schema-valid `ui-map.json` only for the target and off-screen checks; the other checks run regardless.
A block inside `<script type="application/json">` is data: the JS network-API scan skips it (absolute URLs are still flagged).

Cross-file checks (everything except `SCHEMA`, `MISSING-*`, `DUP-ID-IN-HTML`, `NETWORK-URL`, `UI-VERSION-MISSING`,
`ANCHOR-MALFORMED`, `MULTIPLE-ANCHORS`, `ANCHOR-OUTSIDE-QUESTION`, the `EFFECTS-*` structure checks and the freeze file checks) run only when `ui-map.json` is schema-valid.

## Schema versions

`schemaVersion` is mapped to a schema file by major version in `lib/validate-record.js` (`SCHEMA_FILES`). Only major 1 exists
today and its schema accepts `"1.0"`, `"1.1"` and `"1.2"`; older records are checked against the same rules (`mounted` absent = false,
so a 1.0 catalog module with elements fails rule 8; rule 9 applies to every record; `QUICK-MISSING` only to 1.2). When 2.0 ships,
add the new file and keep the old entry to accept the previous major (ANCHORS.md section 7).

## Tests

```
addon/tests/validate/run-in-container.sh [logfile]   # clean container (aidlc-addon-test:f3): npm ci, node --test, sample runs (samples.sh, samples-v12.sh)
```

Inside a container with `addon/` copied and `npm ci` done: `node --test tests/validate/*.test.js`
(Node 22 does not accept a bare directory argument).

## ui-render-check

```
addon/bin/ui-render-check <ui-dir> [--json] [--budget-s N]
```

Opens every screen of `<ui-dir>/prototype.html` (the `data-route` sections) in headless Chromium at 1280 px and fails on what the person would see as a broken first UI:
a block that draws "This <name> block cannot be shown" (or "failed to render"), and any uncaught page error or `console.error` (for example `screen render #4 failed: ...`).
It needs no quality-gate packages: `playwright-core` is taken from `AIDLC_PLAYWRIGHT_CORE`, `.aidlc-ui/quality/node_modules`, `.aidlc-ui/node_modules`, `canvas/node_modules` or `/opt/aidlc-ui-first/canvas/node_modules`;
Chromium from `CHROME_PATH`, Playwright's own path, `PLAYWRIGHT_BROWSERS_PATH`, `/opt/pw-browsers`, `~/.cache/ms-playwright`, then `PATH`. Typical run: 2 to 7 s for 6 to 8 screens (3 screens in parallel, 20 s budget).

| Exit | stdout |
|---|---|
| 0 | `RENDER PASS (n of n screens, s s)`, or `WARN render-skipped: ...` + `RENDER SKIPPED` when there is no `playwright-core` or Chromium (never a failure: the run is not blocked) |
| 1 | one line per finding, then `RENDER FAIL (...)`: `ERROR render-block <route>: the <block> block "<config>" cannot be shown: <message>. <hint> Fix in screens/NN-<id>...` and `ERROR render-error <route>: <message>. <hint>` |
| 2 | usage error |

`ui-version --cause agent-stage` runs the same check before it publishes and refuses (exit 1, the same `ERROR` lines) while a finding is left; `--allow-render-errors` publishes anyway (after the repair rounds), `AIDLC_RENDER_CHECK=0` turns the check off. `quality-gate` keeps its own `block-error` / `console-error` issues; this tool is the one that still works when the gate's packages are not installed.
