# Golden reference: SpudTrack (English)

`spudtrack/BRIEF.md` is the brief (about 6 KB) that produced `spudtrack/reference.html` (145 KB single file, about 10 minutes with Sonnet 5.5). The product owner's quality example: real domain detail, exact screens, 18 realistic mock records, every answer changes the UI, light and dark theme.

Use it to calibrate, not to copy:
- The brief writer reads `spudtrack/BRIEF.md` for the level of detail expected (template: `addon/templates/app-brief.md`).
- The vision critic receives `spudtrack/screenshots/shot-dashboard.png` and `shot-detail.png` as the bar: a new prototype must be at least as polished and specific as these for its own domain (rubric: `addon/quality/rubric.md`).
- `reference.html` still contains the demo's Inception layer (pins, drawer, export); that layer is replaced by Canvas in the product. Do not copy markup from it into a prototype; study the information design, density and copy.
