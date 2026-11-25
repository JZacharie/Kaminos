---
target: build-and-test
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
  requires_stage:
    - ui-freeze
fragments:
  - anchor: before-step:10
    order: 100
  - anchor: before-step:9
    order: 100
  - anchor: before-step:10
    order: 110
  - anchor: before-step:9
    order: 110
---

## fragment: before-step:10

### Step 9b (ui): Run the checks that need no deployment

Do this after Step 9. Skipping Performance Validation never skips these checks. A check
needs a deployment only when it cannot run against the app started on this machine.

1. Start the built app locally (the command from `build-instructions.md`). Then run:
   the layout at 1280 and 1440 px on the live pages with the real data, a short load
   test with the request counts and data sizes the targets name (or the largest the
   machine runs, and say which), and an automated accessibility check (axe or the
   equivalent, WCAG AA) on every page. Stop the app afterwards.
   Loading the app in a real browser here is a second look, not the first: Code Generation
   already loaded the entry page of each unit before its approval. A page that is blank or
   has a console error now means a unit missed it; name that unit in the summary.
2. Write each result with its number in `test-results.md`.
3. Under `## NOT VERIFIED` in `test-results.md` and in the Build and Test Summary, list
   every target that no check covered, with one reason each (for example "needs a
   deployed environment"). Never mark a target met without a run that measured it.

## fragment: before-step:9

### Step 8b (ui): An instruction command that cannot run

If a build or test command from the approved instruction files cannot run in Step 9,
run a form that does and show both lines in the stage output:
`command changed: <old command> -> <new command>`. Update the instruction file and add
the same line under `## Changed after approval`. Report the test counts that your own
runs printed, and the sum of the per-unit runs next to the root run when they differ.

## fragment: before-step:10

### Step 9c (ui): Write the README of the built app

Do this after Step 9b. The `README.md` at the workspace root must describe the app that
was built. If it is still the workshop template or has no run instructions, replace
it; if the person wrote it for this app, keep their text and add what is missing.

1. Keep it short: what the app is, how to install and start it (the commands that you
   ran in Step 9), the ports, how to run the tests, and which data is demo data.
2. Use only commands and ports you ran. Do not link to files that do not exist.
3. Mention it in the Build and Test Summary.

## fragment: before-step:9

### Step 8c (ui): Prove the backend runs the approved data

Before the tests of Step 9, run `.aidlc-ui/bin/ui-seed-check "<record>/ui/seed.json" <backend.json>` on a JSON dump of
the backend's initial data (or the responses of its list endpoints). Put its output in the build and test summary.
A difference that `<record>/ui/mock-only.md` does not explain is a test failure.
