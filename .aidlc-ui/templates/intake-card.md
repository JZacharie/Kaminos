# Intake card

Fill this in before you start. Keep it short: the AI-DLC run reads it as your answer to the first
questions, so the more it says, the fewer questions you get. Paste it as the `/aidlc ui-workshop "..."` argument.

## Idea and users
One or two sentences: what is the product, who uses it, what problem does it solve.
- A web app for the dispatch team of a small bakery to plan daily deliveries.
- A tool for clinic receptionists to see today's appointments and no-shows.

## Main screens
The screens that exist in the first version (3 to 5), one line each, with what the person does there.
- Login: the dispatcher signs in with email and password.
- Orders list: filter by date and status, open an order.

## Data sources
Where the data comes from. Sample or mock data is fine for the first version; say so.
- Mock JSON files inside the app (no database).
- A CSV export from the ERP, loaded once at start.

## Must-haves
What the first version has to do, in order of importance (3 to 6 items).
- Show today's items with a status badge.
- Alert the person when a value passes a limit.

## Out of scope
What the first version does NOT do. Say it here so nobody is asked about it.
- No real user accounts or permissions.
- No mobile app, no email or SMS sending.

## Constraints
Hard limits: time, technology, language, data, budget.
- Static front end only, English labels, runs in a browser without a server.
- Demo must be clickable in 45 minutes.
