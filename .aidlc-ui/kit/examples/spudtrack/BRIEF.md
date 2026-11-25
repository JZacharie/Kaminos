# Brief: SpudTrack — UI-first AI-DLC demo

## Goal
Build ONE self-contained file: `index.html`.
Workshop demo of "UI-first AI-DLC": the AI first generates the frontend of an app, and the AI-DLC v2 Ideation/Inception questions are embedded INSIDE the app's UI, anchored to the exact elements they are about. Answering a question changes the UI live and writes a requirement. Quality bar: looks like a real, polished SaaS product; questions are smart and specific to what is on screen.

## The app
"SpudTrack" — shipment & goods tracking for a potato-chip company (fictional "Golden Spud Foods Ltd.", factory in Spain). Multimodal: ships, trucks, planes. Realistic domain:
- Outbound: chips pallets factory → EU DCs/retailers (trucks), UK/US/Middle East (container ships, dry or reefer), rare air freight for urgent promo launches/samples.
- Inbound: raw potatoes from farms (FR/NL), sunflower oil, packaging film.
- Chips risks: humidity (stale), crushing (fragile, low stack height), heat (oil rancidity), short best-before, lot traceability for recalls.
- ~18 mock shipments: id, mode, origin/destination, legs (e.g. factory→truck→port Valencia→ship→Felixstowe→truck→DC), ETA, status (on time/delayed/at port/customs/delivered), cargo (pallets, SKUs like "Classic 150g", "Ham 45g", lot, best-before), sensors (temp/humidity), carrier.

## Screens (single page, tab/hash nav)
1. Dashboard: KPIs (in transit, delayed, alerts, on-time %), small inline-SVG charts, alert feed.
2. Map: stylized inline SVG Europe/world map, routes, markers per mode (ship/truck/plane icons), legend, mode filter.
3. Shipments: table, filters (mode, status, search), sortable.
4. Shipment detail: multimodal leg timeline, cargo/lot panel, sensor mini-chart, documents (CMR, B/L, AWB), events.
5. Alerts: list with severity.

## Inception layer (the core idea — be clever)
- Top-bar toggle "Inception mode" (on by default). Numbered "?" pins sit ON the elements a question is about (KPI card, table column, map legend, timeline, sensor chart, nav tab...). Unanswered = pulsing accent pin; answered = check.
- Clicking a pin opens an anchored popover in AI-DLC question format: question, context line ("What you see: ..."), options A) B) C) D) + X) Other (free text), stage tag (1.1 Intent, 1.3 Feasibility, 1.4 Scope, 1.6 Mockups, 2.3 Requirements), and the FR/NFR id it produces.
- 14–18 questions; EVERY answer must visibly change the UI. Examples (improve on them):
  - "Which unit do we track?" container / pallet / box / lot → table column + detail panel change.
  - "Who uses the app?" logistics only / also retail customers / also carriers → adds/removes "Customer portal" tab + role switcher.
  - "Where does ship position come from?" AIS / carrier API / manual → map badge + freshness ("3 min ago" vs "6 h ago").
  - "Do we monitor humidity/temperature?" → sensor card + humidity alerts appear/disappear.
  - "What counts as a delay?" >2h / >12h / >24h / SLA cliente → delayed KPI and row badges recompute from mock data.
  - "Lot traceability for recalls?" → lot search box appears.
  - "Which alerts notify, and through which channel?" email / SMS / Teams → channel icons in alert feed.
  - Air freight in scope or not → planes greyed out/removed.
  - Documents, customs, CO2 per shipment, languages, ML ETA prediction, ERP (SAP) integration → feasibility tags.
- Scope board (1.4): slide-over listing modules as cards; move each to MVP / Later / Out; "Out" modules get dimmed with an "out of scope" ribbon in the app.
- Right drawer "AI-DLC": stage progress (answered per stage) + LIVE requirements preview built from answers: FR-xx / NFR-xx lines in AI-DLC requirements.md style, each with traceability "← Qn · elemento X". Highlight the line that just changed.
- Gate per stage: "Is this what you meant?" → Approve / Request changes (with comment). Stored in state.
- Export (Blob downloads): `requirements-analysis-questions.md` (AI-DLC format, each question with options and `[Answer]: B` or free text), `ui-map.json` (screens, element ids, linked question ids, FR ids, scope per module), `requirements.md` draft. These are the bridge into a real AI-DLC v2 run.
- First-run 3-step onboarding tooltip (pins, drawer, export), dismissable.
- localStorage persistence + "Reset" button.
- Version counter v1, v2, v3… on each answer + toast "UI changed by your answer".

## Tech constraints
- Single index.html, NO network at all (no CDN, fonts or web images). Vanilla JS (ES2020, component-style render functions + small store) and CSS. Inline SVG icons. Must work by double-click via file://.
- UI text in English (originally written in Spanish and translated; hash routes are English too: `#/dashboard`, `#/map`, `#/shipments`, `#/shipment/<id>`, `#/alerts`, `#/customer`, `#/carrier`); code comments and identifiers in English.
- Modern clean design, light theme + dark toggle via CSS variables, system font stack, accessible (real buttons, focus states, aria-labels, Esc closes popovers). Works at ≥1280px width.
- Structure: data, questions (declarative array: id, stage, anchor element id, text, context, options, effect key, fr), render, effects.

## Verification (mandatory; show commands + output in final report)
1. Extract the `<script>` content to a file under `$KIROCREW_SCRATCH`, run `node --check`; must pass.
2. Tiny node script that loads the questions array and asserts: ≥14 questions; each has stage, fr, ≥3 options, an anchor id present in the HTML/render code, and an effect handler.
3. grep for `http://` and `https://` → zero, except SVG xmlns strings.
Report size and line count.

## Stop condition
Done when the file exists, all 3 checks pass, and you report: path, size, question list (id, stage, anchored element, UI effect), and check outputs. Create no other files except scratch files. Do not open apps or browsers on the Mac.
