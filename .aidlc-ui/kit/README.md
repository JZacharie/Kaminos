# AI-DLC UI kit

Design kit for the first UI of an idea (decisions D-33, D-36). You write body markup and data; the kit already is accessible (WCAG AA in the
light and the dark theme), offline and laid out for laptop screens (blocking widths 1280 and 1440 px). Tablet (768) and phone (375) layouts exist
(grid collapses, nav sheet, table card view) but are best effort and never block. Never write CSS for layout.
Installed as `<project>/.aidlc-ui/kit/`, built with `.aidlc-ui/bin/ui-build`. License: MIT-0 (`LICENSE`).

## How an agent uses it (the 25 lines)

1. Work in `<record>/ui/src/`. Screens mode (one file per screen, so subagents can write screens in parallel): `shell.html` (top bar + nav, from `components/shell.html`), `screens/10-<name>.html`,
   `screens/20-<name>.html` ... (sorted by file name), optional `overlays.html` (dialogs), `data.js`, `effects.json`, `head.json`, `extra.css`.
   Block configs of a screen: `screens/NN-<id>.blocks.js` (inlined after `data.js`, one script per file). Simple mode: one `body.html`. Never both.
   **Load order** (screens mode): kit, the inline `<script>`s of the screens (they only push functions to `window.APP_RENDER`), `data.js` (builds `window.APP_DATA`, then its last line calls every `APP_RENDER` function), then the `*.blocks.js` files. So a render function runs BEFORE any `.blocks.js` exists: it may use `D` (`window.APP_DATA`), the kit helpers and its own file, nothing defined in a `.blocks.js`; a `.blocks.js` config or event handler runs later and may use everything. `ui-render-check` and `ui-version` render every screen and refuse a block that says "cannot be shown".
2. One `<section data-route="#/x" aria-labelledby="h-x">` per screen, with exactly one `<h1 id="h-x">`. The route is the `screens[].route`
   of `ui-map.json`. The section never carries `hidden` or `aria-hidden` (the router skips such sections; `ui-build` rejects them). A detail screen that is reached from a list uses `data-route="#/shipment/SP-2405"` and `data-k-nav="#/shipments"`
   (the nav link to highlight); any `#/shipment/<id>` shows it, read the id in `data.js` from the `kit:route` event (`e.detail.hash`).
3. The top bar and navigation are the `shell` pseudo-screen (`screens[]` entry `shell`, route of the default screen).
4. Anchors: `id="a-..."` on the root of the component (the card, the `<nav>`, the table wrapper, the form, a `<th>` for a column).
   Keep every anchored element self-contained and not nested in another anchored element (columns of a table and fields of a form are the exception).
5. **Blocks first.** Read `BLOCKS.md` (generated catalog of the UI blocks: shell, kpi, table, map, series, bars, lanes, ...). A region of a screen is a placeholder `<div id="a-..." data-k-block="table" data-k-cfg="<key>"></div>` whose config is
   `UI_BLOCKS['<key>'] = function () { var D = window.APP_DATA; return {...}; }` in `screens/NN-<id>.blocks.js` (screens mode; in `body.html` mode put it in `data.js`). `ui-build` detects the blocks used (placeholders, `K.block.<name>(` calls, `head.json` `blocks`) and inlines only those.
   Hand-write HTML only for what no block covers.
   Read `LAYOUT-RULES.md` (layout, maps, numbers that must agree: one rulebook, checked by the gate). Copy components from `components/*.html`; keep their classes. Layout: `k-grid` + `k-span-3|4|5|6|7|8|9|12` (12 columns from 1280 px, 6 at 768, one
   column at 375), `k-stack`, `k-row`, `k-kpis` (auto-fit KPI row), `k-rowfit` (any other row of equal columns: `k-rowfit-sm|md|lg` = 7 / 10 / 15 rem minimum per column, wraps instead of squeezing), `k-filters`. Charts: empty `<figure class="k-chart" id="...">` plus a
   helper call in `data.js`.
6. Data: 12 to 60 realistic rows generated in `data.js` with the helpers of `data/seed.js` (see `data-template.md`). Fill tables with
   `fill('#tbody-id', rows, rowTemplate)`; escape every value with `esc()`.
7. Optional: `head.json` `{ "title", "lang", "themeColor", "accent": "gold|teal|indigo", "await": true }`. `await` puts `data-k-await` on `<html>`: a page that replaces its built-in data with real data after load keeps its data regions (`.k-kpis`, `.k-table-wrap`, `.k-list`, `.k-chart`, `.k-timeline`, `.k-alerts`, `[data-k-data]`) hidden until its script calls `kit.ready()` after the first load (they show again after 5 s anyway). `gold` (potato-gold), `teal` and `indigo` are the three ready palettes; `blue` is the default, `green`, `orange`, `violet`, `rose` also exist. All are AA-checked in both themes.
8. Answer effects (`effects.json`, ANCHORS 2b) are plain JSON; `ui-build` writes the single `#aidlc-effects` block.
   `ui-build` checks every `screens/NN-<screen-id>.html`: exactly one `<section data-route>` per file, the route equals the `ui-map.json`
   screen of that id, routes and element ids are unique across files; it prints one line per screen (bytes, anchors).
9. Build and snapshot: `.aidlc-ui/bin/ui-build <ui-dir>` writes `<ui-dir>/prototype.html`; then
   `.aidlc-ui/bin/ui-version <ui-dir> --cause agent-stage --stage ui-prototype-v1` copies it to `versions/v1/` (first call keeps N=1; later calls
   bump N by one in `ui-map.json` and in the `aidlc-ui-version` meta). `ui-build` never calls `ui-version`; run them in that order. Both append events to `<ui-dir>/progress.jsonl` (`assemble` start/done/fail, `publish` done;
   `lib/progress.js`, contract `templates/progress-events.md`); `--no-progress` turns that off, I/O problems never fail the tools.

## Rules that keep the quality gate green

- No horizontal scrolling at 1280 and 1440 px (blocking); narrower widths are advisory. Never set fixed widths larger than 100 %
  (`style="width:600px"`; `ui-build` warns). Do not use `position:absolute` for layout.
- Layout rules (B1): words are never broken (`overflow-wrap:normal`; opt in with `k-break` for ids, hashes, URLs). Never write `repeat(N,1fr)` or N flex children
  with `flex:1` for N >= 4 inside a card: use `k-rowfit`. A card narrower than 480 px (`k-span-3` at 1280) holds at most 3 columns; a table
  in a card scrolls inside `k-table-wrap` (cells are at least 5 rem wide). Grid and flex children that hold text get `min-width:0` only together with a `minmax`/wrap
  strategy, never alone. The top bar is one line from 1024 px: at most 7 nav links, labels of one or two words (max 14 characters); the kit hides `.k-menu-btn` from 768 px.
  The gate checks all of this at 1280, 1324, 1440 and 1920 px (`broken-word`, `narrow-row`, `header-wrap`, `child-overflow`).
- Tables: class `k-table` inside `k-table-wrap`, `<caption class="k-sr">`, `scope="col"` on every `<th>`, `data-label` on every `<td>` except the
  first (the card title below 640 px), at least 12 rows, low-priority columns `class="k-opt"` (hidden 640-1023 px), numbers `class="k-num"`.
- Images need `alt` (decorative: `alt=""`). Prefer inline SVG or none. No `<img src="file">`, no URLs, no fonts from outside.
- Every form field has a visible `<label for>`; errors use `.k-error` and `aria-describedby`; groups use `<fieldset><legend>`.
- Charts need a title and a description: use the helpers, they write `<title>`, `<desc>` and `role="img"`. Never carry meaning by colour alone.
- Colours only through tokens (`var(--accent)`, `var(--bad)`, ... never hex in markup or `extra.css`); both themes must work. Status always has text.
- Buttons are `<button>` or `<a class="k-btn">`; links have text that makes sense alone; one `<h1>` per screen; headings do not skip levels.
- No inline event handler attributes, no `eval`, no network. `src/extra.css` is for small decorative additions only.

## Files

| Path | Content |
|---|---|
| `kit.css` | tokens (light/dark with `light-dark()`, `[data-theme]` override, `[data-accent]` presets), base, grid, components (`k-` prefix) |
| `kit.js` | hash router, nav menu, theme toggle, tabs, dialogs, toast (`kitToast`), form validation, table sort/filter/pager |
| `data/seed.js`, `data/charts.js`, `data/basemap.js` | `seedRandom`, `pick`, `weighted`, `range`, `dateBack`, `pad`, `fmt*`, `esc`, `fill`, `text`; `chartBar`, `chartLine`, `chartDonut`, `sparkline`; `basemapEurope`, `basemapMarker`, `basemapArc`, `basemapProject`, `distanceKm`, `BASEMAP_AIRPORTS` |
| `motion.css`, `motion.js`, `motion-fx.css`, `motion-fx.js` | opt-in animations (28: 14 basic, 14 "wow"; see "Motion"): inlined by `ui-build` only when a prototype uses one; `window.kitMotion` |
| `BLOCKS.md`, `blocks/` | the UI blocks: catalog for agents (generated by `blocks/gen-catalog.mjs` from the `@block` header of each `blocks/<name>.js`, which also holds the full `Config:` list), design language and contract (`blocks/DESIGN.md`) |
| `components/` | one copy-paste example per family: shell, cards (page header, KPI, dl, timeline, list), table (filters, pager), forms (buttons), badges-alerts, tabs, dialog-toast, states (empty, skeleton), charts, basemap |
| `data-template.md` | how to generate realistic data, vocabulary for six domains |
| `reference/` | the finished SpudTrack prototype: `src/`, built `prototype.html`, `ui-map.json`, sample questions |

## Behaviour attributes (kit.js)

| Attribute | Where | Effect |
|---|---|---|
| `data-route`, `data-k-nav` | `<section>` | hash router shows the matching section (first one by default), highlights the nav link |
| `data-k-menu` | button | opens and closes the nav sheet below 768 px (`aria-expanded`), Escape closes |
| `data-k-theme` | button | toggles light and dark (`aria-pressed`), remembered in `localStorage` when allowed |
| `data-k-open="#id"`, `data-k-close` | button | open / close a `<dialog>`; a click on the backdrop closes |
| `data-k-tabs` | container | `role=tablist` / `tab` / `tabpanel` behaviour with arrow keys |
| `data-k-toast="text"`, `data-k-toast-kind` | button | shows a toast; `kitToast(text, kind?, ms?)` from `data.js` |
| `form[data-k-validate][data-k-success]` | form | native validation messages into `.k-error`, success toast |
| `table[data-k-table][data-k-pagesize]` | table | `th[data-k-sort="text\|num"]` sortable (keeps `data-v` raw values); counts, empty state, pager |
| `data-k-filter="#table-id"` (+ `data-k-col`, `data-k-value`) | input / select / chip button | text filter (no `data-k-col`) or equality filter on column `data-k-col` (0-based) |
| `data-k-sortby="#table-id"` | select | sort control for the card view (`value="3:desc"`) |
| `data-k-count`, `data-k-empty`, `data-k-pager` (`data-k-prev`, `data-k-next`, `data-k-range`) | any | result count, empty state, pager of the table with that id |

`window.kit.route()` re-evaluates the route; `window.kit.refresh('#table-id')` re-applies filters after you changed rows.
The window event `kit:route` (`detail.hash`, `detail.route`, `detail.section`) fires after every route change, including the first one.

## Motion (optional, opt-in)

`motion.css` + `motion.js` add 14 polished animations (and `motion-fx` 14 more, below). Pure CSS and vanilla JS (Web Animations), no library, no network, works from `file://`. **Nothing moves unless an element asks for it** (an attribute or class below),
so a prototype that uses none of them is built byte for byte as before: `ui-build` inlines the two files only when it finds one of the attributes (or `head.json` `"motion": true`).
Rules: only `transform` and `opacity` animate (two small exceptions: the progress ring and the tab indicator width); colours come from the kit tokens, so light and dark both work.
With `prefers-reduced-motion: reduce` (or `<html data-k-reduce>`) **every element is in its final state at once and nothing moves**; the preference is also followed while the page runs. Loops stop: the marquee has a Pause button
and pauses on hover and focus, `kitMotion.pause()` stops every loop (marquee, skeleton shimmer). Entrances wait for the element to scroll into view, also inside a screen the router shows later.

| # | Animation | How to ask for it |
|---|---|---|
| 1 | Entrance on scroll | `data-k-anim="fade \| fade-up \| fade-down \| fade-left \| scale \| blur"`, optional `data-k-delay="200"` and `data-k-duration="600"` (ms). There is no slide-in from the right on purpose: it would create sideways scroll |
| 2 | Staggered list or grid | `data-k-stagger="70"` (ms between children) on the list or grid; `data-k-anim="scale"` on it picks the children's effect (default `fade-up`); `data-k-stagger-of=".k-kpi"` picks other descendants. The total delay is capped at 0.9 s |
| 3 | Skeleton, then content | `<div data-k-load="1200"><div data-k-skel>` shapes `<span class="k-skel k-skel-line k-skel-w60"></span>` (`k-skel-circle`, `k-skel-block`) `</div><div data-k-content>` real content `</div></div>`; swaps after 1200 ms, or call `kitMotion.loaded(el)` (use `data-k-load=""`) |
| 4 | Number count-up | `data-k-countup` on an element whose text is a number (`1,284`, `96.4%`, `EUR 48,250`; `data-k-from`, `data-k-duration`), or `data-k-anim="count-up"` on a container: it counts every `[data-k-countup]` and every KPI block number inside (put it on the `kpi` placeholder). The original text is restored exactly; non-numbers are left alone |
| 5 | Progress bar and ring | `<div data-k-progress="72" aria-label="Upload"></div>` and `<div data-k-ring="72" aria-label="Upload"></div>` (`data-k-max`, `data-k-tone="ok \| warn \| bad \| info"`, `data-k-ring-text`); both get `role="progressbar"` and `aria-valuenow`; the ring counts its number up; size with `--k-m-size` |
| 6 | Sliding tab or segment indicator | `data-k-anim="indicator"` on the tabs container (`data-k-tabs`, `.k-tabs`), on a `segmented` placeholder or on `.k-nav`: one marker slides to the selected item (follows `aria-selected`, `aria-checked`, `aria-pressed`, `aria-current`), also after a block re-renders |
| 7 | Hover: lift, glow, press | classes `k-lift` (rises, shadow fades in), `k-glow` (accent spotlight follows the pointer), `k-press` (presses in); hover and `:focus-within` |
| 8 | Button press and ripple | page-wide `data-k-motion="press"` gives every `.k-btn` a press and a ripple; or `data-k-anim="ripple"` on one element |
| 9 | Toast and dialog enter and exit | page-wide `data-k-motion="toast dialog"`: toasts slide in and fade out before they are removed, `<dialog class="k-dialog">` and its backdrop fade and scale in and out (Chrome, Edge, Safari 17.4+, Firefox 129+; older browsers show them without motion) |
| 10 | Chart draw-in | `data-k-anim="draw"` on the chart's `<figure class="k-chart">`, or on the placeholder of a `series` or `bars` block: lines draw, bars grow from the baseline, areas and dots fade in, a donut turns in |
| 11 | Text reveal | `data-k-anim="type"` (typewriter with caret, `data-k-speed` ms per character) or `data-k-anim="words"` (word by word); plain text only; screen readers get the whole text at once |
| 12 | Marquee ticker | `data-k-anim="marquee"` on a row of chips or links (`data-k-speed` px per second); give it `role="region"` and an `aria-label`; a Pause button follows it |
| 13 | Success check and confetti | `<span data-k-anim="check"></span>` draws a circle and a tick (put the words next to it); `data-k-confetti="40"` on a button, or `kitMotion.confetti(el, 40)` |
| 14 | Page transition | page-wide `data-k-motion="page"`: the screen the router shows slides in |

### The wow pack (`motion-fx.css` + `motion-fx.js`: 14 more effects)

Same rules as above (opt-in, offline, tokens, reduced motion = final state), plus: `requestAnimationFrame` only while something moves (an idle page requests no frame), the heavy ones (**aurora**, **particles**)
run for one element at a time and pause off screen and in a hidden tab, counts are capped (about 720 dots, 450 sparks, 24 shards, 80 trail points). Under reduced motion the decorative effects (tilt, magnetic, trail,
spotlight follow, aurora, particles, fireworks, shatter) do nothing, and the interactions (drag, carousel, flip, tour, morph) still work but jump instead of animating. `ui-build` inlines the pack (and `motion.js`)
when it finds one of these attributes or `kitMotion.morph|shatter|fireworks|spotlight|trail|flip`, or `head.json` `"motion": "fx"`.

| # | Effect | How to ask for it |
|---|---|---|
| 15 | Morph between screens | `data-k-morph-open="#panel"` on a card: it grows into the `<dialog>` or `[hidden]` panel `#panel`; a `data-k-morph-close` button inside shrinks it back. Between routes: card `<a href="#/detail" data-k-morph="car">`, on the detail screen `data-k-morph-target="car"` (the element it becomes) and `<a href="#/list" data-k-morph-back="car">`. View Transitions API; browsers without it get a FLIP animation. JS form: `kitMotion.morph(fromEl, update, () => toEl)` |
| 16 | 3D tilt card | `data-k-tilt="10"` (max degrees): tilts toward the pointer with a moving glare; children with `data-k-z="40"` float above the card |
| 17 | Aurora background | `data-k-aurora` on a container: five blurred blobs drift and blend (transforms only). Keep text on it large or semibold |
| 18 | Text scramble | `data-k-scramble` (on appear) or `data-k-scramble="hover"` (also on hover and focus): random glyphs settle into the text; single line works best; readers get the whole text |
| 19 | Drag with physics | `data-k-drag="free \| snap \| home"` on a container of cards: inertia and bounce off the container, `snap` lands on a grid (`data-k-drag-grid="64"`), `home` springs back; arrow keys nudge the focused card, Home resets it |
| 20 | Particles | `data-k-particles="Word"` on a block with a height (13 rem by default): dots gather into the word and flee the pointer, then the loop sleeps |
| 21 | Scroll story | `data-k-story` on a section: `[data-k-depth="-1..1"]` layers drift at their own speed, an svg `path[data-k-draw]` draws itself while the section scrolls through the screen |
| 22 | Magnetic button | `data-k-magnetic=".35"` (strength; `data-k-radius="70"`): pulled toward the pointer, springs back |
| 23 | Shatter on delete | `data-k-shatter="#selector"` on the delete button (default: the closest `[data-k-shatter-item]`): the element breaks into 24 pieces that fall, then it is removed (`data-k-shatter-restore="400"` brings it back, for demos); `kitMotion.shatter(el, {remove: true})`; fires `kit:shatter` |
| 24 | Cursor trail | `data-k-trail` on a container, or `kitMotion.trail(true)` for the whole page (party mode; `trail(false)` stops it) |
| 25 | 3D carousel | `data-k-carousel` (or `="auto"`: turns by itself, paused on hover, focus and off screen) on a row of cards: Previous and Next buttons, arrow keys and dragging; only the front card can be reached |
| 26 | Page flip / fold | `data-k-flip` (flip) or `data-k-flip="fold"` on a wizard: steps are `[data-k-step]`, buttons `[data-k-flip-prev]` and `[data-k-flip-next]`, `[data-k-flip-count]` shows "2 / 3"; `kitMotion.flip(host, index)`; fires `kit:flip` |
| 27 | Spotlight and tour | `data-k-spotlight` (everything dims except a circle that follows the pointer) or `data-k-spotlight="tour"` with `[data-k-tour="1"][data-k-tour-text="..."]` targets and a `[data-k-spotlight-start]` button (Back, Next, Close, Escape); `kitMotion.spotlight(host)` starts it |
| 28 | Fireworks | `data-k-fireworks="5"` (rockets) on a button, or `kitMotion.fireworks({shots: 5})`; the canvas removes itself when the last spark fades |

`data-k-motion="toast dialog page press"` (or `all`) goes on any element, for example the top bar in `shell.html`: `<header class="k-topbar" data-k-motion="all">`. `kitMotion.enable('toast', 'page')` from `data.js` does the same.

JS: `kitMotion.replay(selectorOrElement)` plays an element and everything inside it again, `.confetti(elementOrPoint, n)`, `.loaded(el)`, `.pause()` / `.resume()`, `.reduced()`, `.scan(root)` (after you add markup by hand; blocks and later nodes are picked up by themselves).
Do not set `data-k-anim` on a block's inner elements (blocks redraw them); put it on the placeholder `div`. Do not animate the `<section data-route>` of a screen with `fade-left` or other moves: use `data-k-motion="page"`.
Examples: `../tests/blocks/gallery/motion.html` and `motion-fx.html` (28, with a Replay button where it makes sense), the showcase `../tests/blocks/build-showcase.mjs`. Tests: `node --test ../tests/blocks/motion.test.mjs ../tests/blocks/motion-fx.test.mjs`.

## Check it yourself

`../tests/kit/check-kit.mjs` (Playwright + axe, both themes, 1280/1440 blocking, 375/768 advisory) and `../bin/quality-gate` (S13b) check a prototype;
`../tests/kit/build-gallery.sh <dir>` builds every component into one page.

## Basemap (geography)

Never hand-draw a map. `data/basemap.js` (inlined by `ui-build` like `charts.js`) draws Europe (lon -25..45, lat 33..72, Mercator, about square) from
Natural Earth 110m country borders (public domain) and projects real coordinates. Call it from `src/data.js`; example in `components/basemap.html`.

| Function | Result |
|---|---|
| `basemapFit(places, { pad?, aspect? })` | the crop `frame` of the map that shows `[[lat, lon], ...]`; always call it (aspect 1.5 in a half-width card) |
| `basemapEurope({ fit, title?, overlay? })` | inline `<svg role="img">` of that crop: sea, land, thin borders, graticule; tokens only, so light and dark work; the SVG has the aspect ratio of the crop; without `fit` it draws all of Europe |
| `basemapMarkers(list, { frame })` / `basemapMarker(id, lat, lon, { label?, tone?, side? })` | `<g id="a-...">` markers at real positions (10 px dot, 12 px label whatever the crop); `basemapMarkers` places each label where it hits nothing |
| `basemapRoute(id, lat1, lon1, lat2, lon2, { tone?, dash?, lift? })` / `basemapArc(...)` | `<path id>` great-circle route in the colour of its tone / just the path `d` |
| `basemapEdge(id, lat, lon, frame, { label?, tone? })` | a place outside the crop as an arrow on the frame edge |
| `basemapLegend([{ label, tone }])` | legend whose dots have the colours of the markers and routes of the same tone |
| `basemapProject(lat, lon, frame?)` | `{ x, y, xPct, yPct }`; with a frame the percentages are relative to the crop |
| `distanceKm(lat1, lon1, lat2, lon2)` | haversine kilometres |
| `BASEMAP_AIRPORTS` | 30 major European airports `{ iata, name, lat, lon }` (OurAirports, public domain) |

Other polish in the kit (rules: `LAYOUT-RULES.md`): `k-grid` aligns cards to the top (`k-grid-stretch` opts in to equal heights), `k-empty-sm`, `k-filterbar`, wide tables (7+ columns) scroll in their wrapper with a pinned first column, ids and times never wrap (`kit.js`), `data-parent` on a route section keeps the list lit in the nav, charts take `unit`, `threshold`, `bands`, `xbands` and are drawn at their card's width. Test: `node --test tests/kit/polish.test.mjs`.

Regenerate the data arrays with `tools/gen-basemap.mjs` (inputs: the Natural Earth GeoJSON and the OurAirports `airports.csv`); the functions live in `tools/basemap-fns.js` and are spliced in. Test: `node --test tests/kit/basemap.test.mjs`.
