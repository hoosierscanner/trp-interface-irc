# The IRC page as a Trunk Recorder Pro interface — the port brief

## What it is

`index.html` in this folder is a verbatim copy of `D:\reporter\web\irc-radio-live.html` (4,796 lines; `theme-config.js` and `theme-engine.js` beside it are copied too): tr-engine's IRC-style live page. Every talkgroup is a channel, every call is a message whose text is the call's transcript (one line per keyup, the radio named), the radios affiliated to the talkgroup are the channel's nicklist, a call in progress shows as someone typing, and the page has a channel tree with a system per folder, a starred channel that collects the favourites, per-channel history paging, slash commands (`/join`, `/part`, `/list`, `/who`, `/whois`, `/topic`, `/fav`, `/scan`, `/ops`, `/readall`, `/clear`, `/reconnect`, `/api`, `/stats`, `/nerd`, `/help`), a player for a finished call's audio, read-all marks, mobile drawers, and the Event Horizon theme engine. Today it is fed by trunk-reporter's REST API (`/api/v1/...`) and its SSE stream.

Port it to a **Trunk Recorder Pro interface**: a folder served by the recorder on a port of its own, fed by the recorder's own API for everything the recorder knows, and by the transcribe plugin's HTTP API for the transcripts. trunk-reporter is not needed at all afterwards. Keep the look, the layout, the behaviour, the commands and the themes. Change only what feeds it.

## The target

Repo folder: `D:\trp-interface-irc` (git, branch `main`; the copied files are its first commit). Layout per TRP's docs:

```
index.html          the page (the port)
interface.json      { "id": "irc", "name": "Radio IRC", "version": "0.1.0", "description": "Talkgroups as channels, calls as messages with their transcripts, affiliated radios as the nicklist.", "api": 1, "access": "listen", "license": "MIT", "repository": "https://github.com/trunk-reporter/trp-interface-irc", "screenshots": [{ "path": "screenshots/irc.png", "caption": "A channel with transcribed calls and its nicklist" }] }
theme-config.js     as copied
theme-engine.js     as copied, minus what reaches tr-engine (it fetches /api/v1/pages for a nav dropdown and /api/v1/health: take both out, leave the rest)
README.md           short: what it is, how to serve it (Interfaces → Add a folder…, or trunk-pro --ui), what it shows, the transcribe plugin's http.origins setting it needs
LICENSE             MIT (present)
docs/brief.md       this file
docs/port-report.md your report (see Done means)
screenshots/irc.png
```

Rules for interfaces (`D:\trunk-recorder-pro-104\docs\interfaces\publishing.md`): relative paths for its own files, absolute for the recorder's (`/api/client.js`, `/api/ws`, `/calls/…`); nothing under `api/` or `calls/`; **load nothing from a CDN or the internet** (a recorder may be offline): the Cloudflare beacon `<script>` at the end of the page goes, any Google Fonts `<link>` goes, font stacks keep their names and fall back to system fonts. No `auth.js` (the recorder's own port carries the access; delete every `authToken` use). Listen access is enough: the page changes nothing on the recorder.

## The recorder's API

Read these first, in this order:

1. `D:\trunk-recorder-pro-104\docs\api\README.md` — the guide: Quick start, Serving your interface, Access, `client.js` (`TrunkClient`, `LivePlayer`), Concepts, every message, Recorded calls (the `/calls/<path>.wav` route and `callsQuery`), Statistics and history (`radioQuery`).
2. `D:\trunk-recorder-pro-104\docs\api\client.js` — the client library the recorder serves at `/api/client.js`. Use it (`import { TrunkClient } from "/api/client.js"`), do not copy it into the folder.
3. `D:\trunk-recorder-pro-104\web\src\protocol.ts` — every message as types: `CallView` (a call on the air: `id`, `system`, `systemName`, `site`, `alsoOn`, `talkgroup`, `alphaTag`, `freqHz`, `encrypted`, `decrypted`, `emergency`, `startS`, `sources[]`, `state`), `CallEntry` / `CallRecord` (a recorded call: `path`, `record.short_name`, `talkgroup`, `start_time_ms`, `stop_time_ms`, `call_length`, `srcList[]` with `src`, `pos`, `tag`), `MonitorEventBody` (`unitAffiliated` with `system`, `unit`, `talkgroup`, `alias`), `RadioResultBody` (`radioQuery` answers: `what: "units"` rows are `UnitRow` with `unit`, `alias`, `aff` (affiliated talkgroup), `affT`, `last`; `what: "tg"` with `key` gives `affiliated[]` and `talkers[]`), the `talkgroups`, `units` and `unitAlias` messages, `callsQuery` / `callsResult`.
4. `D:\trunk-interface-omnitrunker\index.html` and `docs\port-report.md` — the previous port of a tr-engine page to a TRP interface, by the same method. Its `connect()`, `syncCalls`, `callToData`, `tgMeta`, system naming, the `activity` subscription and the replay cut-off are the patterns to reuse (copy the small helpers; don't import the file).

## The transcribe plugin's API

`D:\trunk-plugin-transcribe\README.md` § HTTP API. It runs beside the recorder at **http://127.0.0.1:8767** and answers pages from this interface's origin (its `http.origins` lists `http://127.0.0.1:8084` and `http://localhost:8084`; CORS on `GET` and `OPTIONS`, `Last-Event-ID` allowed). The base URL is a setting of the page: default `http://127.0.0.1:8767`, overridable with `?transcribe=` in the URL and remembered in `localStorage` (the `/api` command, which today shows the API base, becomes the place to show and set it). A transcript is keyed by the call's **path** (the same `CallEntry.path` the recorder uses):

- `GET /api/v1/transcripts?paths=a,b,c` — up to 200, in order (history fill);
- `GET /api/v1/transcripts/{path}` — one;
- `GET /api/v1/transcripts?system&talkgroup&from&to&before&limit` — newest first, paged by `before`;
- `GET /api/v1/search?q&system&talkgroup&...` — hits with a `snippet`;
- `GET /api/v1/events` — SSE, `event: transcript`, data a transcript, `id` its `transcribedMs`; the browser's `EventSource` resends `Last-Event-ID` on reconnect, so nothing is missed. Open it with `new EventSource(base + '/api/v1/events')` (no credentials).
- `GET /api/v1/health`.

A transcript: `{ path, system, talkgroup, startMs, lengthMs, status: "ok"|"skipped"|"failed", reason, text, language, model, transcribedMs, segments: [{ unit, start, end, text }] }`; `unit` is the radio or null. **One line per segment, the radio named** (`rec.unitName(system, unit)`, falling back to the number; null unit → the call's last talker, else "unknown"), is the message body; `text` alone when there are no segments. A `skipped` or `failed` transcript shows its `reason` muted instead of text.

## The mapping, decided

| The page today (trunk-reporter) | In the port (TRP) |
|---|---|
| `GET /systems` | `rec.config.systems` (short names, names) and `rec.status.systemNames`; system ids in the page become the **short name** everywhere |
| `GET /talkgroups?sort=alpha_tag` (channel list) | `rec.talkgroups(shortName)` per system: talkgroup → `{ talkgroup, alphaTag, description, tag, category }`; a talkgroup heard but not in the file (`alphaTag` empty) still gets a channel, named by its number |
| `GET /units?sort=alpha_tag` | `radioQuery { what: "units", system, limit: 5000 }` per system at start (`rows[].unit`, `alias`, `aff`, `affT`); names also from `rec.unitName` (the `units` / `unitAlias` messages) |
| `GET /unit-affiliations?limit=5000` (nicklists) | the same `units` rows: `aff` is the channel the radio sits in now. Live changes from the `activity` topic (`rec.subscribe(['activity'])` once after `rec` is made): `unitAffiliated` moves the nick to its new channel (a join there, a part from the old one) |
| `GET /unit-events?type=join,off` (joins/parts in channel history) | not available historically; live joins come as above; "off" is not carried by the interface API. Drop the history join/part rows; keep the live ones |
| bootstrap `GET /calls?limit=500&start_time=since` | `rec.history` (≤ 300 `CallEntry`, newest first) on `hello`; older via `callsQuery` |
| channel history `GET /calls?tgid&system_id&sort=-stop_time&limit&end` | `callsQuery { system, talkgroup, limit, cursor }` (`rec.send` + the matching `callsResult` by `id`; see the guide); `next` is the cursor for the older page. The starred channel's history is one `callsQuery` per starred talkgroup, merged by time, as the page does today per talkgroup |
| SSE `call_start` / `call_update` / `call_end` | `rec.status.calls` on each `change`: a call that appears starts the typing indicator and the message, new `sources[]` entries are new talkers, one that disappears is the end. `CallView.id` keys the live message. Replay cut-off as in OmniTrunker: calls already on the air at connect are not "new" |
| SSE `unit_event` (the `call` kind: a talker) | each call's `sources[]` as it grows |
| the message's `call_id` | live: `CallView.id`; recorded: `CallEntry.path`. A live message gets its **path** when its `concluded` arrives: the entry with the same `record.short_name`, `talkgroup`, and `start_time_ms` within 3 s of the live call's start (the first match wins; a second copy of the same call from another site, same `transmission_id`, is ignored). History messages have the path from the start |
| SSE `transcription` | the transcribe plugin's SSE `transcript`: find the message by `path` (live or history); a transcript whose message isn't on the page yet is kept in `pendingTranscriptions` (as today) until the `concluded` gives the message its path |
| `GET /calls/{id}/transcription`, `GET /transcriptions/batch?call_ids` | `GET {transcribe}/api/v1/transcripts?paths=` for a page of history (≤ 200 a request), `/transcripts/{path}` for one |
| `GET /calls/{id}` (detail in `/nerd` and the call popup) | the `CallEntry` already in hand (its `record`), or `GET /api/v1/calls/<path>` from the recorder |
| `GET /calls/{id}/audio` | `/calls/<path>.wav` from the recorder (URL-encode each segment); a live call has no file yet: the play button appears when the message has a path |
| `rate_update` (decode rate in the title bar) | the recorder's `stats` message: `sys/<short>/cc/good` summed over systems (or leave the figure out if it costs more than a few lines) |
| `PATCH /units/{id}`, `PATCH /talkgroups/{id}` (renaming a nick or a channel) | the page cannot write to the recorder with listen access: keep the renames in `localStorage` only (`irc-names` key), applied on top of the recorder's names; say so in the README |
| `/stats` | `radioQuery { what: "summary" }` |
| `/scan`, `/scanner` | whatever they do today that still makes sense without audio streaming; if they only drove tr-engine's scanner, make them print "not in this version" |
| `auth.js`, `authToken`, Cloudflare beacon, the `card-*` meta tags | removed; title "Radio IRC" |

Keep: the channel tree, the nicklist, the message rendering (dates, unread marks, typing), channel switching and the starred channel, history paging, the commands, the audio player for finished calls, read-all, mobile drawers, the themes (`theme-config.js`, `theme-engine.js`), settings persistence in `localStorage` (own origin, keys need no prefix change).

## How to work

- Read the page end to end once (CSS, HTML, the script's sections: HELPERS, CHANNEL MANAGEMENT, MESSAGE RENDERING, TYPING INDICATOR, CHANNEL TREE, NICKLIST, CHANNEL NAME EDITING, CHANNEL SWITCHING, the API FETCHING and SSE sections, EVENT HANDLERS, commands, STATUS BAR, AUDIO PLAYER, READ ALL, MOBILE DRAWERS), then the API guide and `client.js`, then OmniTrunker's `index.html`.
- Build it as a port, not a rewrite: keep the page's own functions where the data still fits; replace `connectSSE()`, `fetchJSON` and its callers, the transcription fetches and the audio URL. Where a field no longer exists, adapt the small helper that read it rather than the renderers. The page's internal shapes (`{ call_id, system_id, tgid, unit_id, ... }`) may stay: write adapters from `CallView` / `CallEntry` / transcript to them, as OmniTrunker's `callToData` does.
- No build step, no bundler, no framework: plain HTML/CSS/JS. `<script type="module">` for the part that imports `client.js`.
- The recorder is running at **http://127.0.0.1:8080** (three sites of the `marcs` system, busy) and already serves this folder at **http://127.0.0.1:8084/** (a reload shows every edit). The transcribe plugin is at http://127.0.0.1:8767 and transcribes calls as they finish (a transcript arrives some seconds after each call). **Never start a second recorder; don't touch the recorder's config or anything outside this folder.**
- Check it live in the browser (the claude-in-chrome tools; load them in ONE ToolSearch call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp`; call `tabs_context_mcp` first; open http://127.0.0.1:8084/ in a new tab; close your tabs when done): it connects; the tree lists the systems and their talkgroups with names; joining a busy channel (the Hamilton County dispatch talkgroups are the busiest) shows history messages with transcripts filled in; a new call shows typing then a message, and within a minute its transcript text replaces the placeholder, one line per keyup with the radio named; the nicklist has radios and moves one on an affiliation (about 7 a minute on this system across talkgroups); the play button plays a finished call's audio; `/who`, `/whois`, `/stats`, `/fav` and the starred channel, history paging ("load older") and the themes work; no console errors; the only hosts requested are the page's own and 127.0.0.1:8767.
- Take a screenshot of a working channel into `screenshots/irc.png` (about 1280 × 800).
- Commit in small steps on `main` with exactly this trailer after a blank line (`git commit -F -` with a heredoc):

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JXUSP15Bo9JgvCdvA3xtZW
```

## Done means

- Everything above works against the live recorder; `interface.json` as above; README written; no CDN/internet request; no `auth.js`.
- `docs/port-report.md`: how each piece was mapped, what could not be carried over and why, how it was tested and what was seen (numbers), the commits, concerns. Also a copy of the report's summary at `C:\Users\drewm\AppData\Local\Temp\claude\D--trunk-recorder-pro\21e10349-b74d-4d44-aa29-08c26e715dcb\scratchpad\irc-port-report.md`.
- Return only: status (DONE / DONE_WITH_CONCERNS / BLOCKED), the commit list, one line of test summary, concerns.

Don't dispatch subagents.
