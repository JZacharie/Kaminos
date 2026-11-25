# Canonical seed: build the data FROM it (one rulebook for designer, data builder, single builder and refiner)

A workshop app ships `briefs/<app>.seed.json`: its records, constants and derived figures as JSON, generated from the same brief. In every benchmark run the builders
retyped or "improved" the brief's data (26 shipments instead of 18, 5 closed alerts instead of 2, totals that did not add up). The seed ends that: it is **copied by a
script, never retyped**, and the quality gate compares the built page with it (check `data`, ids `seed-*`). No seed file (a custom idea): none of this applies.

## Who does what
- **Stage 1.1 (main agent):** `brief.json` gets `"seed": "briefs/<app>.seed.json"`; then `.aidlc-ui/bin/ui-seed-import <ui>/src` writes `src/data.seed.js` and the pristine `src/seed.json`.
  `ui-build` inlines `data.seed.js` in front of `data.js`, so the page has `window.canon`.
- **Designer:** `dataEntities[].name` = the collection names of the seed (they are the keys of `window.APP_DATA`), `rows` = the seed's row count, `dataDerived.kpis[].value`
  = the seed's `totals`, `dataDerived.agree[]` from the seed's `agree` rules. Never invent a second name for a canonical collection.
- **Data builder / single builder:** build every canonical collection with `canon.rows('<name>', { dates: ['<date field>', ...] })` (a copy; fields listed in `dates` become `Date`
  objects) and put derived fields (status badges, labels, series, and every field the contract lists that the seed lacks, such as documents, events, leg times) on the COPY, and derived collections under their own names. Never change or drop a seed value. Read figures with `canon.total('<name>')` and constants with `canon.constants('<name>')`;
  `APP_DATA.kpis.<name> = canon.total('<name>')` for every total the brief shows. Extra, non-canonical collections (sensor series, generated history) get a name of their own.
- **Screen builders:** read everything from `D` (never copy a record, a count or a total into markup). A table or list that shows a small canonical collection (under 12 rows,
  for example 3 stages) carries `data-k-canon` on it or its wrapper, so the gate's 12-row rule does not apply to it.
- **Refiner (Canvas Agent mode):** may restyle and re-arrange, but never edits `data.seed.js`, `seed.json` or the canonical rows, and keeps `canon.*` in `data.js`.

## Never (the gate names the id and the fix)
- remove, rename, re-type, reorder-by-key or add a row of a canonical collection (`seed-rows`, `seed-collection`); change a canonical field (`seed-field`: AR-03.stage seed "B", page "A");
- recompute a total differently or type a figure (`seed-total`, `seed-agree` with a `selector` hint: the number on screen must equal the seed total);
- drop the embedding (`seed-missing`: no `window.CANON`) or write to `window.CANON` (`seed-canon-changed`);
- "round" a canonical number, translate a status, or fix a typo in a canonical string: the seed is the source of truth; report the problem in the final message instead.
Collections the seed marks as generator parameters (`seedOnly`: "collections.x (generator parameters)") are expanded by the page and not compared row by row.

## Check yourself
`.aidlc-ui/bin/ui-brief <record> --check` runs `data.js` in a sandbox and prints `BRIEF-DATA-SEED` lines for the same differences before the gate does.
