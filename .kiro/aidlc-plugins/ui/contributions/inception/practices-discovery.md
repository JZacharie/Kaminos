---
target: practices-discovery
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: before-step:4
    order: 100
---

## fragment: before-step:4

### Step 3a (ui): Write the questions file in the layout of the other stages

Write `practices-discovery-questions.md` in the same layout as the questions files of the
other stages, so Canvas shows it like them. Each question is one block:

- The heading line is `Q<n>.` (with the dot), then the topic in square brackets, then the
  question: `Q1. [Branching and merging] How should we work with branches?`, written as a
  second-level markdown heading.
- Every option is a bullet with a capital letter: `- A. Work on one main branch (suggested)`.
- The last option is `- X. Other (please specify)`.
- The block ends with an empty `[Answer]:` line.

Keep the question text and the suggested defaults as Step 4 describes.
