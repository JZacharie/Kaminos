# Brief template: `<app name>` (D-37)

A brief is the input of stage 1.1's UI build. The golden example is `addon/kit/examples/spudtrack/BRIEF.md` (about 6 KB, produced a polished prototype in about 10 minutes). Write at that depth: concrete nouns, numbers, names, statuses. Vague briefs give generic UIs. A brief the participant did not write is written from the idea by the 1.1 agent and saved as `<record>/ui/src/app-brief.md`.

Rules for whoever writes a brief (person or agent):
- 4-8 KB, English (UI text language = the participant's language if the request says so).
- Every section below present, in this order, with these exact `##` headings (checked by `ui-brief --check-brief`).
- Invent plausible domain detail instead of leaving blanks: a real-sounding company, real units, real statuses, real risks. Say "fictional".
- Say which figures appear in more than one place and must agree (a distance in a header and on a map, a total next to a table) and, if there is a map, the real place it is about (a fictional site on a real coast gets real coordinates nearby; use the kit basemap, never a drawn outline).
- Spell out the mock data: at least 18 records of the main entity (id, two or three attributes, status, one date), written as a compact table or list, with a believable spread of statuses (not all "OK") and edge cases (one very late, one just under a threshold).
- List the decisions that visibly change the UI (questions with 3-4 options and what changes on screen for each).
- Desktop first (1280-1440 px laptops); light and dark theme.

## Goal
One paragraph: what the app is for, who opens it first thing in the morning, what they want to know in 10 seconds.

## The app
Domain facts that make it real: the company (fictional), volumes, equipment, regulations, seasonality, 4-6 domain risks the UI must make visible (for example "humidity makes chips stale", "best-before date drives recalls").

## Users and roles
2-4 roles, what each one needs to see or do, which screens they live in.

## Screens
For EVERY screen: route (`#/dashboard`), purpose, the 3-7 elements on it (KPIs, tables with their columns, filters, charts, timelines, forms), the one primary action, empty and error states. 4-6 screens. The first screen is the home of the main role.

## Mock data
Entity fields, status vocabulary and meaning, units, and the 18+ sample records (see rules above). Sensor or time series: how many points, what range, where the anomalies are.

## Decisions that change the UI
14-18 candidate questions grouped by screen: question, 3-4 options, and what each option changes on screen (a number, a hidden or shown element, a badge, a column). These feed the round questions and the assumptions.

## Quality bar
"Looks like a real, polished SaaS product, specific to this domain." Light and dark theme, accessible (labels, focus, contrast AA), realistic labels and units, no lorem ipsum, no placeholder names, consistent spacing and type scale, charts as inline SVG with titles, tables sortable and filterable where the screen says so.

## Technical constraints
Single self-contained HTML file built with the add-on design kit, no network of any kind (no CDN, fonts, images from the web), works from `file://`, vanilla JavaScript, hash routes in English, anchored elements with stable `a-...` ids.

## Verification
What a reviewer checks in two minutes: each screen reachable, filters work, the delayed/critical records stand out, dark theme readable, no console errors.
