# Brief: VoltRoute, the charging planner of an electric delivery fleet

## Goal
Build the first clickable frontend of VoltRoute, the app a fleet team opens every afternoon to answer one question: will every van leave tomorrow morning with enough charge, at the lowest cost, without tripping the depot's power limit? It must look like a real, polished SaaS product. This brief holds the domain and the screens; the product decisions are asked afterwards by AI-DLC, as questions pinned on the UI.

## The app
Fictional **Brightway Delivery Ltd.** delivers groceries and parcels in Greater Manchester with **18 electric vans** from two depots:
- **Trafford Park**: 11 vans, 8 AC chargers of 22 kW (TP-01 to TP-08, TP-03 out of service), 2 DC chargers of 50 kW (TP-09, TP-10, emergencies only), grid limit **150 kW**, 60 kWp solar roof.
- **Salford Quays**: 7 vans, 6 AC chargers of 22 kW (SQ-01 to SQ-06), grid limit **100 kW**.
- Models: Ford **E-Transit** 68 kWh, Mercedes **eSprinter** 81 kWh, Renault **Kangoo** E-Tech 45 kWh. Every van takes at most **11 kW on AC** (its onboard charger), 50 kW on DC. Vans return 15:30 to 19:00 and leave 06:30 to 07:30; some have a midday second shift.
- Site base load (building, chillers): Trafford 80 kW from 16:00 to 19:00, 25 kW from 00:30 to 07:00, 40 kW otherwise; Salford 40, 12 and 20 kW.
- Tariff on weekdays: 00:30 to 07:30 off-peak **9.5 p/kWh**; 07:30 to 16:00 and 19:00 to 00:30 day **24 p**; 16:00 to 19:00 red band **38 p**; solar 0 p. Peak-demand charge **GBP 11.50 per kW** of the month's highest 30-minute demand at each depot. Losses are ignored: kWh are battery kWh.
- Risks the UI must show: range depends on payload and cold (plan 0.38 kWh/km including a 15 % reserve, +18 % below 5 C); batteries lose capacity (health %); charging in the red band costs money and raises the monthly peak; DC fast charging wears batteries; charger faults and late returns change the plan.

## Users and roles
- **Sam Whitaker, fleet manager** (daily, afternoon): approves tonight's plan; readiness, schedule, alerts.
- **Rita Moreno, Trafford Park supervisor**: plugs vans in, handles faults; schedule, vans.
- **Kofi Mensah, dispatcher** (early morning): swaps vans between routes; readiness, van detail.
- **Dana Price, finance**: monthly cost per depot and van; depot energy.

## Screens
1. **Readiness** `#/readiness`: one card per van by depot with SoC now, SoC at departure under the plan, departure time, status (Ready, Will be ready, At risk, Blocked); counters: ready, will be ready, at risk, blocked, kWh to add, cost of tonight.
   Layout: counters in one row of 6; then two depot columns (Trafford, Salford), van cards 2 per row inside each, each card at least 260 px.
2. **Charging schedule** `#/schedule`: 17:00 to 08:00 timeline, a row per charger, a block per session coloured by van, tariff bands shaded, depot limit line and planned load; depot switch; "Propose plan"; move a session and see cost and load change.
   Layout: full width; charger labels 80 px; the load chart under the timeline shares its time axis; plan totals in a strip above.
3. **Vans** `#/vans`: table with filters (depot, model, status), search, sortable columns.
4. **Van detail** `#/van/BW-10`: tonight's SoC curve, health trend, tomorrow's route and stops (an ordered list with km, no map), last 7 sessions, faults.
   Layout: SoC curve (8 of 12 columns) beside route and status (4); sessions table below.
5. **Depot energy** `#/energy`: 24 h load against the limit, month cost by band, highest 30-minute demand and its cost, solar used.
   Layout: load chart full width; below 3 cards: cost by band, peak demand, solar.
6. **Alerts** `#/alerts`: van will not make its route, charger fault, limit at risk, late return, battery warning; severity and suggested action.

## Mock data
"Now" is **Wednesday 4 November 2026, 17:30**; routes are tomorrow's. Columns: need = km x 0.38 kWh; in battery = nominal x health x SoC; to charge = need minus in battery, at least 0. Give each van a driver, a plate, 7 past sessions and a SoC curve. BW-11 is the Trafford spare.

| Van | Model, health | Depot | Now | SoC | Route, km, departs | Need / in battery / to charge |
|---|---|---|---|---|---|---|
| BW-01 | E-Transit 68 kWh, 96 % | Trafford | Charging, TP-01 | 34 % | Altrincham AM, 88 km, 06:30 | 33.4 / 22.2 / 11.2 kWh |
| BW-02 | E-Transit 68 kWh, 95 % | Trafford | Returning, back 18:10 | 22 % | Sale and Stretford, 96 km, 06:45 | 36.5 / 14.2 / 22.3 kWh |
| BW-03 | E-Transit 68 kWh, 91 % | Trafford | Ready | 88 % | Wilmslow, 112 km, 07:00 | 42.6 / 54.5 / 0 kWh |
| BW-04 | eSprinter 81 kWh, 97 % | Trafford | Parked | 41 % | Didsbury, 74 km, 06:30 | 28.1 / 32.2 / 0 kWh |
| BW-05 | eSprinter 81 kWh, 94 % | Trafford | On route, back 18:40 | 18 % | Cheadle Hulme, 102 km, 07:15 | 38.8 / 13.7 / 25.1 kWh |
| BW-06 | eSprinter 81 kWh, 89 % | Trafford | Fault, charger TP-03 | 29 % | Altrincham PM, 81 km, 11:30 | 30.8 / 20.9 / 9.9 kWh |
| BW-07 | Kangoo 45 kWh, 93 % | Trafford | Charging, TP-06 | 52 % | Urmston, 63 km, 07:00 | 23.9 / 21.8 / 2.1 kWh |
| BW-08 | Kangoo 45 kWh, 90 % | Trafford | Ready | 93 % | Eccles, 58 km, 07:30 | 22 / 37.7 / 0 kWh |
| BW-09 | Kangoo 45 kWh, 86 % | Trafford | Returning, back 18:00 | 15 % | Sale PM, 69 km, 12:00 | 26.2 / 5.8 / 20.4 kWh |
| BW-10 | E-Transit 68 kWh, 97 % | Trafford | On route, back 18:55 | 12 % | Knutsford, 121 km, 07:15 | 46 / 7.9 / 38.1 kWh |
| BW-11 | eSprinter 81 kWh, 98 % | Trafford | Spare, idle | 96 % | none, 0 km, - | 0 / 76.2 / 0 kWh |
| BW-12 | Kangoo 45 kWh, 95 % | Salford | Plugged in, SQ-01, idle | 47 % | Quays AM, 52 km, 06:30 | 19.8 / 20.1 / 0 kWh |
| BW-13 | Kangoo 45 kWh, 92 % | Salford | Ready | 90 % | Media City, 44 km, 07:00 | 16.7 / 37.3 / 0 kWh |
| BW-14 | E-Transit 68 kWh, 94 % | Salford | Returning, back 18:20 | 27 % | Prestwich, 92 km, 06:45 | 35 / 17.3 / 17.7 kWh |
| BW-15 | E-Transit 68 kWh, 88 % | Salford | Charging, SQ-03 | 38 % | Bury, 118 km, 07:00 | 44.8 / 22.7 / 22.1 kWh |
| BW-16 | eSprinter 81 kWh, 96 % | Salford | On route, back 18:50 | 20 % | Swinton, 67 km, 07:30 | 25.5 / 15.6 / 9.9 kWh |
| BW-17 | eSprinter 81 kWh, 92 % | Salford | Ready | 85 % | Rochdale, 131 km, 07:00 | 49.8 / 63.3 / 0 kWh |
| BW-18 | Kangoo 45 kWh, 84 % | Salford | Fault, battery cooling | 31 % | Quays PM, 60 km, 12:30 | 22.8 / 11.7 / 11.1 kWh |

Status rules: Ready = to charge 0 (BW-03, 04, 08, 11, 12, 13, 17); At risk = needs a person (BW-06 must be moved from TP-03 to TP-04) or must add more than half its usable battery before an 08:00 departure (BW-10, 38.1 of 66.0 kWh); Blocked = cannot charge (BW-18, cooling fault, no charging until the workshop check at 09:00; suggested action: swap Quays PM to BW-11, 76.2 kWh for a 22.8 kWh need); Will be ready = the rest (BW-01, 02, 05, 07, 09, 14, 15, 16).

Proposed plan (goal lowest cost): every session at 11 kW from 00:30, all off-peak. Trafford: BW-01 TP-01 to 01:31 (11.2 kWh), BW-02 TP-02 to 02:32 (22.3), BW-06 TP-04 to 01:24 (9.9), BW-05 TP-05 to 02:47 (25.1), BW-07 TP-06 to 00:41 (2.1), BW-09 TP-07 to 02:21 (20.4), BW-10 TP-08 to 03:58 (38.1). Salford: BW-14 SQ-02 to 02:07 (17.7), BW-15 SQ-03 to 02:31 (22.1), BW-16 SQ-04 to 01:24 (9.9). Charging now (BW-01, BW-07, BW-15) pauses until 00:30; BW-06 moves to TP-04; BW-18 and the ready vans get no session.
Numbers that must agree: counters Ready 7, Will be ready 8, At risk 2, Blocked 1 (18 vans); kWh to add 189.9 = 178.8 planned + 11.1 blocked; tonight's cost **GBP 16.99** (178.8 kWh x 9.5 p); planned load peaks at Trafford 102 kW from 00:30 to 00:41 (25 + 7 x 11), 30-minute demand 95.2 kW, and at Salford 45 kW (12 + 3 x 11); both are tonight's highest 30-minute demand and stay under this month's peaks (110 and 60 kW), so no peak-demand charge is added. "Charge on arrival" (the same 10 vans and 178.8 kWh, each at 11 kW from now or from its return, BW-06 on TP-04) costs **GBP 53.22** and peaks at 118.1 kW at Trafford (18:00) and 65.7 kW at Salford (18:30), adding GBP 93.15 and GBP 65.55 of peak-demand charge.
Alerts, 6 open: AL-01 High BW-10 needs 38.1 kWh, ready 03:58, 3 h 17 before departure (17:20); AL-02 High BW-18 cooling fault, swap Quays PM to BW-11 (16:05); AL-03 Medium TP-03 out of service, move BW-06 to TP-04 (Tue 21:40); AL-04 Medium BW-10 back 18:55, late return (17:25); AL-05 Low BW-18 health 84 %, under the 85 % warning (Tue 08:00); AL-06 Low Trafford peak 110 kW on Monday 17:30 (Tue 07:00).
Month so far (1 to 3 November): Trafford off-peak 1,420 kWh GBP 134.90, day 260 kWh GBP 62.40, red 95 kWh GBP 36.10, solar 140 kWh; energy GBP 233.40; highest 30-minute demand 110 kW (Monday 17:30) = GBP 1,265.00. Salford off-peak 610 kWh GBP 57.95, day 140 kWh GBP 33.60, red 60 kWh GBP 22.80; energy GBP 114.35; peak 60 kW = GBP 690.00.

## Decisions that change the UI
Candidate questions, each with what the options change on screen:
- Plan goal: lowest cost, lowest peak, earliest ready, balanced. Changes the plan card and the proposed schedule.
- Reserve: 10 %, 15 %, 25 %. Recomputes "need" and which vans are At risk.
- Energy per km: fixed, by payload, by payload and weather. Adds a payload field and a weather badge.
- DC fast charging in the plan: never, emergencies only, allowed. Marks DC sessions and shows a wear warning.
- Who edits the plan: fleet manager only, supervisors too, dispatcher too. Shows or hides the move and approve buttons.
- Spare swap: manual, suggested, automatic. Adds a "Swap with BW-11" action.
- Peak-demand charge: ignored, shown, optimised. Adds a cost line and a peak marker.
- Solar: ignored, shown, scheduled. Adds solar shading on the timeline and a solar kWh card.
- Alert channel: email, SMS, depot tablet. Changes the channel icons.
- Driver view: none, own van only. Adds a Driver tab.
- Data source: telematics feed or typed in. Adds a freshness badge ("2 min", "6 h").
- Late returns: ignore, replan, alert only. Adds a late-return banner and a replan button.
- Battery health: shown, trend, limits the plan. Adds a health column and a trend sparkline.
- Currency and units: pounds, euros. Changes every cost.

## Quality bar
Looks like a real, polished SaaS product specific to this domain, in light and dark theme. Use the data above, no lorem ipsum. English text, kWh and pounds, 24-hour times. Keyboard accessible, laptop widths (1280 px and up).
At 1280 to 1440 px: nav on one line; no word broken inside (never `break-all` or `overflow-wrap: anywhere`); a card under 480 px wide has at most 3 columns, else it stacks; ids, times and numbers never wrap; no horizontal scroll.

## Look and feel
- Tone: calm depot at night. Lots of air, big charge numbers, thin lines, one accent colour.
- Protagonists: Readiness, the vans at risk. Schedule, the timeline. Vans, the table. Detail, tonight's charge curve. Energy, load against the limit. Alerts, open ones first.
- Charts: kit charts; times on a shared 17:00 to 08:00 axis; tariff bands as soft shading (red band 16:00 to 19:00, off-peak 00:30 to 07:30); the limit is a dashed line labelled "150 kW" or "100 kW".
- Map: none in v1 (no geography on any screen).
- Never: identical card grids, hand-drawn maps, placeholder data, purple gradients.
- Reference: a modern energy-management console: dark-capable, a single green accent, big numbers with small units, timelines like a calendar day view.

## Technical constraints
One self-contained page built with the design kit, hash routes, no network of any kind (no CDN, web fonts or web images), anchored elements with stable `a-...` ids. Every control a user would try works; a moved session changes the totals.

## Verification
Each screen is reachable; BW-10, BW-06 and BW-18 stand out; Salford's 100 kW limit is visible; moving a session changes cost and load; dark theme readable; no console errors. Consistency: the counters read 7, 8, 2, 1; kWh to add 189.9; tonight GBP 16.99; every session block starts and ends at the times above; the Trafford load reaches 102 kW at 00:30 and never crosses 150 kW; month cost and peak figures equal the numbers above; at 1280 px no word is broken and the nav is one line.
