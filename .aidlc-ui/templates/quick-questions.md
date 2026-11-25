# Quick questions (D-29): the three chips

These three questions are fixed. Canvas shows them as chips in its start view (before the first prompt). Stage 1.1
(`intent-capture`) writes them as Q1-Q3 of `intent-capture-questions.md`, first, as the very first thing it does
(`[Kind]: quick`, no `[Anchor]:`). Texts and options below are the single source for both sides.

## Block copied into `intent-capture-questions.md` (Q1-Q3, verbatim)

```markdown
## Q1. [Product owner] Who will use this most?
[Kind]: quick

Why we ask: it decides what the first screen shows and how dense it is.

- A. Staff doing daily operational work
- B. Managers who want an overview and numbers
- C. Customers or partners outside the company
- D. Several of these groups about equally
- X. Other (please specify)

[Answer]:

## Q2. [Product owner] Which device matters most?
[Kind]: quick

Why we ask: it decides the layout (wide tables or stacked cards) and the size of touch targets.

- A. Desktop or laptop
- B. Phone
- C. Tablet
- D. All of them equally
- X. Other (please specify)

[Answer]:

## Q3. [Product owner] What is the main job of the first version?
[Kind]: quick

Why we ask: it decides which screen opens first and what is on it.

- A. Follow what is happening: lists, status, alerts
- B. Enter or capture data
- C. Review and approve requests
- D. Analyse numbers and trends: dashboards, reports
- X. Other (please specify)

[Answer]:
```

## Chip answers before the record exists: `<project>/aidlc/.ui-first/pending-quick.json`

Written by Canvas (atomic write: temp file in the same dir, then rename), read by the 1.1 agent twice (before building v1 and
again right before it writes the final v1). Schema: `addon/templates/pending-quick.schema.json`.

```json
{"schemaVersion": 1, "updatedAt": "2026-11-04T10:15:30Z", "answers": {"Q1": "B", "Q2": "A", "Q3": "D"}}
```

- Keys are only `Q1`, `Q2`, `Q3`; a key is absent until the person answers that chip. Values are an option letter `A`-`D`,
  or `X — <free text>` (an em dash between `X` and the text, as in the stock answer format).
- The file lives outside the record; the agent never deletes or edits it. After the record exists Canvas copies the buffered
  answers into the `[Answer]:` spans of Q1-Q3 (D-14) and the file becomes history.
- The agent folds chip answers into v1 when it finds them; it does not wait for chips that have not arrived (D-29).
