# Brief: Stagehand, artist logistics and stage operations with an incident-resolving AI agent

## Goal
Build the first clickable frontend of Stagehand, the cockpit a festival's production team keeps open on show days: where every artist is, what each stage needs, who works where, and an AI agent that turns incidents (late flight, missing mixer, storm) into options with their impact, so a person can approve one in a minute. It must look like a real, polished SaaS product. This brief holds the domain and screens; the decisions are asked afterwards by AI-DLC, as questions pinned on the UI.

## The app
Fictional **Tidewave Festival** in Saltmouth, a fictional beach town placed at the real position of Zandvoort on the Dutch North Sea coast: 2 days, 3 stages, 20 artists. **Stage A "Lighthouse"** (main, curfew 00:00), **Stage B "The Dock"** (club tent, curfew 02:00), **Stage C "Sandbar"** (beach, live acts, noise limit 23:30). The airport is the real **Amsterdam Schiphol (AMS)**, 18 km away; Hotel Marée is 6 km away; shuttles leave AMS at :00 and :30 for the hotel and the main gate; Saltmouth Central station is 600 m from the main gate. All times are festival local time (CEST).
- Risks the UI must show: curfews and noise limits; changeovers (minimum 20 minutes); artists on site 30 minutes before their set; rider compliance (mixer, players, monitors, power); travel delays; crew fatigue (max 10 h shift, 11 h rest); wind (beach stage holds at gusts of 55 km/h or more) and lightning.

## Users and roles
- **Lena Okafor, artist liaison / advancing manager**: artist cards, travel, hospitality.
- **Marcus Vale, production manager**: overview, incidents, approvals.
- **Stage managers** (Ines, Tobias, Wren) and **crew leads**: their stage, riders, crew.
- **Dev Nair, transport coordinator**: pickups, shuttles, flights.

## Screens
1. **Festival overview** `#/overview`: kit basemap with flight arcs, a site plan in inline SVG, "Stages right now", weather strip, today's arrivals.
   Layout: map card (7 of 12 columns, about square) beside "Stages right now" (5); then site plan (7) beside arrivals (5); weather strip full width. "Stages right now" is one row per stage with 3 columns (stage, now, next), never more.
2. **Lineup** `#/lineup`: running order per stage and day as a timeline with set slots, changeovers and curfew lines; conflicts marked.
   Layout: one lane per stage, 14:00 to 02:00.
3. **Artist card** `#/artist/AR-07`: arrival transport (flight, train or car, with status), pickup, hotel, set time, hospitality, guest list.
4. **Tech rider** `#/rider/AR-07`: DJ set or live act, mixer, players or turntables, monitors, inputs, power, backline delivered or missing, check against the stage's gear.
5. **Crew planner** `#/crew`: technician by stage and hour, shifts, skills (FOH engineer, monitor engineer, backline tech, lighting, VJ), conflicts and fatigue marked.
   Layout: one row per technician (name column 180 px), hours 10:00 to 03:00 as columns.
6. **Incidents** `#/incidents`: the agent proposes ranked options with their impact on running order, crew and curfew; the person approves one; a log.
   Layout: incident list (4) beside the selected incident with its options (8).

## Mock data
"Now" is **Saturday 19 June 2027, 14:20** (day 2). Gear: Stage A has 4x CDJ-3000 and a DJM-V10; Stage B a DJM-900NXS2, 3x CDJ-3000 and 2 Technics SL-1210; Stage C live monitors only. Give each artist a room, a pickup and a guest list.

| ID | Artist | Act | Stage, slot | Travel, status | Rider key | State |
|---|---|---|---|---|---|---|
| AR-01 | Nova Kest | DJ set | A, Fri 21:00 | car, left Fri 23:50 | 4x CDJ-3000, DJM-V10 | Played |
| AR-02 | Juno Harker | DJ set | A, Fri 22:30 | train, left Sat 09:40 | 4x CDJ-3000, DJM-V10 | Played |
| AR-03 | Mirelle | DJ set | B, Fri 23:00 | flight GW 88, left Sat 11:05 | Xone:96, 2x CDJ-3000 | Played |
| AR-04 | DJ Halcyon | Live | C, Fri 19:30 | van, left Sat 10:00 | laptop rig, 6 in | Played |
| AR-05 | Aria Voss | DJ set | A, Sat 16:00 | at hotel since Fri | 4x CDJ-3000, DJM-V10 | Soundcheck 14:40 |
| AR-06 | Kito & Oba | Live duo | A, Sat 17:30 | car, arrives 15:10 | 2 synths, drum machine, 10 inputs | On time |
| AR-07 | Vela Quint | DJ set | A, Sat 19:30 | flight GW 412, lands 17:55, was 14:15 | 4x CDJ-3000, DJM-V10 | Delayed 3 h 40 |
| AR-08 | Orbit Kane | DJ set | A, Sat 21:15 | train TR 905, arrives 16:42 | 3x CDJ-3000, DJM-V10 | On time |
| AR-09 | Lumen Fray | Live headliner | A, Sat 23:00 | private jet, lands 18:30 | modular rig, 24 inputs, 4 monitors | On time |
| AR-10 | Bastian Holt | DJ set | B, Sat 14:00 | at hotel since Fri | Xone:92, 2x CDJ-3000 | On stage |
| AR-11 | Tamsin Rook | DJ set | B, Sat 15:30 | shuttle pickup 14:45 | 2x SL-1210, DJM-900NXS2 | On time |
| AR-12 | Ione Marsh | DJ set | B, Sat 17:30 | flight GW 301, lands 15:50 | 3x CDJ-3000, DJM-900NXS2 | On time |
| AR-13 | Cass Delaney | DJ set | B, Sat 19:30 | car, arrives 17:00 | Xone:96, 2x SL-1210 | On time |
| AR-14 | Rhea Solen | DJ set | B, Sat 22:00 | flight GW 520, lands 19:40 | 4x CDJ-3000, DJM-V10 | Rider gap |
| AR-15 | Dax Orion | DJ set | B, Sat 23:30 | flight GW 520, lands 19:40 | 3x CDJ-3000, DJM-V10 | Rider gap |
| AR-16 | Okra Beat | Live band (5) | C, Sat 15:00 | train TR 771 cancelled | backline, 12 inputs, 5 monitors | At risk |
| AR-17 | Neon Heron | Live | C, Sat 17:00 | shuttle, arrived 13:30 | 3 synths, 8 inputs | On time |
| AR-18 | Mara Teng | DJ set | C, Sat 18:30 | at hotel since Fri | 2x CDJ-3000, mixer | On time |
| AR-19 | Pyre Vale | Live band (4) | C, Sat 20:15 | van, arrives 17:30 | backline, 10 inputs, 4 monitors | Singer ill |
| AR-20 | Sable Ghost | Live closing | C, Sat 21:45 | car, arrives 18:15 | 2 synths, 8 inputs | Curfew 23:30 |

Set ends: Fri A 22:10, 00:00; B 02:00; C 21:00. Sat A 17:10, 19:10, 20:55, 22:40, 00:00; B 15:10, 17:10, 19:10, 21:40, 23:10, 01:40; C 16:40, 18:10, 19:55, 21:25, 23:30 (zero margin to the noise limit, marked). Every changeover is 20 minutes.

Flights (block = km / 780 km/h + 30 min, to 5 min; landing to kerb 30 min; AMS to gate by shuttle 25 min, car 22; AMS to hotel 20; hotel to gate 12):

| Flight | Artists | Route, great-circle km | Block | Scheduled | Now |
|---|---|---|---|---|---|
| GW 412 | AR-07 | LIS to AMS, 1,846 | 2 h 50 | 11:25 to 14:15 | 15:05 to 17:55, delayed 3 h 40 |
| GW 301 | AR-12 | BCN to AMS, 1,241 | 2 h 05 | 13:45 to 15:50 | on time |
| GW 520 | AR-14, AR-15 | ATH to AMS, 2,182 | 3 h 20 | 16:20 to 19:40 | on time |
| Private jet | AR-09 | CPH to AMS, 633 | 1 h 20 | 17:10 to 18:30 | on time |
| GW 88 | AR-03 | AMS to MAN, 487 | 1 h 05 | 11:05 to 12:10 | departed |

Crew (14; skill, stage, shift): Pia Lindgren monitor A 12-22, also booked on C at 15:30 (conflict); Jonas Brandt FOH A 12-22 (rest 8 h 30, fatigue); Mae Okoro lighting A 14:30-00:30; Ravi Desai backline A 08-19 (11 h, fatigue); Elif Kaya monitor B 13-23; Lucia Ferrer backline B 13-23; Noor Bakker lighting B 16-02; Tom Haverkamp FOH B 16:30-02:30; Sven Moller VJ B 17-02:30; Kai Jansen FOH C 13:30-23:30; Bea Novak backline C 13:30-23:30; Omar Haddad lighting C 14-23:30; Fenna de Vries backline, float, 10-20; Luca Moretti monitor, float, 14-00.

Incidents now: **INC-1** AR-07 flight GW 412 lands 17:55, set 19:30. Ranked: car from the kerb 18:25, on site 18:47 (EUR 95); swap with AR-08 (AR-08 19:30-20:55, AR-07 21:15-22:40); shuttle 18:30, on site 18:55; extend AR-06 by 30 minutes (Stage A ends 00:30, breaks the curfew). **INC-2** the DJM-V10 for AR-14 and AR-15 is missing at Stage B: rent one 45 minutes away (EUR 180); move Stage A's after 22:40 (AR-09 is live; covers AR-15 only); accept the DJM-900NXS2. **INC-3** gusts of 62 km/h forecast 17:00 to 19:00 at Stage C: hold, AR-17 cancelled, AR-18 plays 19:00-19:55. **INC-4** AR-19 singer ill. **INC-5** Noor Bakker, lighting at Stage B, called in sick for 16:00. **INC-6** AR-16 train cancelled, five people. **INC-7** a shuttle bus broke down at 13:50, shuttles every 45 minutes until 16:00. INC-1 to INC-3 are High, the rest Medium.

Numbers that must agree: header "18 km from Amsterdam Schiphol (AMS)"; arc labels use the km above; arrivals: 4 flights to AMS (GW 412 delayed; GW 520 is one row, two artists), train TR 905, 4 by road (AR-06, 13, 19, 20), TR 771 cancelled; "Stages right now": A soundcheck AR-05 (next 16:00), B AR-10 on stage to 15:10 (next AR-11), C empty (next AR-16 15:00, at risk); 7 open incidents; fatigue on Jonas Brandt and Ravi Desai, conflict on Pia Lindgren.

## Decisions that change the UI
Candidate questions, each with what the options change on screen:
- Agent autonomy: suggest only, prepare, act within limits. Changes the incident buttons and the approval step.
- Who approves: production manager only, plus the stage manager, plus the liaison for travel. Adds an approval chip and a lock.
- Options per incident: best one, top three, all. Changes the option list.
- Impact shown: running order, plus crew, plus curfew and cost. Adds impact panels.
- Curfew: hard stop, 10 minutes grace, per-stage rule. Recomputes the curfew warnings.
- Slot swaps: never, with consent of both artists, free. Adds a swap action and a consent badge.
- Changeover minimum: 15, 20, 30 minutes. Recomputes the conflict marks.
- Rider compliance: warn, block the slot, suggest rentals. Marks missing items and adds a rental tip.
- Crew fatigue: warn at 10 h, block at 12 h, off. Marks tired technicians.
- Travel tracking: manual, flight feed, plus trains and shuttles. Shows a freshness badge.
- Notifications: SMS, WhatsApp, push, call tree. Changes the incident channel icons.
- Weather: manual, forecast alerts, automatic holds. Adds a weather strip.
- Artist view: none, read-only link, mobile app. Adds a portal tab.
- Agent audit: none, log, log with undo. Adds a log and an undo button.

## Quality bar
Looks like a real, polished SaaS product, specific to this domain, in light and dark theme, with stage icons and avatars drawn inline. Use the data above, no lorem ipsum, fictional artists only. English, 24-hour times. Keyboard accessible, laptop widths (1280 px and up).
At 1280 to 1440 px: nav on one line; no word broken inside (never `break-all` or `overflow-wrap: anywhere`); a card under 480 px wide has at most 3 columns, else it stacks; ids, times and numbers never wrap; no horizontal scroll.

## Look and feel
- Tone: calm show-day cockpit. Lots of air, big times and statuses, thin lines, one accent colour.
- Protagonists: Overview, the map. Lineup, the timeline. Artist, the arrival status. Rider, missing items. Crew, fatigue marks. Incidents, the ranked options.
- Map: kit basemap (Europe), real coordinates: festival 52.373, 4.526; airports AMS, LIS, BCN, ATH, CPH, MAN from `BASEMAP_AIRPORTS`. Arcs (`basemapArc`) end at AMS; at this scale the festival and AMS share one marker labelled "Tidewave, 18 km from AMS". Markers are DOM elements with `a-...` ids.
- Site plan: schematic inline SVG, not a map: gate and shuttle stop, stages, artist village 150 m behind Stage A, station. Walking: gate to A 350 m, to B 500 m, to C 800 m; A to B 300 m, A to C 450 m, B to C 600 m; station to gate 600 m.
- Weather strip, Stage C gusts in km/h per hour from 14:00 to 23:00: 35, 40, 48, 62, 62, 52, 40, 32, 28, 25.
- Never: identical card grids, hand-drawn maps or coastlines, placeholder data, purple gradients.
- Reference: a live-operations console: one teal accent, statuses as small pills, timelines like a broadcast running order.

## Technical constraints
One self-contained page built with the design kit, hash routes, no network of any kind (no CDN, web fonts, web images or map tiles), anchored elements with stable `a-...` ids. Every control works: approving an incident option updates the lineup and the crew planner.

## Verification
Each screen is reachable; INC-1 to INC-3 stand out; approving an option changes the running order and the log; conflicts and curfews marked; no console errors. Consistency: every "Numbers that must agree" item holds; set times equal the lists above; approving the INC-1 swap shows AR-08 at 19:30 and AR-07 at 21:15; at 1280 px no word is broken and the nav is one line.
