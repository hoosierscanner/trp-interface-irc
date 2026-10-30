# Radio IRC port: report

tr-engine's `irc-radio-live.html` ported to a Trunk Recorder Pro interface (recorder 0.2.11,
interface API 1). Same layout, look, commands, behaviour and themes; everything the recorder knows
comes over its connection (`/api/client.js`), the transcripts from the transcribe plugin's HTTP
API. trunk-reporter is no longer needed.

## Summary

- **Status:** done; works against the live recorder (`marcs`, three sites) and the plugin.
- **How:** the page's own functions kept where the data fits; the fetch/SSE layer replaced by
  adapters (`entryToCall`: `CallEntry` to the page's call shape; live calls from `rec.calls`).
  The main script is now `<script type="module">` importing `TrunkClient` and `systemName`.
- **Tested live:** 6,650 talkgroups as channels; 300 history calls in 38 channels; 2,292 nicks
  from 5,000 radios; history pages with transcripts (88 to 188 lines in `#09-9-ALPHA`, back to
  18:29); typing, then the message, then its transcript about 1 s after the recording; joins on
  affiliation; audio played; `/who`, `/whois`, `/stats`, `/fav`, the starred channel, 11 themes;
  no console errors; only `127.0.0.1:8084` and `127.0.0.1:8767` requested.
- **Concerns:** see the end (radios capped at 5,000; "online" is a heuristic; trailer model name).

## How each piece was mapped

| tr-engine | Port |
|---|---|
| `GET /systems` | `rec.config.systems` + `conventional` (`loadSystemNames`); `system_id` is the **short name** everywhere (channel keys, favourites `marcs:9139`, scan list, renames). The config's `name` (`oh-marcs`) is what is shown (tree header, unit card). |
| `GET /talkgroups` | `rec.talkgroups(short)` at `hello` (`bootstrapChannels`): `alphaTag`, `description`, `tag`, and `group` (client.js's name for the category) as the tree folder. With several systems the folder is `System / Category`. A talkgroup not in the file gets a channel named by its number (`ensureChannel` falls back to `String(tgid)`; `talkgroupChannel` makes one on first sight). Later `talkgroups` / `talkgroupEdited` add channels and update topics (`refreshTalkgroups`). |
| `GET /units`, `GET /unit-affiliations` | `radioQuery { what: "units", system, limit: 5000 }` (`bootstrapUnits`): `alias` seeds nicks; `aff` puts the radio in that channel's nicklist (`affiliated: true`). Otherwise names come from `rec.unitName`, then `srcList[].tag` (`resolveNick` asks `recUnitName` when given none). |
| SSE `unit_event` (join/off/on/call/end) | `monitorEvent unitAffiliated` (the page calls `rec.subscribe(['activity'])` once): a part from the channel it was affiliated with (`unitAffChannel`), a join in the new one (`handleAffiliation`, with the old 10 s multi-site dedup). Talkers come from `sources[]`. |
| `GET /unit-events?type=join,off` (history) | Dropped: not carried by the interface API (`unitEventsToMessages` removed). |
| bootstrap `GET /calls?...` (30 min) | `rec.history` at `hello` (`bootstrapRecentCalls`). After a reconnect, the history's calls since the drop minus 60 s go through `handleConcluded` (dedup by path). |
| channel history `GET /calls?tgid...&end_time` | `callsQuery { system, talkgroup, limit: 50, cursor }` (`queryCalls`, matched to its `callsResult` by id; ids start at 100000, clear of client.js's). The first page uses `to` = the oldest call start shown (`ch.oldestStartMs`), then `next` as `cursor`; no `next` means exhausted. |
| starred history | One `callsQuery` per starred talkgroup (`to` = the oldest shown), merged by time, as before. Keys are `short:tg`, split at the last `:`. |
| SSE `call_start` / `call_update` / `call_end` | `syncCalls` on each `status` / `state`, keyed `CallView.id:talkgroup` (ids restart with the recorder). New: typing, emergency notice, `[encrypted]` line. New `sources[]`: nicklist and typing (kept up while on the air). Gone: the message. Calls already on the air at the first status after a `hello` are `preexisting`: no typing or live line; their recording is shown when it comes. Calls followed but not recorded (`state: monitoring`, not encrypted) show nothing. |
| the message's `call_id` | Live: the `CallView` key. A call that leaves the air before its `concluded` gets a line per talker with "…" and no play button (`awaitingPath`, 60 s). On `concluded`, the live call with the same short name and talkgroup and a start within 3 s (first match): still on the air, it is shown from the recording when it ends; already ended, its lines are replaced in place (`upgradeLiveMessages` / `replaceCallMessages`, starred copies too). Unmatched entries are shown as recorded. A copy whose `transmission_id` is already shown under another path is ignored (`isDuplicateCopy`). |
| SSE `transcription`, `GET /calls/{id}/transcription`, `/transcriptions/batch` | The plugin's SSE `transcript` (`new EventSource(base + '/api/v1/events')`) and `GET /api/v1/transcripts?paths=` for history (50 paths a request), both into `applyTranscript`: found by path in its channel and the starred channel, else kept in `pendingTranscriptions` (up to 500) until the messages come. `ok` with segments: the call's lines are replaced by **one line per segment**, the nick from the segment's `unit` (null: the call's last talker, else `unknown`), its time and play position from `start`/`end`. No segments: the text on one line. `skipped` / `failed` / `empty` / `rejected`: `[status: reason]`, muted, on the first line (new CSS `.voice-text.muted`). |
| `GET /units/{id}`, `/units/{id}/events` (unit card) | `radioQuery { what: "unit", key }`: state, affiliated talkgroup, transmissions, first/last seen; its `recent` transmissions and `affiliations` as the card's events. |
| `GET /calls/{id}/audio` | `/calls/<path>.wav`, each segment URL-encoded; the play button only when the message has a path and `audio !== false`. |
| `rate_update` | `stats`: `sys/<short>/[site/<site>/]cc/good` summed, "decode: N msg/s". |
| `PATCH /units`, `PATCH /talkgroups` | `localStorage['irc-names']` `{ tg: {"short:tg": name}, unit: {"short:unit": name} }`, applied in `ensureChannel` / `resolveNick`. An empty unit name, or a channel renamed back to the recorder's name, removes the rename. The README says so. |
| `/stats` | Local counts plus `radioQuery { what: "summary" }` per system. |
| `/scan`, `/scanner` | Kept: they queue *recorded* calls' audio (`enqueueRecorded`, by path); no streaming needed. |
| `/api` | Shows the recorder and the transcribe base; `/api <url>` sets it, `/api reset` restores the default `http://127.0.0.1:8767`; `?transcribe=` overrides; kept in `irc_transcribe`. |
| `/reconnect` | Reopens the transcript stream (the recorder's connection reconnects by itself). |
| `auth.js`, Cloudflare beacon, `card-*` meta | Removed; title "Radio IRC"; the theme header's title via `THEME_ENGINE_OPTIONS`. |
| `theme-engine.js` | The `/api/v1/pages` and `/api/v1/health` fetches removed (OmniTrunker's change, copied). |

Also: `renderTree` is coalesced to one render a frame (`renderTreeNow`), as this system adds
several messages a second across 6,650 channels; and the nonexistent `renderMessages()` call on
an encrypted call's end is now `refreshMsgEl`.

## What could not be carried over, and why

- **Join/part/quit rows in history** and **registrations (on/off)**: the interface API has no
  historical unit events and no registration events; only live affiliations come.
- **Writing names to the recorder**: listen access; renames are per browser.
- **Online/offline**: with no registration feed, a radio is "online" when it is not deregistered
  (`reg !== false`) and was heard in the last hour; the rest are dimmed.
- **Radios beyond 5,000**: `radioQuery units` returned 5,000 of about 6,550 radios heard in 24 h
  (a limit of 10,000 also gave 5,000), so about 1,500 radios get no nick seed or nicklist place at
  start; they appear when they talk or affiliate.

## How it was tested

In the browser (Claude in Chrome) at `http://127.0.0.1:8084/`, against the running recorder (no
config change, no second recorder):

- Status channel: connected to 0.2.11; 6,650 talkgroups, 6,650 channels; 300 recent calls in 38
  channels; "marcs: 5000 of 6584 radios heard in 24 h"; 2,453 nicks seeded; 2,292 users (802
  online, 1,490 offline); transcript stream connected.
- `#31-MAIN-DISP`: 96 lines, 45 with transcript text, 48 muted reasons (`[skipped: too short]`,
  `[skipped: silent]`), nicklist 22/46.
- `#09-9-ALPHA` live, watched for 25 s: "09_MED_152 is typing..." refreshed every ~0.5 s, then
  the message with its path (▶ 2.9s), then at once its transcript line "Medical 153 is
  available returning". A call that ended before its recording showed "…" and was replaced
  when the recording came.
- Affiliations: a second connection saw `unitAffiliated` for 3104594 to 55650 and 3121362 to
  21021; `#31-DIST-2` and `#31-FD-EAST` showed the joins ("31_CPD_4594 has joined #31-DIST-2 [Law
  Dispatch]"); `/whois` put each in the new channel only.
- Paging: scrolling to the top twice took `#09-9-ALPHA` from 88 to 188 lines (18:55 back to
  18:29), 159 with transcript text.
- Audio: a real click played a call (0:05 / 0:09, the line highlighted).
- `/fav` on two channels, then Starred: 22 lines from both (origin tags), nicklist 55/87.
- Unit card: state, transmissions 608, first seen 23 h ago, events "call ×30 09-9 ALPHA". Renamed
  to "Ninth Com": the nicklist and 5 message nicks changed and `irc-names` was saved; clearing it
  brought back `09_9COM2`.
- `/stats` printed the registry summary (385 talkgroups, 6,594 radios, 1,432 in the last hour);
  `/api` showed both bases.
- Themes: all 11 applied (background and font stack change).
- Console: no errors. Network after a reload: `/`, `theme-config.js`, `theme-engine.js`,
  `/api/client.js` (and the WebSocket) on :8084; transcript batches and `/api/v1/events` on
  :8767; nothing else.

Not tested: a reconnect (the recorder was not restarted), the scanner's auto-play, emergency and
encrypted live calls (none seen), phone width and the drawers, several systems or a conventional
one.

The screenshot (`screenshots/irc.png`, 1280 × 800) was taken with headless Edge at that size
(the browser window could not be made that size), after `/join 09-9-ALPHA`.

## Commits

- e8beb4c Themes: drop the engine's tr-engine fetches (page list, update badge)
- ebe07a4 Port the page to the recorder's API and the transcribe plugin
- 8d995ad interface.json, README and the screenshot
- (this report)

## Concerns

- **Commit trailer:** the brief's trailer names "Claude Fable 5.1"; the work was done by Claude
  Opus 5.5, so the commits say `Co-Authored-By: Claude Opus 5.5` with the brief's session line.
  Amend if the brief's exact text is wanted.
- The **5,000-radio cap** and the **online heuristic** above.
- The bootstrap notices ("Now talking on…", the topic) sit between older history (prepended by
  paging) and newer calls, as in tr-engine.
- The screenshot shows live talkgroup and radio names (public RadioReference data).
- The `repository` (github.com/trunk-reporter/trp-interface-irc) does not exist yet; nothing was
  pushed.
