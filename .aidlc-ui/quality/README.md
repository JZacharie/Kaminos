# Quality gate (`addon/bin/quality-gate`)

Automatic check of a living UI directory (`<record>/ui/`: `prototype.html` + `ui-map.json`) before the person sees it.
Decisions: D-33 (bar and gate), D-36 (blocks only at desktop widths), the product owner's quality-first change 2026-11-04.
Installed as `<project>/.aidlc-ui/bin/quality-gate`; the dependencies live in `<project>/.aidlc-ui/quality/`.

```
quality-gate <ui-dir> [--version N] [--only <check,...>] [--no-lighthouse] [--critic | --critic-mock <file>]
             [--critic-always] [--critic-model <id>] [--critic-save-shots <dir>] [--reference-dir <dir>] [--no-reference] [--idea "<text>"]
             [--budget-s N] [--no-progress] [--json]
```
Exit `0` = PASS, `1` = FAIL (blocking issues), `2` = usage / environment error (message on stderr).

## Install
`(cd quality && npm ci --omit=dev --ignore-scripts)` (network needed once; afterwards the gate runs with `--network none`).
Chromium: `CHROME_PATH`, else Playwright's build (`PLAYWRIGHT_BROWSERS_PATH`, as in the `aidlc-addon-test:f3` image), else exit 2 with a message.
Pinned in `package.json` / `package-lock.json`: `axe-core` 4.10.3, `lighthouse` 13.6.0, `playwright-core` 1.64.1,
`@aws-sdk/client-bedrock-runtime` 3.1161.0 (Node >= 22.19 because of Lighthouse).

## What it checks (every route of `ui-map.json` `screens[].route`, besides `shell`)
Without `ui-map.json` (a builder checking its own work before `ui-brief` has written it) the routes come from `<ui>/src/brief.json`.
Widths **1280 and 1440 px block** (`issues[]`). Widths **768 and 375 px only warn** (`warnings[]`, `WARN` lines, never exit 1).

| Check | Blocking (1280, 1440; dark theme at 1280) | Warning only |
|---|---|---|
| `console` | 0 console errors and 0 uncaught page errors | errors that appear only at 768/375 |
| `overflow` | document wider than the viewport (3 widest elements named). B1 layout checks at 1280, 1324, 1440 and 1920 px, each with selector and fix: `broken-word` (a word split across lines, any text), `narrow-row` (>= 4 columns in < 480 px or < 96 px per column), `header-wrap` (top bar or nav on more than one line, or the Menu button shown, from 1024 px), `child-overflow` (text ending outside its card), `text-wrap` (controls) | document overflow and `text-wrap` at 768/375; `nav-scroll` (the nav scrolls sideways) |
| `axe` | 0 critical/serious axe-core violations, light theme on every route, dark theme on the first route and the densest route | moderate/minor at desktop; critical/serious at 768/375 |
| `lighthouse` | accessibility >= 90 on every route (desktop preset) | - |
| `network` | no URL / `fetch` / `XMLHttpRequest` / ... in the source, no external or extra-file request at run time | - |
| `data` | every visible `<table>` >= 12 body rows; every visible `[data-kit="list"]` / `.k-list` >= 3 items; no placeholder text (`lorem ipsum`, `Item <n>`, `Test <n>`, `foo`, `bar`, `TODO`, `placeholder`, `sample text`, `John/Jane Doe`, `xxx`) | - |
| `critic` | only with `--critic`: vision review, mean >= 3.8 and no criterion below 3. Blocks only in rounds 1 and 2 (`critic.round` = calls on the same `quality/v<N>.json`); from round 3 its findings are `warnings[]` (`critic-nonblocking`, `critic-hint-<criterion>`). From round 2 the critic gets its previous scores and notes (A28) | cost above 0.30 USD, critic unavailable |

Placeholder matching is per visible text node and case-insensitive except `Item <n>`, `Test <n>` and `TODO`; `bar` only matches a text that is exactly "bar"
(a plain word match would flag "bar chart" and "top bar").

## Output
`<ui-dir>/quality/v<N>.json` (N = `--version`, else `uiVersion`):
```
{ "version": N, "pass": bool, "checks": { "<check>": {"pass": bool|null, "rerun": bool, ...} },
  "issues":   [{"id","check","severity","route","width","message"}],      // blocking; pass == (issues.length == 0)
  "warnings": [{"id","check","severity":"warn","route","width","message"}],
  "critic": null | {"scores":{...6},"mean","pass","costUsd","model","reasons","fixes","usage"} | {"error": "..."},
  "durationMs", "timings", "routes", "widths", "tools", "partial", "generatedAt" }
```
`route`/`width` are `null` for whole-prototype findings. Issue ids: `overflow`, `axe-<rule-id>`, `console-error`, `lighthouse-a11y`, `network`,
`broken-word`, `narrow-row`, `header-wrap`, `child-overflow`, `text-wrap`, `data-rows`, `placeholder-text`, `critic-<criterion>`. Warning-only ids add `nav-scroll`, `critic-parity`, `critic-reference-missing`, `axe-skipped`, `critic-unavailable`, `critic-skipped`, `critic-cost`.
B1-T5b: `seed-*` ids (check `data`) compare the page with `<ui>/src/seed.json` (see `kit/SEED-RULES.md`); `report.handover[]` and `HANDOVER` lines list findings that survived two repair rounds (`lib/quality/handover.mjs`, state in `quality/state-v<N>.json`). Env `AIDLC_GATE_MAX_ROUNDS`: default 2; N = N rounds (the critic may block `max(2, ceil(N/2)+1)` calls); `0`/`unlimited` = no count limit, the critic blocks on every call, and a PLATEAU (two rounds in a row without fewer findings) hands over everything left (`reason: "plateau"`).
The same finding on several widths or routes is one issue ("Same at 1440px. Same on #/alerts."). Messages name the selector, the width and the kit-level fix.

stdout: one `ISSUE <id> <severity> <route> <width> <message>` per blocking issue, `WARN <id> <route> <width> <message>` per warning, `CRITIC ...`, `TIMING ...`,
and last `QUALITY PASS` or `QUALITY FAIL (n issues)`. `--json` prints only the JSON.

## Repair loop support
- `--only overflow,axe` re-runs just those checks and rewrites `quality/v<N>.json`: results of the other checks are kept (`checks.<c>.rerun: false`,
  carried issues have `rerun: false`). `--only critic` runs the critic alone.
- Progress events (`addon/lib/progress.js`, `<ui-dir>/progress.jsonl`): `gate` start and pass/fail per check (with the screen id of the first failing
  route), `gate` skip for Lighthouse, `critic` start / done / fail / skip, `gate` info "Tablet/phone widths: n warnings". `--no-progress` turns them off.
- The critic runs only when the other checks of the same invocation have no issue (it costs money); `--critic-always` overrides.

## Vision critic
Bedrock Converse, model `--critic-model` / env `UI_CRITIC_MODEL` / default `global.anthropic.claude-sonnet-5-5` (`global.anthropic.claude-opus-5-5` works the same),
region `AWS_REGION` or `us-east-1`, no temperature (Sonnet 5.5 rejects the parameter), max tokens 1500, system prompt `rubric.md`. Images (JPEG q80, full page cut at 3600 px): up to 6 routes
(the first plus the densest) at 1280 and at 1440 px, plus the first route in the dark theme at 1280 px. Output: strict JSON (6 criteria: `hierarchy`, `realism`,
`consistency`, `readability`, `layout`, `fit`), parsed and validated, one retry on invalid JSON. Cost = Bedrock usage tokens x constants in
`lib/quality/constants.mjs` (assumption: 3.00 / 15.00 USD per million input / output tokens; env `UI_CRITIC_PRICE_IN_PER_M`, `UI_CRITIC_PRICE_OUT_PER_M` override).
**Golden reference (D-37):** the critic first receives the screenshots in `<reference-dir>/screenshots/*.png` (default `../kit/examples/spudtrack`
relative to `bin/`: `shot-dashboard.png`, `shot-detail.png`), labelled "REFERENCE (the bar)", then the candidate screenshots. In the rubric a 5 means at least as
polished, domain-specific and detailed as the reference, a 3 clearly generic. The answer carries a 7th reported line `parity` (`below|close|equal|above` + reason): printed as
`PARITY <verdict> <reason>`, stored in `critic.parity`, a `critic-parity` warning when `below`; never part of the verdict. `--no-reference` sends no reference (parity null);
a missing reference dir gives the warning `critic-reference-missing` and the critic continues with the anchors alone. The installer must copy `kit/examples/spudtrack/screenshots/`.
A missing credential or API error gives `critic: {"error"}` and a `WARN`; it never fails the gate by itself. `--critic-mock <file>` takes the model answer from a file
(screenshots are still taken). `--critic-save-shots <dir>` keeps the images for inspection.

## Speed (measured numbers: `tests/evidence/2026-11-04/addon/F3/A23-gate-timing.log`)
One Playwright page load per route and width collects console, network, overflow, data and axe together. Lighthouse runs once per route in 3 child processes against the
same Chrome (remote debugging port), accessibility category only, throttling `simulate` with 0 ms quiet windows and no full-page screenshot (`provided`/`devtools`
force 5 s quiet windows: 14 s per route instead of 3 s; Lighthouse cannot run twice at once inside one process). The 768/375 passes come last; axe there is skipped
(warning `axe-skipped`) when `--budget-s` (default 45) is used up. The layout checks (`lib/quality/layout-fns.mjs`) run in the same page loads at 1280/1440 and in two extra light passes at 1324 and 1920 px (`widths.layout`; `timings.layoutPassMs`, about 4 s for 5 routes).

## Tests
`addon/tests/quality/run-in-container.sh <log> unit gate reference timing` (pinned container, `npm ci` in one container with network, the tests in a second one with `--network none`).
