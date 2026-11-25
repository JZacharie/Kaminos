# Layout and coherence rules for every UI builder (one source)

Read this once before you write markup or data. `ui-designer`, `ui-data-builder`, `ui-screen-builder` and `ui-single-builder` all point here; do not copy it elsewhere.
The quality gate measures every rule at **1280, 1324, 1440 and 1920 px** and names the selector it finds (`broken-word`, `narrow-row`, `header-wrap`, `child-overflow`, `column-hole`, `overflow`).

## Blocks first
Screens are composed from the UI blocks of `.aidlc-ui/kit/BLOCKS.md` (shell, kpi, table, filterbar, feed, detail, board, map, siteplan, lanes, steps, series, bars, options, segmented), not drawn by hand. Each block keeps ids and times on one line, fits its map to its places, sizes to its content and scrolls wide tables inside its card, so a placeholder in a `k-span-*` cell cannot produce the defects below. Hand-write HTML only for what no block covers (a form, tabs, a card of prose); those parts follow the rules below unchanged, with the components of `components/*.html`.
Around blocks: put each in a `k-grid` cell (`k-span-3|4|5|6|7|8|9|12`: 7+5 and 9+3 pairs; ui-build warns on an unknown span), keep the `a-...` anchor id on the placeholder, and never restyle block internals in `extra.css` (change the config or the theme instead).

## Widths you design for
Content is at most 1136 px wide. In `k-grid`: `k-span-3` = 272 px, `k-span-4` = 368, `k-span-6` = 576, `k-span-8` = 784, `k-span-12` = 1136. Subtract 32 px of card padding for what the content gets.

## Rules (each one is checked)
1. **Words never break.** No `overflow-wrap:anywhere`, `word-break:break-all|break-word`, `hyphens:auto`, no letter-by-letter columns. Only an id, hash or URL may break: give it class `k-break`. (Gate: `broken-word`.)
2. **Columns follow the container, not the wish.** A card under 480 px (`k-span-2|3`) holds at most 3 columns of text; a card of `k-span-4` at most 4. Never write `repeat(N,1fr)` or N children with `flex:1` for N >= 4 inside a card. Use `k-rowfit k-rowfit-sm|md|lg` (7 / 10 / 15 rem minimum per column; wraps instead of squeezing) or `repeat(auto-fit,minmax(min(100%,10rem),1fr))`. Five status cells in a 272 px card become a `k-list`, a `k-dl` or a `k-rowfit-md`. (Gate: `narrow-row`.)
3. **Cards are content-sized.** No fixed `height`, no `overflow:hidden` to hide text, no text wider than its card; a flex or grid child that holds text gets `min-width:0` only together with a wrap rule. (Gate: `child-overflow`, `overflow`.) `k-grid` aligns cards to the top, so a short card beside a tall one stays short (`k-grid-stretch` on the grid only for a row of same-kind cards). Cards side by side in a row end within 200 px of each other (Gate: `column-hole`): cap a long list at about 6 rows with a View all link, stack the short cards in one `k-stack` column, or move a card below. An empty card is a `k-empty-sm`, never a blank area.
4. **One line of navigation.** Top bar exactly as `components/shell.html`: at most 7 nav links, each 1-2 words and at most 14 characters, nothing else in the bar except brand, theme toggle and one user chip. Secondary links go on a screen. (Gate: `header-wrap`.)
5. **Tables** sit in `k-table-wrap` and may scroll sideways inside their card; in a card under 480 px show at most 4 columns (`k-opt` for the rest). Never answer a clipped column with truncation or a narrower column: drop, merge or move it; at most 7 columns at 1280 px. `kit.js` keeps ids (`SP-2417`) and times (`14:30–16:00`) on one line everywhere and pins the first column of a 7+ column table (make it the id or name); only a long text column (route, address) wraps. Filter bar: `k-filterbar` with chip groups as `k-field k-chip-group`, then selects, then `k-field k-search` last.
6. **No fixed pixel widths** above 100 %, no `position:absolute` for layout, no card variants for phones. Dark theme is first-class.
7. **Before you hand over**, check each row against rule 2 and every screen at 1324 px: header, 272 px cards, widest table.

## Maps (never draw geography)
- **Crop every map to the places it shows.** `const frame = basemapFit(places, { aspect: 1.5 })` (`[[lat, lon], ...]`, every marker and route end on the map), then `basemapEurope({ fit: frame, overlay })`. Never show all of Europe for six cities or leave Scandinavia on screen for Iberian places. Aspect 1.5 in a `k-span-6` card, 1.8 to 2.2 in `k-span-8|12`. The same `frame` goes to `basemapMarkers`, `basemapEdge` and `basemapProject(lat, lon, frame)` (`xPct`/`yPct` for DOM chips over the map).
- **Real place, region or route network:** `basemapMarkers([{ id, lat, lon, label, tone }], { frame })` (labels go where they hit nothing), `basemapRoute(id, lat1, lon1, lat2, lon2, { tone, dash })`, `distanceKm` (components/basemap.html). No hand-drawn outlines or country polygons, no tiles. Markers and labels stay 10 and 12 px whatever the crop.
- **Far places** (New York next to Iberia): leave them out of `basemapFit`, add `basemapEdge(id, lat, lon, frame, { label, tone })` and a dashed `basemapRoute(..., { dash: true, lift: 0.04 })`.
- **Legend = markers:** `basemapLegend([{ label, tone }])` with the tones of the markers and routes (`accent ok warn bad info neutral`).
- **Fictional site on a real coast or city:** the name is fictional, the coordinates are those of a real spot nearby, in the data (`brief.json` `map.site`); the real place's name stays in a data comment. Within about 30 km of an airport or city, label only the site and say the distance in text.
- **Inside the site** (stages, gates, hotel, shuttle, charge points, bays): an inline SVG **site plan** labelled "Schematic, not to scale", places and distances (with unit) from data rows. Never a drawn coastline or country shape; no two plan labels closer than 18 px, list distances beside the plan when they would collide.
- Local scale (under about 50 km) cannot be shown on the Europe basemap: site plan for the site, basemap for where people come from. Every marker and route a person can point at has an `a-...` id.

## Charts and detail routes
- `chartBar|chartLine` draw at their card's width (12 px text) and again on resize: no `width` or `font-size` on the SVG. Pass `unit` and `min: 0` where zero matters; x labels wrap, slant or thin out, never "Missed t...". `threshold: { value, label: 'Max 65 % RH' }` draws a limit; `bands: [{ from, to, label, tone }]` shades a y range (tariff, comfort range); `xbands: [{ from, to, label }]` shades x label indexes (peak hours).
- A detail screen keeps its list lit in the nav: `<section data-route="#/artist/AR-07" data-parent="#/lineup">` (without it `#/shipment/X` lights `#/shipments`).

## Numbers that must agree (derive, never type twice)
- `brief.json` `dataDerived.agree[]` lists each figure that appears in more than one place (header, label, table cell, KPI, tooltip, map): `kpi` = the key in `dataDerived.kpis`, `shownOn` = the anchors or screens, `rule` = what it measures and its unit.
- `ui-data-builder` computes each one once (`APP_DATA.kpis.<name>`, or a field of the rows) from the same coordinates and rows. Screen builders **read** it; they never write the number or a distance into markup, a label or a title.
- Say what a number measures where two exist: "449 km flown, LHR to the airport" and "20 km by road, airport to the site" are two figures with two labels, not one.
- Counts, totals and percentages shown next to a table are computed from the rows of that table with the same filter.
