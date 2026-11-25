---
name: ui-house-style
description: Technical guardrails for the first UI of an idea (offline, kit tokens, stable anchors, contrast, believable data, kit basemap and charts). Read together with frontend-design before designing or building any screen.
---

# UI house style: guardrails, not taste

Design freedom belongs to the designer and to the `frontend-design` skill: palette, composition, type scale, density and which element is the protagonist are your choices. This skill lists only the technical musts that keep the UI offline, accessible, pointable and checkable.

1. Self-contained page: no network of any kind (no CDN, web fonts, remote images, remote tiles). Use the system font stack or the kit fonts.
2. Colour through the kit CSS tokens (`var(--accent)`, `var(--surface)`, `var(--bad)`, ...) so the light and the dark theme both work. Extend tokens in `extra.css` instead of hard-coding hex values in markup.
3. Keep stable `a-...` ids on everything a person can point at (cards, markers, routes, columns, fields). Never rename an id the brief assigned.
4. Text contrast is at least 4.5:1 in both themes. Never carry meaning by colour alone.
5. Believable data: real names, units, dates and places. Never "Item 1", "Lorem ipsum" or "Test user".
6. Geography: never hand-draw a map or a coastline. Use the `map` block (`.aidlc-ui/kit/BLOCKS.md`; it crops itself to the places shown) or, when no block fits, the kit basemap helper (`basemapFit` to crop it to the shown places, then `basemapEurope({ fit })`, `basemapMarkers`, `basemapRoute`, `basemapLegend`) with real latitude and longitude; routes are arcs, distances come from `distanceKm`. A fictional site on a real coast gets the coordinates of a real spot nearby; inside the site use a schematic SVG plan labelled "Schematic, not to scale". Details: `.aidlc-ui/kit/LAYOUT-RULES.md`.
7. Charts and tables are blocks first (`series`, `bars`, `table`, `kpi` in `.aidlc-ui/kit/BLOCKS.md`); when no block fits, charts go through the kit chart helpers (`chartBar`, `chartLine`, `chartDonut`, `sparkline`), not hand-written coordinates.
8. One clear protagonist element per screen: the thing a person should see first is visibly the biggest or most distinct.
9. Check every screen at 1280, 1324, 1440 and 1920 px: no horizontal scroll, no word broken across lines, no row of columns squeezed into a narrow card (`.aidlc-ui/kit/LAYOUT-RULES.md`, enforced by the gate).

If a guardrail blocks a better design, keep the guardrail and say so in the assumptions.
