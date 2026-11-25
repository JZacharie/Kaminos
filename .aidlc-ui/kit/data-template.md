# Data template: realistic data in `src/data.js`

A prototype with empty or placeholder data looks fake and fails the quality gate. Generate 12 to 60 rows of domain data at load time with
the deterministic helpers of `data/seed.js` (inlined in front of your `data.js` by `ui-build`).

In the first UI (stage 1.1) the agent `ui-data-builder` writes `src/data.js` from the data contract of `src/brief.json`
(`dataEntities[]`, `dataDerived`) while the screen builders code against the same contract: `window.APP_DATA` has one key per entity
(arrays of rows with exactly the declared fields, dates as `Date` objects), `kpis.<name>` numbers and `series.<name>` arrays, and the file
ends with `(window.APP_RENDER || []).forEach(function (render, i) { try { render(window.APP_DATA); } catch (e) { console.error('screen render #' + (i + 1) + ' failed: ' + (e && e.message)); } });`. The rules below apply to every prototype.
A page that loads real data after the first paint must not show this built-in data first: set `"await": true` in `src/head.json` and call `kit.ready()` after the first load.

## Rules

- 12 to 60 rows per table or list (never fewer than 12). Same seed, same rows: use `seedRandom(<intent number>)`.
- Names, places, products and units of the idea's domain. Real-looking people (first + last name), real city names, plausible quantities.
  Never `Item 1`, `Test`, `Lorem ipsum`, `foo`, `TBD`, `N/A` as data, never three identical rows.
- Dates are relative to the fixed constant `TODAY` (2026-11-04 09:00 UTC): `dateBack(3)` is three days ago, `dateBack(-2)` is in two days.
  Print them with `fmtDay`, `fmtDate`, `fmtTime`; numbers with `fmtNum`. Keep `data-v` on cells that sort or filter on a raw value.
- Statuses are a small set with realistic proportions (`weighted`), each with a text label and a badge class.
- Totals, KPIs and chart series are computed from the rows, so numbers agree everywhere on the screen.
- Escape every value with `esc()` before it goes into a template string. Keep ids stable: `SP-2410` stays `SP-2410` when you edit v2.
- This file is the only data source: `ui-seed-export` writes it to `seed.json` at the freeze and the backend builds its initial data from that file. Never make a second, different data set.
- Put a few "story" rows by hand after the loop (the delayed shipment, the overdue invoice) so the screens have something to say.

## Skeleton

```js
(function () {
  var rnd = seedRandom(2611);
  var rows = [];
  for (var i = 0; i < 24; i++) {
    rows.push({ id: 'ORD-' + (4100 + i), when: dateBack(range(rnd, 0, 20)), status: weighted(rnd, [['Paid', 6], ['Open', 3], ['Overdue', 1]]) });
  }
  fill('#orders-body', rows, function (r) {
    return '<tr><td>' + esc(r.id) + '</td><td data-label="Date" data-v="' + fmtDate(r.when) + '">' + fmtDay(r.when) + '</td>' +
      '<td data-label="Status"><span class="k-badge">' + esc(r.status) + '</span></td></tr>';
  });
  text('#kpi-open', String(rows.filter(function (r) { return r.status === 'Open'; }).length));
})();
```

## Vocabulary for six domains

Each block returns 24 rows when pasted into `data.js` and run after `seed.js`. Adjust the seed and the story rows to your idea.

### Logistics shipments

```js
var shipments = (function () {
  var rnd = seedRandom(101), out = [];
  var lanes = [['Burgos', 'Lyon', 'Truck'], ['Valencia', 'Felixstowe', 'Ship'], ['Madrid', 'Dubai', 'Air'], ['Zaragoza', 'Milan', 'Truck'], ['Algeciras', 'Newark', 'Ship']];
  var carriers = ['NordLink Trucking', 'Costa Verde Logistics', 'Atlantic Reefer Lines', 'Skyline Cargo'];
  var products = ['Classic 150g', 'Ham 45g', 'Paprika 150g', 'Sea Salt 40g'];
  for (var i = 0; i < 24; i++) {
    var lane = pick(rnd, lanes);
    out.push({ id: 'SP-' + (2410 - i), from: lane[0], to: lane[1], mode: lane[2], carrier: pick(rnd, carriers), product: pick(rnd, products),
      pallets: range(rnd, 4, 30), eta: dateBack(-range(rnd, 0, 9)), status: weighted(rnd, [['On time', 10], ['Delayed', 4], ['In customs', 2], ['Delivered', 8]]) });
  }
  return out;
})();
```

### Retail orders

```js
var orders = (function () {
  var rnd = seedRandom(102), out = [];
  var first = ['Sofia', 'Liam', 'Aiko', 'Mateo', 'Hannah', 'Omar', 'Chloe', 'Diego'], last = ['Brandt', 'Okafor', 'Nakamura', 'Ruiz', 'Keller', 'Haddad', 'Moreau', 'Silva'];
  var items = ['Oak desk 120 cm', 'Ergonomic chair', 'LED desk lamp', 'Bookshelf 5 tiers', 'Monitor arm', 'Wool rug 160x230'];
  for (var i = 0; i < 24; i++) {
    out.push({ id: 'WEB-' + (88120 + i * 7), customer: pick(rnd, first) + ' ' + pick(rnd, last), item: pick(rnd, items), qty: range(rnd, 1, 4),
      total: range(rnd, 2900, 64900) / 100, placed: dateBack(range(rnd, 0, 14), range(rnd, 0, 23)), status: weighted(rnd, [['Delivered', 8], ['Shipped', 5], ['Packing', 3], ['Refund requested', 1]]) });
  }
  return out;
})();
```

### Clinic appointments

```js
var appointments = (function () {
  var rnd = seedRandom(103), out = [];
  var patients = ['Elena Marín', 'Jonas Weber', 'Priya Nair', 'Tomás Bravo', 'Ingrid Larsen', 'Karim Saidi', 'Laura Conte', 'Pedro Alves'];
  var reasons = ['Annual check-up', 'Blood pressure review', 'Vaccination', 'Knee pain follow-up', 'Prescription renewal', 'Skin rash'];
  var doctors = ['Dr. Lena Fischer', 'Dr. Marcos Ortega', 'Dr. Aisha Rahman'];
  for (var i = 0; i < 24; i++) {
    var day = dateBack(-range(rnd, 0, 6));
    day.setUTCHours(range(rnd, 8, 16), pick(rnd, [0, 15, 30, 45]), 0, 0);
    out.push({ id: 'APT-' + (3300 + i), patient: pick(rnd, patients), reason: pick(rnd, reasons), doctor: pick(rnd, doctors), at: day, minutes: pick(rnd, [15, 20, 30, 45]),
      status: weighted(rnd, [['Confirmed', 8], ['Waiting', 2], ['Cancelled', 1], ['Checked in', 2]]) });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
})();
```

### HR requests

```js
var requests = (function () {
  var rnd = seedRandom(104), out = [];
  var people = ['Nadia Petrova', 'Lucas Bernard', 'Mei Tanaka', 'Samuel Adeyemi', 'Clara Jiménez', 'Arjun Mehta', 'Greta Holm', 'Pedro Duarte'];
  var types = ['Annual leave', 'Sick leave', 'Remote work', 'Parental leave', 'Training budget', 'Equipment request'];
  var teams = ['Finance', 'Engineering', 'Customer care', 'Operations'];
  for (var i = 0; i < 24; i++) {
    var from = dateBack(-range(rnd, 1, 40));
    out.push({ id: 'HR-' + (1500 + i), who: pick(rnd, people), team: pick(rnd, teams), type: pick(rnd, types), from: from, days: range(rnd, 1, 10),
      status: weighted(rnd, [['Approved', 8], ['Pending', 5], ['Rejected', 1]]) });
  }
  return out;
})();
```

### Support tickets

```js
var tickets = (function () {
  var rnd = seedRandom(105), out = [];
  var subjects = ['Cannot reset my password', 'Invoice shows the wrong VAT number', 'Export to CSV times out', 'Mobile app logs me out every hour', 'Request: dark mode for the dashboard', 'Webhook returns 502 since Monday', 'Add a second admin to the account'];
  var agents = ['Ines Duarte', 'Marcus Webb', 'Yuki Hayashi', 'Olga Smirnova'];
  var plans = ['Free', 'Team', 'Business', 'Enterprise'];
  for (var i = 0; i < 24; i++) {
    out.push({ id: 'T-' + (20410 + i * 3), subject: pick(rnd, subjects), agent: pick(rnd, agents), plan: pick(rnd, plans), opened: dateBack(range(rnd, 0, 9), range(rnd, 0, 23)),
      priority: weighted(rnd, [['Normal', 8], ['High', 3], ['Urgent', 1]]), status: weighted(rnd, [['Open', 6], ['Waiting for customer', 4], ['Solved', 7]]) });
  }
  return out;
})();
```

### Finance invoices

```js
var invoices = (function () {
  var rnd = seedRandom(106), out = [];
  var clients = ['Nordwind GmbH', 'Brasserie Lemaire', 'Atlas Freight Ltd', 'Studio Marta Vidal', 'Kestrel Analytics', 'Oliva & Hijos S.L.'];
  var services = ['Consulting, 12 days', 'Annual licence', 'Support retainer', 'Implementation phase 2', 'Training workshop'];
  for (var i = 0; i < 24; i++) {
    var issued = dateBack(range(rnd, 1, 75));
    out.push({ id: 'INV-2026-' + pad(i + 41, 4), client: pick(rnd, clients), service: pick(rnd, services), issued: issued, due: new Date(issued.getTime() + 30 * 864e5),
      amount: range(rnd, 45000, 1850000) / 100, status: weighted(rnd, [['Paid', 9], ['Sent', 5], ['Overdue', 2], ['Draft', 1]]) });
  }
  return out;
})();
```

## Badge classes for common statuses

| Meaning | Class | Typical labels |
|---|---|---|
| good, done | `k-badge k-badge-ok` | On time, Paid, Approved, Solved, Confirmed, Delivered |
| attention | `k-badge k-badge-warn` | In customs, Pending, Waiting, Sent, Low stock |
| problem | `k-badge k-badge-bad` | Delayed, Overdue, Rejected, Urgent, Cancelled |
| information | `k-badge k-badge-info` | At port, Open, Checked in, New |
| neutral | `k-badge` | Draft, Archived, Closed |
