# Progress events while v1 (and later versions) are built

Quality comes first (the product owner, 2026-11-04): v1 may take up to 15 minutes (p90), so the person must see what is happening.
The builder writes one JSON line per event to `<record>/ui/progress.jsonl` (append-only, never rewritten, not versioned).
Canvas watches the file and shows a live checklist ("Planning screens", "Building: Shipments", "Checking mobile layout",
"Repairing: contrast on Alerts", "Visual review").

Schema: `addon/templates/progress-event.schema.json`. One object per line, UTF-8, `\n` terminated, written with a single
`O_APPEND` write (no interleaving; each line < 4 KB).

```json
{"schemaVersion":1,"ts":"2026-11-04T10:15:30.123Z","version":1,"phase":"screen","status":"start","screen":"shipments","check":null,"n":2,"of":5,"message":"Building the Shipments screen"}
```

| Field | Meaning |
|---|---|
| `version` | The `uiVersion` being built (1 for the first UI). |
| `phase` | `brief` (design brief and screen plan), `screen` (one screen being written), `assemble` (ui-build), `gate` (one quality check), `repair` (a repair round), `critic` (vision review), `publish` (version snapshot written, UI ready), `done` (the builder finished; carries the final verdict) |
| `status` | `start`, `done`, `pass`, `fail`, `info`, `skip` |
| `screen` | Screen id from `ui-map.json` or null |
| `check` | For `gate`: `console`, `overflow`, `axe`, `lighthouse`, `network`, `data`, `critic`; else null |
| `n` / `of` | Position in a sequence (screen 2 of 5, repair 1 of 5) or null |
| `message` | Short human text, English, <= 140 chars; Canvas shows it as is |

Who writes them: the CLI `.aidlc-ui/bin/ui-progress <ui-dir> --phase P --status S [--screen id] [--check c] [--n i --of N] [--version N] --message "..."`
(the agent and its subagents call this); `ui-build` writes `assemble` events, `quality-gate` writes one `gate` event per check
(plus `critic`), `ui-version` writes `publish`. The 15-minute budget and the repair limit are soft: when the repair limit is
reached the builder publishes with `phase:"done"`, `status:"fail"` and a message "quality: N issues", and Canvas shows the badge (D-33).

Progress that does not depend on a model (B1): `ui-progress <ui> --plan` (brief done + a `screen start` per screen of `brief.json` and the dataset), `--sync` (a `screen done` for every
complete `src/screens/NN-<id>.html` and `src/data.js`; `src/body.html` + `data.js` in single mode) and `--watch` (a detached process that runs both every 3 s until a `done` event, 45 min at most;
`--stop-watch` ends it). All idempotent. The main agent runs them because subagents, Kiro's always, do not emit events; without them Canvas stays near its 8 % starting value. Canvas weights:
brief 10, screens 50 (done + half of those started, over the planned count), gate 25, critic 10, publish 5.

Compatibility: the file is outside every AI-DLC deliverable, like the rest of `ui/` (ANCHORS 6.1). Canvas must tolerate a missing file and
unknown extra fields.
