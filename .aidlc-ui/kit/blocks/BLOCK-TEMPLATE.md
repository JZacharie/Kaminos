# Block builder checklist

Read `DESIGN.md` (tokens, contract, layout rules) and your entry in `INVENTORY.md`. Copy the shape of `kpi.js`, `kpi.css` and `tests/blocks/gallery/kpi.html`.

## Files (only the ones your family owns)
- `addon/kit/blocks/<name>.js` (target <= 10 KB unminified) and `<name>.css` (<= 4 KB, `.k-<name>-*` classes only, tokens only). Size caps: see below.
- `addon/tests/blocks/gallery/<name>.html`: loads by relative path `../../../kit/blocks/blocks.css`, `<name>.css`, `core.js`, `<name>.js` (map also `../../../kit/data/basemap.js`); works from `file://`; honours `?theme=ops|control|warm` like kpi.html.
- Optional `addon/tests/blocks/<name>.test.mjs` (same Chrome harness as `core.test.mjs`).

## The doc block at the top of `<name>.js` (feeds BLOCKS.md; keep the format)
```
/* @block <name> <version> -- <one line: what it is>.
 * Use for: <when an agent should pick it, with app examples>
 * Load: blocks.css, core.js, <name>.css, <name>.js
 * Call: K.block.<name>('#a-...', {<minimal real config>})
 * Config:
 *   <field>  <type>, <required|default X>  <meaning, units, limits>
 *     <item field> ...
 *   (common) title, subtitle, actions, state, emptyText, frame, headingLevel
 * States: <which ones and how they look>
 */
```
Then `K.block.define('<name>', {version, schema, empty, emptyText, resize, render})`. The schema matches the doc block field for field.

## Gallery: one `<section data-state="...">` with an `<h2>` per case
Required: `normal` (realistic data from one of the 3 briefs), `empty`, `one` (1 item), `stress` (500 items or the block's realistic max: 40 lanes, 200 markers, 26 x 24 crew cells), `long` (very long labels and ids), `unicode` (accents, CJK, arrows, minus sign), `missing` (every optional field absent), `narrow` (a 360 px wide container inside the page), `loading`, `bad` (two bad configs: wrong type, missing required; only this section may contain `.k-block-error`). Add block-specific states (e.g. `offmap`, `now-over-block`, `collide`).

## Failure-proof tests (each one visible in the gallery or asserted in a test)
Never throws; bad config -> inline error + one warn; empty; 1 item; stress; long labels; unicode; missing optional fields; 1024 and 1920 containers; no letter-wrap of ids/times/numbers; no overlapping text; no clipped axis label; no horizontal page overflow; keyboard focus visible; AA contrast in all 3 themes; colours of marks = legend.

## Run the visual runner (task H1) and LOOK
```
nice -n 10 node addon/tests/blocks/shoot.mjs --page addon/tests/blocks/gallery/<name>.html --out ~/work/bk1/shots/<task> --widths 1024,1280,1440 --themes ops,control,warm
```
Writes `<out>/<width>/<theme>/<state>.png` and `<out>/dom.json`. Done = `flagCount` 0 and you have read the 1440 PNG of every state in all 3 themes plus 1024 ops with your image reader and found nothing a design-led SaaS team would reject. Then the critic: `node addon/tests/blocks/critic.mjs --shots <out> --block <name>` (target overall >= 4.5). One Chromium at a time; `uptime` first, keep load < 14.

## Do not
Edit `core.js`, `blocks.css`, another family's files or `kit/data/*` (write "core request: ..." in your notes instead). Use `console.error`, hard-coded colours, px font sizes outside tokens, `overflow-wrap:anywhere`, `height:100%` cards, or compute numbers the app did not give you.

## Size caps (`addon/tests/kit/ui-build-blocks.test.mjs`)
A new block gets 10 KB js and 4 KB css. The existing blocks have per-block caps = their size at the core round 2 (2026-11-12) + about 10 %, rounded up to 0.5 KB: map 30, table 25, siteplan 24.5, series 24, lanes 23.5, shell 19, bars 15.5, options 14, filterbar 13.5, board 12 (P-board: slot alignment, severity sort, group exception counts), feed 11, detail 9, segmented 8, steps 7, kpi 6 KB; css: shell 7, table 6.5, options 6, filterbar 5.5, board/feed/lanes 4.5 KB. Core 21.5 KB, blocks.css 16 KB.
Consumer-style blocks (BK1, 2026-11-17; they share `media.lib.{js,css}` = `K.media` icon/avatar/cover/stars/count/clock, about 7.5 + 2.5 KB, inlined once by ui-build): js tiles 12.5, rows 12.5, player 12.5, chat 14.5, posts 13.5, comments 14.5, profile 12.5, calendar 16 KB; css chat 6, profile 5.5, posts 5, the others 4.5 KB. tracks (KC1, 2026-11-20, numeric-time multi-track timeline): js 20.5, css 6 KB (ruler, playhead, seek/move/trim drag, snapping, zoom, keyboard and local state in one block). inspector (KC1, 2026-11-20, editable properties panel): js 20, css 8 KB (seven control types with clamp/snap/revert, tabs, collapsible sections, per-section Reset, local state and a 3 KB doc block). The catalog `BLOCKS.md` target is 9 KB for 25 blocks incl. tracks and inspector (was 8 KB for 23).
Why the big ones are big: they carry the label-collision and placement logic that the hand-written screens got wrong (map: fit to the shown places, edge chips, label and distance placement; siteplan: segment-vs-label placer with leaders; series/bars: tick and label thinning, threshold and band labels; lanes: the label-fit cascade, midnight, curfew and now lines), plus a 3-5 KB doc block that feeds BLOCKS.md. Raise a cap only with a reason in the commit; a block that grows past its cap trims first (doc block, rarely used options).
Payload (gzip -9, measured 2026-11-12): all 16 blocks js + css + core + blocks.css = about 86 KB; a 6-block app (shell, kpi, table, filterbar, feed, detail) inlines about 39 KB, a 10-block app with map (incl. basemap.js), series, bars and lanes about 79 KB.
