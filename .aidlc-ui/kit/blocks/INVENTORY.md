# Block inventory (BK1)

Every block is `K.block.<name>(el, cfg)`; contract and tokens in `DESIGN.md`, builder checklist in `BLOCK-TEMPLATE.md`.
Apps: **S** = SpudTrack, **E** = EV Fleet (VoltRoute), **G** = Stagehand. "Kills" = the B1 defects the block must make impossible.
Common fields on every block (handled by core): `title, subtitle, actions[{label,href?,onClick?,kind?,id?}], state, emptyText, errorText, frame, headingLevel`.
Item `id` fields always land on the item's root element (stable `a-...` anchors). Times are `"HH:MM"` strings or ISO; numbers are numbers.

## Families (one builder each, disjoint files)

| Family | Blocks | Files it owns (all under `addon/`) |
|---|---|---|
| F-core (D1, done) | kpi, states, theme | `kit/blocks/{core.js,blocks.css,kpi.js,kpi.css}`, `tests/blocks/gallery/kpi.html`, `tests/blocks/core.test.mjs` |
| F-shell | shell, segmented | `kit/blocks/{shell,segmented}.{js,css}`, `tests/blocks/gallery/{shell,segmented}.html` |
| F-table | table, filterbar | `kit/blocks/{table,filterbar}.{js,css}`, `tests/blocks/gallery/{table,filterbar}.html` |
| F-detail | detail, feed, board | `kit/blocks/{detail,feed,board}.{js,css}`, `tests/blocks/gallery/{detail,feed,board}.html` |
| F-map | map | `kit/blocks/map.{js,css}`, `tests/blocks/gallery/map.html` (reads `kit/data/basemap.js`, never edits it) |
| F-timeline | lanes, steps | `kit/blocks/{lanes,steps}.{js,css}`, `tests/blocks/gallery/{lanes,steps}.html` |
| F-charts | series, bars | `kit/blocks/{series,bars}.{js,css}`, `tests/blocks/gallery/{series,bars}.html` |
| F-plan | siteplan | `kit/blocks/siteplan.{js,css}`, `tests/blocks/gallery/siteplan.html` |
| F-options | options | `kit/blocks/options.{js,css}`, `tests/blocks/gallery/options.html` |
| F-tracks (KC1, 2026-11-20) | tracks | `kit/blocks/tracks.{js,css}` (uses `K.media` icons when loaded, ui-build inlines it), `tests/blocks/gallery/tracks.html`, `tests/blocks/tracks.test.mjs` |
| F-inspector (KC1, 2026-11-20) | inspector | `kit/blocks/inspector.{js,css}`, `tests/blocks/gallery/inspector.html`, `tests/blocks/inspector.test.mjs` |
| F-media (BK1, 2026-11-17) | tiles, rows, player, chat, posts, comments, profile, calendar | `kit/blocks/<name>.{js,css}`, `kit/blocks/media.lib.{js,css}` (shared helpers `K.media`: icon, avatar, cover, stars, count, clock; not a block), `tests/blocks/gallery/<name>.html`, `tests/blocks/<name>.test.mjs` |

Each family may add `tests/blocks/<block>.test.mjs` and fixtures `tests/blocks/gallery/data/<block>.js`. Nobody edits `core.js`/`blocks.css`: needs go to the lead as a note in `~/work/bk1/sub/<task>-notes.md` ("core request: ...").

## Blocks

### kpi (F-core) -- counters strip
S dashboard (4: in transit, delayed, open alerts, on-time %), E readiness (6 counters) and schedule (plan totals strip), G lineup header.
Schema: see the doc block in `kpi.js`. `items[{label,value,unit?,prefix?,delta?,good?,status?,hint?,href?,id?}]`, `columns=6`, `minWidth=168`.
States: empty, loading, error. Kills: 280 px tall KPI cards with one number, labels "Peak load, T" clipped, values wrapping, 80 px summary card with letter-wrapped totals.

### shell (F-shell) -- top bar, nav, page header
All screens. `brand{name, mark?}`, `nav[{label, href, id?}]`, `user?{name, role?}`, `themes? bool` (theme menu), `page?{title, subtitle?, actions[]}`. Integrates with kit.js hash router (`aria-current` on the active link).
Kills: nav on two lines; user pill wrapping; theme button missing in dark. Nav one line from 1024 px: tighten, then scroll inside itself.
### segmented (F-shell) -- single-choice switch (depot, day, mode, view)
E depot switch, G Friday/Saturday, S mode filter on the map. `options[{value,label,count?}]`, `value`, `onChange(value)`, `label?`. Keyboard arrows. Kills: chips wrapping onto 3 lines (it scrolls in place, never wraps a chip).

### table (F-table) -- data table
S shipments, alerts; E vans, alerts, sessions; G crew list, rider items, arrivals. `columns[{key,label,type:'id'|'text'|'num'|'time'|'date'|'status'|'badge',width?,align?,sortable?,unit?,dp?,format?(row)}]`, `rows[]`, `rowKey`, `rowHref?(row)` or `onRow?(row)`, `sort{key,dir}`, `search?{placeholder, keys[]}`, `filters?` (filterbar config), `pageSize=50`, `stickyFirst=true`, `maxColumns?` (hide lowest-priority columns below a width: `priority` per column), `empty`.
States: empty, no-match (filters), loading, error, 500 rows (pager), long cells (ellipsis + title), narrow (scroll inside the card, sticky first column).
Kills: "AL-" / "320" and "BW-" / "06" id wraps, "Hapag-" / "Lloyd", 10-11 columns squeezed, headers stacked 3 lines, right columns cut off, page horizontal scroll.
### filterbar (F-table)
Above tables, maps, feeds. `groups[{key,label,options[{value,label,count?}],multi?}]`, `search?`, `value{}`, `onChange(value)`, `reset`. Kills: chips on 3 lines, clipped placeholder "Pick or type a full l".

### detail (F-detail) -- key-value panel with sections
S cargo and lot, documents; E van status, route stops (ordered list with km); G artist card (transport, pickup, hotel, hospitality), rider check. `sections[{title?, items[{label, value, status?, href?, mono?, hint?}] | list[{text, meta?, status?}]}]`, `columns=1|2` (2 only when the card is >= 480 px wide). Kills: values wrapping mid-id, cards with 600 px blank under a short list.
### feed (F-detail) -- alert / incident / event feed
S alert feed, "Needs a call today", events; E alerts with suggested action; G incident list, incident log, arrivals. `items[{id, title, severity|status, time, meta?, body?, tags[], href?, selected?}]`, `sort='severity'|'time'|'none'`, `group?`, `limit?`, `onSelect?(item)`, `compact`. Kills: times 1 h apart between screens (feed shows the given time, never recomputes), titles clipped past the card edge, open/closed mixed.
### board (F-detail) -- status board / card grid
E van cards by depot (2 per row, >= 260 px), G "Stages right now" (stage, now, next: 3 columns, never more), G weather strip. `groups[{title, items[]}]`, `item{id,title,status,fields[{label,value}],progress?{value,max,label},href?}`, `minCard=260`, `layout:'cards'|'rows'`. Kills: equal-height stretch with 700 px blank, 4+ columns in a card under 480 px.

### map (F-map) -- geographic map or schematic
S map (shipments, arcs, off-map chips), G overview (flight arcs ending at AMS, merged festival+AMS marker). Reuses `kit/data/basemap.js` (projection, land, `basemapFit`, `basemapArc`, `basemapEdge`): do not rewrite it.
`places[{id,lat,lon,label,kind?,status?,cat?}]`, `routes[{from,to,via?,status?,cat?,dashed?}]` (from/to = place ids or [lat,lon]), `offmap[{id,label,toward:[lat,lon]}]` (edge chips), `legend[{label,cat|status,shape}]`, `fit='places'|'all'`, `padding=40`, `square=true`, `selected?`, `onSelect?(place)`, `mode:'geo'|'schematic'` (schematic: no land, places on a grid from `x,y` 0-1).
Kills: Scandinavia framing, Iberia cut at the edge, markers crammed or cut, legend colours not matching markers, labels on arcs and markers, overlapping edge chips, MAN label cut off.

### lanes (F-timeline) -- lane timeline / gantt
E charging schedule (row per charger, 17:00-08:00, tariff bands, session blocks per van colour), G lineup (lane per stage, 14:00-02:00, set slots, changeovers, curfew lines, "now"), G crew planner (row per technician, 10:00-03:00, shifts, fatigue). `start, end` (times; end < start = next day), `lanes[{id,label,sub?}]`, `items[{id,lane,start,end,label,sub?,status?,cat?|catKey?,href?}]`, `bands[{start,end,label,tone}]`, `markers[{time,label,kind:'now'|'curfew'|'limit'}]`, `laneLabelWidth=120`, `rowHeight`, `onMove?(item, minutes)`, `step=30`.
Rules: labels inside a block when they fit, else outside to the right if free, else hidden with `title` + tooltip; the now line is drawn under the text with a halo and its label sits in the axis, never over a block. Kills: "Lumen / Fray" wraps, "B..." blocks, "02:0" clipped last tick, Now line through set text, tiny squeezed axis.
### steps (F-timeline) -- milestone / leg stepper
S shipment leg timeline (carrier, planned, actual), E tomorrow's route stops, G artist arrival chain. `steps[{label, sub?, planned?, actual?, status, meta?}]`, `orientation:'h'|'v'` (h falls back to v under 120 px per step). Kills: planned/actual times wrapping, mismatched ETAs.

### series (F-charts) -- time series line/area/step
S on-time % by day (14 values), temperature + humidity with allowed band; E SoC curve, load against the limit (shares the lanes time axis), 24 h load; G wind gusts. `x[]` (times/dates/labels), `series[{name,values[],cat?,area?,step?,unit?,axis:'left'|'right'}]`, `bands[{from,to,label,tone}]` (value bands), `xbands[{start,end,label,tone}]` (time bands), `thresholds[{value,label,tone}]`, `yMin?,yMax?,unit, integer?`, `height=240`, `timeAxis?{start,end}` (aligns with lanes).
Kills: "27.5 kW", ".5km/h", "02:0" clipped ticks, oversized axis fonts (SVG scaled with width), colliding x labels, fractional count ticks.
### bars (F-charts) -- category bars
S delays by cause, shipments by status; E month cost by band, last 7 sessions. `items[{label,value,status?,cat?,href?}]` or `stacks`, `orientation:'h'|'v'` (default h for long labels), `unit, dp, total?` (shown and checked: a mismatch with the sum warns), `sort`. Kills: x labels colliding ("Customs Driver rest"), 250 px blank under a bar chart, bars that do not sum to the KPI.

### siteplan (F-plan) -- schematic site plan
G overview site plan (gate, shuttle stop, stages, village, station, labelled walking paths). `nodes[{id,label,x,y,kind,status?}]` (x,y 0-100 grid), `paths[{from,to,label,dashed?}]`, `areas[{label,x,y,w,h}]`, `height=320`. Label placement: `h.fitLabels` with nodes + path midpoints as obstacles; path labels on a halo, moved along the path when they collide. Kills: "Artist catering 380 m" on top of "Artist village", labels cut at card edges ("Harbour Airpo"), dotted paths crossing distance labels.

### options (F-options) -- decision / option cards with impact
G incidents (ranked options with impact on running order, crew and curfew, approve one), E plan choice (lowest cost vs charge on arrival). `items[{id,rank?,title,summary,impact[{label,value,tone}],recommended?,cost?}]`, `selected?`, `onApprove?(item)`, `approveLabel`, `approved?`, `layout:'list'|'compare'`. Impact is a 2-column key/value grid inside the card (never 4 squeezed columns). Kills: option cards squeezing 4 impact columns, margins that disagree between options (the block shows the given values, never computes them).

## Consumer-style blocks (BK1, 2026-11-17)
Generic patterns seen in music, video, photo/social, chat, shop and calendar apps; no brand names, logos or assets. All draw avatars, covers, stars and icons through `K.media` (`media.lib.js`), which ui-build inlines only when one of the 8 is used. Covers and avatars need no image: they show a category tint with initials or a glyph, and an app `src` (data URI or its own file) shows over it and falls back on error. The block that lists rows is called `rows`, not `list`: core reserves `K.block.list` (the registry lister).

### tiles (F-media) -- media grid, cards and rails
Music shelves (album, playlist, artist grids), video cards (duration, byline, views, progress), shop product cards (price, old price, rating, add to cart), photo grids (`caption:false`), story strips (`shape:'round'`, `ring:'unseen'|'seen'`), "Recommended" rails with the common `actions` as "See all". `items[{id, title, sub?, cover?{src?,alt?,glyph?,key?}, badge?, duration?, price?, oldPrice?, rating?, ratingCount?, meta?, byline?{name,src?}, progress?, ring?, href?, selected?, actions?[{id,label,icon?}]}]`, `layout:'grid'|'rail'`, `shape:'square'|'wide'|'portrait'|'round'`, `minWidth`, `lines`, `caption`, `selectable`, `arrows`, `onSelect(item)`, `onAction(item, actionId)`. States: empty, loading, error, bad config, selected tile (accent ring + aria-current), cover without or with a failed image (tint + initials). Whole tile is a link (`href`) or a button that selects; icon actions show on hover and on focus (always on touch); price and oldPrice are shown as given. Kills: giant single-column covers on a phone (2 columns from 200 px), invisible keyboard focus on hover-only actions, stars that fail the contrast/overlap gate, covers that stay blank when the image fails.

### rows (F-media) -- rich rows (playlist, inbox, cart, settings)
Playlist and track lists (numbered, cover, album, duration, like, now playing), inbox (avatar with status, last message, time, unread count), contacts, notifications (status pill), search results, cart lines (cover, variant, price, quantity stepper, remove), settings rows (hint, switch or chevron). `items[{id, title, sub?, meta?, lead?{type:'cover'|'avatar'|'index'|'icon'|'none',src?,glyph?,key?,status?}, value?, duration?, time?, unread?, badge?, status?, playing?, selected?, href?, disabled?, trailing?[{kind:'like'|'play'|'switch'|'stepper'|'button'|'text'|'chevron', ...}]}]`, `numbered`, `dividers`, `density`, `selectable:'single'|'none'`, `fill:true|'scroll'`, `onSelect(item)`, `onChange(item, kind, value)`, `onAction(item, id)`. States: empty, loading, error, bad config, selected, playing, disabled. Like, switch, stepper, play and selection update locally and call the callback. `fill:true` spreads row padding (h.padFit), `fill:'scroll'` scrolls inside. Kills: numbers and duration that shift column between rows (fixed min widths), truncated unread counts, rows that overlap when 6 cells compete (cells wrap under the text instead), keyboard-unreachable row actions.

### player (F-media) -- audio or video player bar and now-playing card
- **Apps**: music streaming (now-playing bar, album card), podcast app (episode card with speed and queue), video platform (16:9 stage plus control strip).
- **Schema**: `track{title, artist?, album?, cover?{src?, glyph?, key?}}`, `kind audio|video`, `playing`, `position`, `duration` (seconds), `volume 0-100`, `muted`, `shuffle`, `repeat off|all|one`, `liked`, `speed`, `queueCount`, `layout bar|card|auto`, `live`, callbacks `onPlay, onPause, onSeek(s), onPrev, onNext, onVolume(v), onToggle(name, value)` with name shuffle|repeat|like|mute|speed. A control shows only when its field is given (prev, next, play and seek always).
- **States**: no track (empty), loading, error, bad config, playing, paused, no duration (seek disabled, "\u2014"), video stage.
- **Layout**: container query on the block's own width: one row (info | transport + seek | extras) from 720 px, stacked below; `card` is always stacked with a 5 rem cover; video max 36 rem wide. Under 520 px the volume slider is hidden (mute button stays). Buttons are 44 px stacked, 36 px in the wide bar.
- **A11y**: play/pause is the one accent button (`aria-pressed`, label Play/Pause); toggles are `aria-pressed` buttons with `aria-label`; Seek and Volume are real `input type=range` with `aria-valuetext` ("Position 1:23 of 3:45", "Volume 70 percent", "Muted"). Seek change fires `onSeek` on release/each key press, volume fires `onVolume` on input.
- **Kills**: hand-built now-playing bars, podcast cards, video control strips, custom seek sliders.

### chat (F-media) -- message thread with composer
- **Apps**: chat app, support inbox, AI-assistant conversation, group chat.
- **Schema**: `me`, `people[{id, name?, src?, status?}]`, `messages[{id?, from, text?, time?, status?, reactions?[{emoji, count?, mine?}], replyTo?{text, from?}, attachment?{kind image|file, name, size?, src?, glyph?}}]`, `typing` (id or array), `composer {placeholder?, sendLabel?, disabled?} | false`, `height`, `onSend(text)`, `onRetry(message)`, `onReact(message, emoji)`, plus title/subtitle as the thread header.
- **States**: empty thread (note + composer), loading, error, bad config, typing row, failed message with Retry, sending.
- **Behaviour**: groups = consecutive messages from the same person on the same day within 10 minutes (when both have dates); one avatar, name and time per group; day separators Today / Yesterday / date only from ISO or Date times ('HH:MM' times have no separators); mine right on accent-soft, theirs left on surface-2, max 80 % wide; status is icon + word (last message of a group shows the word, the others keep it for screen readers; failed and sending always show it). Enter sends, Shift+Enter newline, IME composing ignored, textarea grows to 5 lines, send disabled when empty. Sending appends a local message from `me` (status sent) and keeps focus; an app `update({messages})` replaces the local list. Reaction chips toggle locally (count +-1) and call `onReact`. Retry sets the message to sending locally and calls `onRetry`.
- **Long words**: text longer than 24 characters without spaces is cut into 20-character `nowrap` pieces separated by `<wbr>`, so it wraps inside the bubble without changing the text (copy and search see the original); `overflow-wrap:break-word` stays as the last fallback on `.k-chat-tx` only.
- **Kills**: hand-built chat bubbles, composer textareas, typing indicators, reaction rows.

### posts (F-media) -- post feed / photo grid / video and blog cards
Social and community feeds, photo grids, short-video cards, creator and club pages, blog or news cards with engagement. `items[{id?,author{name,handle?,src?,key?,verified?},time?(text|ISO|ms|Date),text?,media?{src?,glyph?,key?,ratio?:'1/1'|'4/5'|'16/9',alt?,count?,duration?},location?,tags?[],likes?,comments?,shares?,views?,liked?,saved?,href?,menu?[{label,onClick?}]}]`, `layout:'feed'|'grid'`, `clamp` (3), `labels{}`, callbacks `onLike(item,liked)`, `onSave(item,saved)`, `onComment`, `onShare`, `onOpen` (media), `onAuthor`. Like and save toggle locally (aria-pressed, filled icon); a numeric like count moves by exactly 1 from the given value (given `liked:true` + toggle off = count - 1), a text count never changes. #tags and @mentions are accent text, never links. Text is cut at `clamp` lines with a "more" button (aria-expanded). Action labels show from a 360 px card width (container query), icons with aria-label under. Media without `src` is a tint with a glyph or an icon; a broken `src` falls back to it. Carousel = "1/3" badge + dots (display only). Menu = disclosure list, Escape closes. States: empty, loading, error, bad config. Kills: image-less prototypes with empty grey boxes, counts that jump by more than one, labels that wrap on a phone, hashtags that look like dead links.

### comments (F-media) -- comment thread / reviews
Video and post comments, product reviews, ticket and discussion threads. `items[{id?,author{name,src?,key?},text,time?,likes?,liked?,badge?,edited?,rating?,replies?[same]}]`, `total?` (printed as given in the heading "Comments · 1,284"), `label` ('Comments'), `sort{value,options[]}` (native select, `onSort(value)`; the block never sorts), `composer{placeholder,submitLabel,avatar{name,src}}` (real textarea; submit adds a local comment at the top and calls `onSubmit(text,parentId?)`; Reply opens an inline composer with "Replying to Name", Cancel, Escape, Ctrl+Enter), `maxDepth` (2; deeper replies are flattened under their level-maxDepth comment with a "Replying to" hint and no extra indent), `collapseReplies` (true: "View N replies" button with aria-expanded + aria-controls; nested lists are ul/li), `limit` + "Show more comments" (`onMore(shown)`, `hasMore`), `labels{}`, callbacks `onLike(item,liked)`, `onReply(item)`. `rating` shows K.media.stars; the block adds no averages. States: empty (heading, composer, empty text), loading, error, bad config. Kills: reply trees that march off the right edge, "view replies" buttons without aria-expanded, hand-made composers that submit blank text, review lists with invented averages.

### profile (F-media) -- profile / channel / artist / store / team header
Social profile (cover, verified, stats, Follow toggle, tabs), artist page (centred), channel header, store page, team page, user card in a sidebar (compact, 320 px). Uses `K.media` avatar and cover.
Schema: see the doc block in `profile.js`. `name`, `handle?`, `verified?`, `src?`/`key?` (avatar), `cover?{src?,key?,glyph?}`, `bio?` (3 lines + "more" only when cut), `meta?[{label,icon?:pin|link|calendar|mail,href?}]`, `stats?[{label,value,href?}]` (numbers from 1000 up compacted, full number in title), `actions?[{id?,label,kind?:primary|secondary|icon,icon?,pressed?,pressedLabel?}]` (boolean `pressed` or `pressedLabel` = local toggle with aria-pressed), `tabs?[{value,label,count?}]`, `tab?`, `layout: banner|compact|center`, `onAction(id, pressed)`, `onTab(value)`.
States: loading, error, bad config; every optional field absent leaves no hole. Under 480 px (measured on the block) the actions move under the name; tab strip scrolls sideways when it does not fit. Keyboard: Left/Right/Home/End in the tab strip.
Kills: avatar + name + three buttons hand-drawn per page, bio that grows to 12 lines, follow buttons that do not change state, stat numbers that wrap, long names that push the layout wide, cover banner 400 px tall.

### calendar (F-media) -- month calendar with agenda
Bookings, appointments, content plan, rota, release dates, holidays (lanes stays the one-day-by-resource view).
Schema: see the doc block in `calendar.js`. `month 'YYYY-MM'`, `today?`, `selected?`, `weekStart 0|1 (1)`, `events[{id?,date,end?,title,time?,cat?,status?,allDay?,href?}]`, `view month|agenda|auto (auto)`, `maxPerDay (3)`, `showWeekNumbers?`, `labels?{today,prev,next,allDay,more,none,events}`, `onSelect(date)`, `onEvent(event)`, `onMonth(month)`.
States: loading, error, bad config, empty month (grid stays; agenda view says "No events"). Layout: chip grid with multi-day bars from 560 px (measured on the block), below that a grid with category dots and the agenda of the picked day; "+N more" picks the day and shows its agenda. Keyboard: grid is one tab stop (roving), arrows, PageUp/PageDown, Home/End, Enter/Space.
Kills: month grids drawn with absolutely positioned divs, events that overflow the cell, dates built with `new Date()` (timezone shifts: the block works in UTC calendar dates), month names hard-coded in English, mouse-only calendars.

### tracks (F-tracks) -- multi-track clip timeline with playhead
- **Apps**: video and audio editors (clips on tracks), podcast editing, a stage run-of-show (cues per channel over a 45-minute set), a deployment or rollout timeline with a scrubber. Not `lanes`: lanes is a clock-time gantt (HH:MM, midnight, curfew) with no playhead and no trim; tracks is numeric seconds from 0.
- **Schema**: `duration` (s, required), `tracks[{id, label?, kind?, locked?, hidden?, muted?, clips[{id, start, length, label?, kind?, cat?, status?, thumb?}]}]`, `fps` (30), `timecode hms|frames|seconds`, `playhead`, `selected`, `zoom` (px per second; default and minimum = fit the container), `snap` (false), `trim` (true), callbacks `onSeek(s)`, `onSelect(id)`, `onTrim(id,{start,length},'start'|'end')`, `onMove(id,{start,track})`, `onToggle(trackId,'lock'|'hide'|'mute',value)`, `onZoom(pxPerSec)`.
- **Behaviour**: fixed track-header column (label, kind icon, lock/hide/mute buttons only for the flags given) beside a scrolling lane area; time ruler with windowed ticks (labels thin out by zoom); playhead = line over all tracks with a handle on the ruler and a timecode bubble while dragging (click or drag the ruler); clips coloured by `cat` (default the track id) through `h.catFor`, `kind` only picks a small icon, clips under 24 px show no label, every clip has a tooltip with its times. Drag a clip body to move it (also onto another unlocked track), drag either end to trim, both on frame boundaries; `onMove`/`onTrim` fire on release, `onSeek` on every change. Locked track: select only. Snap (within 6 px, Alt = off): playhead, clip edges of every track, 0, the end, ruler ticks; a dashed guide shows the target. State (playhead, selection, edits, toggles, zoom) is local and survives resizes; a changed `tracks` replaces it. Out-of-range clips are clamped with one warning.
- **Keyboard**: arrows = playhead 1 frame (Shift 1 s), Up/Down = select the clip at the playhead on the next track, `[` / `]` = trim the selected clip start/end to the playhead, `+` / `-` zoom, Enter selects. One tab stop for clips (selected or first), one for the playhead (`role=slider`). Delete is the app's.
- **States**: empty (no tracks), loading, error, bad config (inline), 12 tracks x 80 clips, long labels, unicode.
- **Kills**: hand-drawn timelines whose clips are px positions in the markup, scrubbers without keyboard, trim handles that move the wrong end, clips that overlap their label, tiny clips with unreadable text.

### inspector (F-inspector) -- editable properties panel
- **Apps**: video and photo editors (position, scale, opacity of the selected clip), an EV charger or van configuration panel (power limit, connector, schedule, tariff), a rule or alert editor, a CMS block settings pane. Not `detail`: detail is read-only key/value, inspector edits.
- **Schema**: `subject{name, id?, kind?}`, `tabs[{id, label?}]`, `tab`, `sections[{id, tab?, title, open?, resettable?, controls[{key, label, type 'number'|'slider'|'text'|'select'|'switch'|'choice'|'swatch', value, default?, unit?, min?, max?, step?, options?[{value, label?}], disabled?, hint?}]}]`, callbacks `onChange(key, value, sectionId)`, `onReset(sectionId)`, `onTab(id)`, `onToggleSection(id, open)`.
- **Behaviour**: header with the object's name (heading level `headingLevel`), kind pill and id (ellipsis + title). Tabs filter the sections (a section without `tab` shows on every tab; an empty tab says so). Section headers are buttons (`aria-expanded`), the body is `hidden` when closed. Rows: label above the control below 416 px of block width, label left of it from there (switches always on one line). Number box (unit inside the field) and slider stay in sync, the slider carries an editable value box; typed values accept a comma decimal and a typed unit, clamp to min/max, snap to step, and anything else reverts with a small inline hint (`aria-invalid`, clears on typing or after 4 s). `onChange` fires on every slider move and on commit (blur, Enter, pick, toggle) for the rest. Reset is a link per resettable section, disabled while every value equals its `default` (else the value the block was given), restores the section and calls `onReset`. Colour: a native picker with hex readout, or a palette of swatches when `options` are given. Edits, open sections and the tab are local and survive a re-render of the same config; a changed config replaces them. Max width 40 rem.
- **Keyboard**: tabs and radio groups (choice, palette) roving with arrows, Home/End; slider arrows; number box Up/Down = step (Shift = 10 steps), Esc reverts; switch Space/Enter.
- **States**: empty ("Nothing selected" without a subject), loading, error, bad config, empty tab, 60 controls, 320 and 480 px sidebars, long labels (two-three lines, then ellipsis + title).
- **Kills**: hand-built property forms with number boxes that accept anything, sliders that do not move their number, sections that cannot collapse, Reset that resets everything, labels that squeeze the control at 320 px.

## Empty / loading / error
Core provides them (`h.empty/loading/error`, `cfg.state`, `def.empty(cfg)`); every gallery shows them. Not a separate block.
