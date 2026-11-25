# addon/knowledge

Knowledge files that the Canvas bridge puts into the refinement agent's prompt. Plain Markdown, imperative style, written for an LLM reader.
`ui-changes-classifier.md` defines how a refinement request is classified, the JSON the agent returns, the selection-safety rules and the `ui-changes.md` format.
Check with `node addon/tests/knowledge/check-classifier.mjs` (no dependencies; run it in the test container).

`ui-round-planner.md` is the prompt knowledge of the round call (D-31): apply the batch of open answers in one new prototype state and propose the next questions with their effects (round 1: no fixed cap, schema ceiling 5; round 2: 3; round 3 and later: 5). Output: `../schemas/round-result.schema.json` only (last line, single line).
Check with `node addon/tests/knowledge/check-round-planner.mjs` (needs `npm ci` in `addon/` for ajv 8.17.1; `--self-test` runs the negative controls).
