# Radio IRC, round 2: live listening

Repo: `D:\trp-interface-irc` (git `main`, clean, pushed to https://github.com/trunk-reporter/trp-interface-irc; the interface is `index.html`, plain HTML/JS, no build step). Read `docs/port-report.md` first (how the page is fed), then the parts of `index.html` named below. `docs/brief.md` is round 1's brief, for the rules (no CDN, listen access, relative paths, trailer).

The recorder runs at http://127.0.0.1:8080 (the `marcs` system, three sites, busy) and serves this folder at **http://127.0.0.1:8084/** (a reload shows every edit). Its API guide: `D:\trunk-recorder-pro-104\docs\api\README.md` ("Live audio", "new LivePlayer(opts?)"); the client library it serves at `/api/client.js` is `D:\trunk-recorder-pro-104\docs\api\client.js` and the served copy has everything named here. **Never start a second recorder; don't touch its config or anything outside this folder.**

## What to build

Today the page plays finished recordings only (the play buttons and the `/scan` queue). Add **live listening**: hear the calls as they happen on the channels you choose, several at once, each talkgroup panned to its own spot so two channels talking together stay apart.

The recorder's side: `rec.listen()` (no filter) makes the recorder send every call's audio as `audio` chunks (`{ callId, system, talkgroup, samples }`); for several talkgroups the guide says to listen to everything and drop the chunks you don't want. `LivePlayer` from `/api/client.js`: options `followCall` (false here), `quietS`, `gain`, `pan` (-1…1), `context` (a shared `AudioContext`), methods `resume()`, `play(chunk)`, `setGain(v)`, `setPan(v)`, `stop()` (with a shared `context`, `stop()` releases only the player's nodes); `nowPlaying` is `{ callId, system, talkgroup }` or null.

The pattern to copy is OmniTrunker's round 3, `D:\trunk-interface-omnitrunker\index.html` (search `sharedCtx`, `players`, `panFor`, `dropPlayer`, `rec.on('audio'`, `setVolume`, `setAutoPan`, `_omniAudio`): a shared `AudioContext` made on the user's click, one `LivePlayer` per call on the air in a `Map<callId, …>`, created on the first chunk for that call with `{ followCall: false, gain, pan: panFor(talkgroup), context: sharedCtx }` and `resume()`d once, dropped when its call leaves `rec.calls` (`syncCalls`) or when `nowPlaying` has been null past `quietS`; master volume → `setGain` on all; `panFor(tgid)`: `h = ((tgid * 2654435761) >>> 0) % 10000; pan = -0.8 + (h / 10000) * 1.6`.

The design, decided:

- **A LISTEN control in the title bar** (`#titlebar`, beside `#titlebar-lag`): a button that reads `LISTEN` / `LISTENING` (a headphones glyph is fine, inline SVG or text, no icon font from the internet), a mode `<select>` beside it with **channel** (the channel you're in), **starred** (every favourite, and the one you're in), **scan** (the `/scan` list, `scanChannels`, and the one you're in), and a volume slider 0–100 (default 80, the same gain mapping OmniTrunker uses). Starting listening is the click (the gesture that makes the `AudioContext`); it is never resumed on reload. Mode and volume are saved in `localStorage` (`irc_listen_mode`, `irc_volume`).
- **Which chunks play:** when listening, an `audio` chunk plays when its `system:talkgroup` is in the wanted set for the mode; the set is recomputed on channel switch, favourite toggle, scan toggle and mode change (`dropUnwantedPlayers()` as in OmniTrunker stops players whose talkgroup fell out of the set). The status channel and the starred meta-channel count as "no channel of your own" (then only the mode's set applies).
- **Commands:** `/listen` toggles listening (needs to be typed, which is a gesture); `/listen channel|starred|scan` sets the mode (and starts listening if off); `/listen off`; `/volume N`. `/help` lists them.
- **The scanner and live audio:** while live listening is on, the `/scan` queue's auto-play (`scannerEnqueue`) is suspended so a call is not heard twice; the play buttons still work (that is the listener's own click; the shared context is separate from `audioEl`). Say so in the `/scan` output and in `/help`.
- **What the page shows:** the channel rows in the tree whose talkgroup is being heard right now get a class `audible` (a small speaker glyph after the name, `color: var(--irc-success)` or the theme's accent); the title bar's LISTEN button shows `♪ N` with N the players whose `nowPlaying` is set; in a channel being heard, the talker's line (the typing/live line that exists today) is the one that is talking, nothing new needed.
- **`window._ircAudio`:** `{ listening(), mode(), wanted() (the set as an array), debug() }` with `debug()` returning `{ contextState, mode, volume, players: [{ callId, talkgroup, pan, nowPlaying }] }`, for the live check.
- Volume and mode changes take effect on the running players at once; listening off stops and drops every player and closes the context; `rec.listen(false)`.

## Check live, in the browser

The claude-in-chrome tools; load them in ONE ToolSearch call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp`; call `tabs_context_mcp` first; open http://127.0.0.1:8084/ in a new tab; close your tabs when done. Join `#09-9-ALPHA` (busy), click LISTEN in mode **channel**, and within a minute confirm with `javascript_tool` and `_ircAudio.debug()` that a player exists for a call on that talkgroup with the shared context running, that no player exists for other talkgroups, that it goes when the call ends; switch to **starred** (star a second busy channel, e.g. `#31-MAIN-DISP`) and see players for both talkgroups at once with different pans; set the volume and see every player's gain change; `/listen off` leaves no players and a closed context; the tree marks the audible rows; the scanner stays quiet while listening; no console errors; no request to any host but the page's own and 127.0.0.1:8767.

## Done means

- Everything above works against the live recorder; `interface.json` version `0.2.0`; README gets a short "Listening live" section (the button, the modes, the commands, the pan); `docs/port-report.md` gets a "Round 2" section: what changed, how it was tested, what was seen (numbers), concerns.
- Commits in small steps on `main` with exactly this trailer after a blank line (`git commit -F -` with a heredoc), the model name verbatim:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JXUSP15Bo9JgvCdvA3xtZW
```

- A copy of the round 2 report section at `C:\Users\drewm\AppData\Local\Temp\claude\D--trunk-recorder-pro\21e10349-b74d-4d44-aa29-08c26e715dcb\scratchpad\irc-round2-report.md`. Return only: status (DONE / DONE_WITH_CONCERNS / BLOCKED), the commit list, one line of test summary, concerns.

Don't push. Don't dispatch subagents.
