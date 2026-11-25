# Brief: SpudTrack, multimodal shipment tracking for a potato-chip maker

## Goal
Build the first clickable frontend of SpudTrack, the app a logistics team at a food maker opens first thing in the morning to see in 10 seconds what is late, what is at risk and whom to call. It must look like a real, polished SaaS product. This brief holds the domain and the screens; the product decisions are asked afterwards by AI-DLC, as questions pinned on the UI.

## The app
Fictional **Golden Spud Foods Ltd.** makes potato chips in Zaragoza (Spain), about 40 pallets a day. Products: **Classic 150g**, **Ham 45g**, **Paprika 150g**, **Sour Cream & Onion 150g**, **Family Box 12x45g**. Every pallet has a lot (`L-26-0871`) and a best-before date (9 months after production; retailers refuse less than 4 months left).
- Outbound: factory to EU distribution centres by truck; to UK, US and Middle East by container ship (dry, some reefer); rarely by air for promotion samples.
- Inbound: potatoes from farms in France and the Netherlands, sunflower oil from Rotterdam, packaging film from Italy.
- Risks the UI must show: crushed bags (max 2 pallets high); humidity above 65 % RH for 6 h makes chips stale; heat above 28 C for 4 h makes oil rancid; short best-before; lot traceability for a recall in minutes; port congestion and UK customs holds.
- Documents: CMR (truck), Bill of Lading (ship), Air Waybill (air), invoice.

## Users and roles
- **Marta Ruiz, logistics coordinator** (daily): dashboard, shipments, alerts.
- **Tomás Vidal, head of supply chain** (weekly): on-time %, delay causes, dashboard.
- **Elena Park, quality manager**: sensor alarms, lot search, shipment detail.
- Retail account managers and carrier dispatchers may come later.

## Screens
1. **Dashboard** `#/dashboard`: KPI cards (in transit, delayed, open alerts, on-time % this week), on-time % by day (14 days), delays by cause, alert feed, list "Needs a call today". Action: open a shipment.
   Layout: 4 KPI cards in one row; then chart (8 of 12 columns) beside "Needs a call today" (4); then causes and alert feed side by side.
2. **Map** `#/map`: kit basemap with an arc route and a marker per shipment (truck, ship, plane), legend, mode filter, freshness of the last position.
   Layout: square map card (640 px or wider) beside the list of shipments it shows.
3. **Shipments** `#/shipments`: table with filters (mode, status, direction), search, sortable columns, status badge.
   Layout: full-width table, one line per row; long route and cargo truncate with a tooltip.
4. **Shipment detail** `#/shipment/SP-2405`: leg timeline (carrier, planned, actual), cargo and lot panel, temperature and humidity chart with the allowed band, documents, events.
   Layout: leg timeline full width; chart (8) beside cargo and documents (4); events below.
5. **Alerts** `#/alerts`: severity, shipment, cause, time, open and closed.

## Mock data
"Now" is **Wednesday 4 November 2026, 10:30**. Each shipment has the fields below plus legs (carrier, planned, actual), a position, a 24 h sensor series, documents and events; each alert has id, severity, shipment, cause, time, state. Status: On time, Delayed, At port, In customs, Delivered. Sensors: hourly readings of 17 to 26 C and 45 to 71 % RH for finished goods, 9 C and 88 % RH for potatoes; the chart band is the limit (28 C, 65 % RH), and above it for 4 h (heat) or 6 h (humidity) the cargo spoils. A route lists every stop; add none.

| ID | Mode | Route | Carrier | Cargo | Lot / best-before | ETA | Status |
|---|---|---|---|---|---|---|---|
| SP-2401 | Truck | Zaragoza, Madrid DC | Transportes Ebro | 26 Classic 150g | L-26-0871 / 2027-07-30 | Today 14:00 | On time |
| SP-2402 | Truck | Zaragoza, Barcelona DC | Transportes Ebro | 24 Classic, 2 Ham 45g | L-26-0872 / 2027-07-30 | Today 12:45 | On time |
| SP-2403 | Truck | Zaragoza, Lyon DC | Gefco Iberia | 22 Paprika 150g | L-26-0866 / 2027-07-22 | Tomorrow 09:00 | Delayed (border queue 3 h, Le Perthus) |
| SP-2404 | Truck | Zaragoza, Lisbon DC | Rodoviária Tejo | 20 Sour Cream & Onion | L-26-0868 / 2027-07-24 | Today 21:00 | On time |
| SP-2405 | Truck, ship, truck | Zaragoza, Valencia, Felixstowe, Daventry DC | Maersk / DFDS | 20 Classic in 40 ft | L-26-0859 / 2027-07-15 | 12 Nov | At port (Valencia), waiting for berth (66 % RH) |
| SP-2406 | Truck, ship | Zaragoza, Valencia, Jebel Ali | MSC | 22 Ham in 40 ft reefer | L-26-0861 / 2027-07-16 | 20 Nov | On time (day 3 of 19 at sea) |
| SP-2407 | Truck, ship | Zaragoza, Barcelona, New York | Hapag-Lloyd | 20 Family Box in 40 ft | L-26-0855 / 2027-07-10 | 21 Nov | Delayed 4 days (missed transhipment at Algeciras, 71 % RH) |
| SP-2408 | Air | Zaragoza, Madrid airport, Dubai | Emirates SkyCargo | 3 Ham (launch samples) | L-26-0875 / 2027-08-02 | Today 23:40 | On time |
| SP-2409 | Truck | Zaragoza, Milan DC | Gefco Iberia | 24 Classic 150g | L-26-0870 / 2027-07-29 | Today 18:00 | Delayed 2 h (driver rest) |
| SP-2410 | Truck, ship, truck | Zaragoza, Valencia, Southampton, Manchester | CMA CGM | 22 Paprika in 40 ft | L-26-0850 / 2027-07-05 | 9 Nov | In customs (declaration query) |
| SP-2411 | Truck | Zaragoza, Paris DC | Gefco Iberia | 26 Classic 150g | L-26-0864 / 2027-07-20 | Yesterday 15:20 | Delivered |
| SP-2412 | Truck | Zaragoza, Seville DC | Transportes Ebro | 18 Family Box | L-26-0865 / 2027-07-21 | Yesterday 11:05 | Delivered |
| SP-2413 | Truck, inbound | Pas-de-Calais, factory | Transports Delcourt | 24 t potatoes (Agria) | H-26-310 | Today 13:00 | On time |
| SP-2414 | Truck, inbound | Flevoland, factory | Van der Meer | 25 t potatoes (Lady Rosetta) | H-26-318 | Tomorrow 06:00 | Delayed 7 h (farmers' blockade at Biriatou); stops the line |
| SP-2415 | Truck, inbound | Pas-de-Calais, factory | Transports Delcourt | 24 t potatoes (Agria) | H-26-311 | Friday 07:00 | On time |
| SP-2416 | Tanker, inbound | Rotterdam, factory | Vopak Road | 22 t sunflower oil | O-26-77 | 6 Nov | On time |
| SP-2417 | Truck, inbound | Mantova, factory | Trasporti Gonzaga | 6 pallets packaging film | F-26-402 | Today 15:30 | In customs (seal check, Le Perthus); stops the line |
| SP-2418 | Truck | Zaragoza, Bilbao DC | Rodoviária Tejo | 20 Ham 45g | L-26-0874 / 2027-08-01 | Today 20:00 | On time (24.6 C) |

Position (share of the current leg): SP-2401 70 %, SP-2402 40 %, SP-2404 45 %, SP-2408 60 % (to Madrid airport), SP-2409 85 %, SP-2413 70 %, SP-2416 30 %, SP-2406 16 % (sea); at Le Perthus SP-2403, SP-2417; Biriatou SP-2414; Valencia SP-2405; Algeciras SP-2407; Southampton SP-2410; loading SP-2415, SP-2418; delivered at their DC. Last fix: truck 3 min, ship 45 min, air 12 min.

Alerts, 7 open (3 High, 3 Medium, 1 Low) and 2 closed: AL-01 High SP-2414 line stops tomorrow 06:00 without potatoes (09:55); AL-02 High SP-2417 no film after Friday, line stops (10:10); AL-03 High SP-2407 71 % RH for 7 h (08:40); AL-04 Medium SP-2405 66 % RH for 5 h (10:05); AL-05 Medium SP-2403 border queue 3 h (07:20); AL-06 Medium SP-2410 customs query (09:10); AL-07 Low SP-2409 driver rest, 2 h late (10:15); closed: AL-08 Medium SP-2411 27.4 C for 1 h (yesterday 14:30), AL-09 Low SP-2412 pallet scan missing (yesterday 09:00).

Numbers that must agree: In transit = 16 (all but Delivered); Delayed = 4 (SP-2403, SP-2407, SP-2409, SP-2414); On time 9, At port 1, In customs 2, Delivered 2; Open alerts = 7; "Needs a call today" = SP-2414, SP-2417, SP-2407, SP-2405, SP-2403, SP-2410 (open High and Medium, in that order). On-time % by day, 22 Oct to 4 Nov: 94, 92, 95, 91, 88, 90, 93, 89, 86, 92, 90, 87, 84, 88; the KPI is the mean of the last 7 = **88 %**. Delays by cause, last 14 days (23): border queue 6, port congestion 5, customs 4, driver rest 3, strike or blockade 3, missed transhipment 2.

## Decisions that change the UI
Candidate questions, each with what the options change on screen:
- Unit tracked: container, pallet, box, lot. Changes the table column and the detail panel.
- Who uses it: logistics only, plus retail customers, plus carriers. Adds a Customer portal tab and a role switcher.
- What counts as delayed: over 2 h, 12 h, 24 h, customer SLA. Recomputes the delayed KPI and the row badges.
- Source of ship positions: AIS, carrier API, manual. Changes the map badge and the freshness ("3 min" or "6 h").
- Monitor temperature and humidity: no, temperature only, both. Shows or hides the sensor chart and the humidity alerts.
- Lot traceability for recalls: no, lot field, lot search. Adds a lot search box.
- Alert channel: email, SMS, Teams. Changes the channel icons in the alert feed.
- Air freight in scope: yes or no. Shows or removes plane markers and the air filter.
- Customs documents: no, status only, document upload. Changes the documents panel.
- Inbound materials in scope: no, potatoes only, all. Shows or hides the Inbound filter and the line-stop warning.
- CO2 per shipment: no, per shipment, per customer. Adds a CO2 column and a KPI card.
- ETA prediction: carrier ETA only, rule-based, ML. Changes the ETA column and a confidence badge.
- Language: English only, English and Spanish. Adds a language switch.
- ERP link: none, SAP read-only, SAP two-way. Adds an ERP status badge and a sync panel.

## Quality bar
Looks like a real, polished SaaS product specific to this domain, in light and dark theme. Use the data above, no lorem ipsum. English text, metric units, 24-hour times. Keyboard accessible, laptop widths (1280 px and up).
At 1280 to 1440 px: nav on one line; no word broken inside (never `break-all` or `overflow-wrap: anywhere`); a card under 480 px wide has at most 3 columns, else it stacks; ids, times and numbers never wrap; no horizontal scroll.

## Look and feel
- Tone: calm control tower. Lots of air, big numbers, thin lines, one accent colour.
- Protagonists: Dashboard, "Needs a call today". Map, the Europe map. Shipments, the table. Detail, the temperature chart with its band. Alerts, open ones first.
- Map: kit basemap (Europe, lon -25 to 45, lat 33 to 72), real coordinates, routes are arcs (`basemapArc`), markers are DOM elements with `a-...` ids. Coordinates: Zaragoza 41.66, -0.88; Madrid 40.42, -3.70; Barcelona 41.38, 2.17; Lyon 45.76, 4.83; Lisbon 38.72, -9.14; Milan 45.46, 9.19; Paris 48.86, 2.35; Seville 37.39, -5.98; Bilbao 43.26, -2.94; Valencia port 39.44, -0.32; Algeciras 36.13, -5.44; Felixstowe 51.95, 1.35; Daventry 52.26, -1.16; Southampton 50.90, -1.40; Manchester 53.48, -2.24; Madrid airport 40.49, -3.57; Arras (Pas-de-Calais) 50.29, 2.78; Lelystad (Flevoland) 52.52, 5.47; Rotterdam 51.95, 4.14; Mantova 45.16, 10.79; Le Perthus 42.46, 2.86; Biriatou 43.33, -1.74. New York, Jebel Ali and Dubai are off the basemap: their leg ends at the map edge with a chip ("to New York, ETA 21 Nov"); never stretch or redraw the map.
- Never: identical card grids, hand-drawn maps, placeholder data, purple gradients.
- Reference: a modern freight-visibility product: white cards on a pale grey canvas, one blue accent, status colour only on badges, dense but airy tables.

## Technical constraints
One self-contained page built with the design kit, hash routes, no network of any kind (no CDN, web fonts or web images), anchored elements with stable `a-...` ids. Every control a user would try works.

## Verification
Each screen is reachable; filters and sorting work; SP-2403, SP-2405 and SP-2407 stand out as worrying; SP-2414 and SP-2417 show that they stop the factory line; dark theme readable; no console errors. Consistency: every KPI equals its count in the table above; the on-time chart shows the 14 values and the KPI 88 %; each marker sits at its coordinates; the alert feed lists the 7 open alerts; at 1280 px no word is broken and the nav is one line.
