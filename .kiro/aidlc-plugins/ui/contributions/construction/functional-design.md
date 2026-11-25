---
target: functional-design
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
  requires_stage:
    - ui-freeze
fragments:
  - anchor: before-step:1
    order: 100
---

## fragment: before-step:1

### Step 0 (ui): Check the UI freeze first

Do this in every execution mode, including ARTIFACT-ONLY mode that skips Steps 1-3,
before any other step.

1. If `.aidlc-ui/bin/validate` exists, run
   `.aidlc-ui/bin/validate "<record>" --check-freeze` with the engine-resolved intent
   record dir. If it fails (for example `FREEZE-DIGEST-MISMATCH`), STOP: tell the person
   that `prototype.html` or `ui-map.json` changed after the UI freeze was approved, show
   the output, and ask them to redo the ui-freeze stage. Do not continue.
2. If it does not exist, continue and say so in the memory diary.
3. Treat `<record>/ui/prototype.html` and `<record>/ui/ui-map.json` as required
   reference inputs for every UI part of this design: screens, elements (by anchor id)
   and their `frIds`. A record made by an older add-on keeps them in
   `<record>/ideation/rough-mockups/`. Never edit them in Construction.
