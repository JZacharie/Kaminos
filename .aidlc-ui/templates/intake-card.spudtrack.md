# Intake card: SpudTrack

## Idea and users
SpudTrack is a web app for Patatas Doradas, a potato-chip maker, to follow shipments to retailers.
Users: the logistics coordinator (daily work) and the operations manager (looks at the KPIs).
It solves late deliveries and spoiled product that go unnoticed until the retailer calls.

## Main screens (first version)
- Sign-in: email and password, one demo user.
- Shipments list: table of shipments with filters by status (on time, delayed, delivered), retailer and date.
- Shipment detail: route stops, current status, expected vs. actual arrival, temperature chart.
- Alerts: delayed shipments and temperature alerts, newest first, acknowledge button.
- KPI dashboard: on-time rate, average delay, open alerts, shipments per day.

## Data sources
Mock data only: a JSON file with about 40 shipments, 6 retailers and hourly temperature readings.
No database, no real carrier integration in the first version.

## Must-haves
- See every shipment and filter the list by status, retailer and date.
- Mark a shipment as delayed when the expected arrival has passed and show the delay in hours.
- Raise a temperature alert when a reading is above 8 C for more than 30 minutes.
- KPI dashboard with the four numbers above, computed from the same mock data.

## Out of scope
Real sign-up and roles, carrier or GPS integration, e-mail or SMS notifications, invoices, mobile app.

## Constraints
English labels, browser only (no server code), clickable demo in 45 minutes, one primary colour (potato gold).
