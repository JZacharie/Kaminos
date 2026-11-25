---
target: approval-handoff
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
fragments:
  - anchor: after-step:2
    order: 130
---

## fragment: after-step:2

### Step 2a (ui): Read the answers from the file

When the person answers in Canvas or by editing the file, they say "done" (or "ready")
in the chat. After that, read `<record>/ideation/approval-handoff/approval-handoff-questions.md`
with the Read tool before you use any answer. A file-change hint, a notification or
your memory of what Canvas wrote is not a read.

The question about the rough mockups is about the current interface: name
`<record>/ui/prototype.html` and its live version in its context line, so the person
knows what they approve. Take the number from the file, not from memory or an earlier
stage: Read `<record>/ui/ui-map.json` right when you write that question, and use its
`uiVersion` as the number (for example "version 10" when `uiVersion` is 10). Before you
present the questions, Read `ui-map.json` once more; if `uiVersion` changed, correct the
number in the question text. Never ask in the terminal what the file already answers.
