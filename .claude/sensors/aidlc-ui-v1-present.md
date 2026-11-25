---
id: ui-v1-present
kind: deterministic
command: bun .claude/tools/aidlc-sensor-ui-v1-present.ts
default_severity: advisory
fire_on: gate
description: Reports when the UI-first stage 1.1 did not deliver version 1 of the interface (ui-prototype-v1.md, ui/prototype.html, ui/ui-map.json, the aidlc-effects block)
category: document-shape
matches: "**/{aidlc-docs,intents}/**"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings: string[]
  findings_count: integer
timeout_seconds: 30
---

# ui-v1-present sensor (ui plugin)

ADVISORY, fires at the approval gate of Intent Capture (1.1). For a record of scope
`ui-first` or `ui-workshop` it reports, in the detail file under
`<record>/.aidlc-engine/sensors/intent-capture/`, each of:

- `ideation/intent-capture/ui-prototype-v1.md` is missing;
- `ui/prototype.html` is missing (records of schema 1.0/1.1 may keep it in `ideation/rough-mockups/`);
- `ui/ui-map.json` is missing;
- `ui/prototype.html` has no `aidlc-effects` block.

Each finding names the file and the fix: run the 1.1 build step; install the add-on kit into
`.aidlc-ui/` if it is missing. Records of any other scope pass untouched.

The engine fires a gate sensor once per existing deliverable; only one fire reports (the first `.md`
of the stage dir in sorted order that is not a questions file or `memory.md`), so one gate shows
one set of findings.

## Advisory note

The engine does not enforce a missing 1.1 deliverable (it accepts a gate when ANY declared
artifact exists), and a `SENSOR_FAILED` of an advisory sensor is reported, not enforced. The
fragments of the `ui` plugin tell the agent to build version 1; this sensor tells the person
when it did not.
