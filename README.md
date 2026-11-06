# Radio IRC

A [Trunk Recorder Pro](https://trunkrecorder.pro) interface: your radio system as an IRC client.
Every talkgroup is a channel, every call a message whose text is its transcript, and the radios
affiliated with a talkgroup are the channel's nicklist. It is a port of tr-engine's IRC page, with
the same look, layout, commands and themes, fed by the recorder's own API and the transcribe
plugin.

![A channel with transcribed calls and its nicklist](screenshots/irc.png)

## What it shows

- **Channel tree** (left): each system's talkgroups as channels, in folders by the talkgroup
  file's category (under the system's name when there are several systems). A talkgroup heard
  but not in the file gets a channel named by its number. Channels with activity show; the rest
  fold into "N more...". Search, unread counts, **Read All**, a star for favourites (they gather
  in the **Starred** channel) and a scan toggle.
- **Stable tree**: a group is open or closed as you left it (remembered), never changed by activity; the
  group label shows its channel count and unread total, and ⊞ / ⊟ beside the search box open or close
  every group. Channels with unread messages are highlighted in place.
- **Unread** (pinned above the groups, only when something is unread): the channels with unread
  messages, newest first, a count each; click one to jump to it; click the header to fold it (remembered). **Read All** is in its header;
  **Alt+↓ / Alt+↑** jump to the next / previous unread channel; the tab title carries the total.
- **Emergency**: the first emergency call (the recorder's emergency flag) makes a red **Emergency** channel under
  Unread, collecting every emergency call from any talkgroup, live and from the recorder's recent history,
  with the talkgroup tagged on each line, transcripts and audio as usual. It shows an emergency even on a
  talkgroup you've ignored here (not one the recorder ignores, which isn't recorded). Its unread count is in the tab title. **✕ Clear emergencies** in its bar (or `/clear` there) dismisses it until the next emergency call; the ones before the clear are not loaded back (remembered).
- **Messages**: a recorded call is a line per keyup, the radio named; when its transcript comes
  the text replaces the placeholder, one line per segment. A call skipped or failed by the
  transcriber shows the reason, muted. A call on the air shows as the radio "typing". Scroll up
  for older calls (the recorder's call store). ▶ plays a finished call's audio.
- **Nicklist** (right): the radios affiliated with the talkgroup, as the recorder's radio
  registry has them, and those that talked; a radio that affiliates elsewhere parts and joins
  live. Click a nick for the radio's transmissions and affiliations.
- **Ignore**: 🚫 on a channel row hides that talkgroup in this browser (no messages, unread, scanner or live
  audio); with Sync on, ⛔ asks the recorder to ignore it for everyone (the talkgroup file's Ignore column).
  The channel bar has the same two buttons (lit when ignored), so you can see and flip it while the channel is open. Ignored channels fold into **Ignored (N)** at the bottom of the tree, where *show* / *record* bring them
  back. `/ignore`, `/ignore recorder`, `/unignore`, `/unignore recorder`. The tree and nicklist have
  always-visible scrollbars.
- **Channel bar**: ☆ Star adds or removes the talkgroup from Starred without leaving the channel. With control access and
  Sync on, ✎ beside the description edits it (the talkgroup file's Description column; it comes back as the
  recorder's own edit, so other browsers see it too).
- **Commands**: `/join`, `/part`, `/list`, `/who`, `/whois`, `/topic`, `/fav`, `/scan`,
  `/scanner`, `/listen`, `/volume`, `/sync`, `/ignore`, `/unignore`, `/ops`, `/readall`, `/clear`, `/reconnect`, `/api`, `/stats`, `/nerd`, `/help`.
- The theme picker at the top switches between the themes (Ctrl+Shift+T cycles them; `?theme=matrix` in the address picks one, kept like a pick). Your own themes go in a `theme-local.js` beside `index.html`, which an upgrade never touches; [theme-local.example.js](https://github.com/trunk-reporter/trp-themes/blob/main/theme-local.example.js) is one to copy. The themes are [trp-themes](https://github.com/trunk-reporter/trp-themes) 1.0.0's, pared to the variables this page uses, with the default written into the page so it is styled before (or without) the engine; `node pare.mjs <this folder>` there refreshes them.

Renaming a channel (✎) or a radio (its card's Save): see **Name sync** below. Favourites, scan list, panel widths and theme are kept in the browser too.

## Listening live

**LISTEN** in the title bar plays the calls as they happen, several at once, each talkgroup panned
to its own spot left to right so two channels talking together stay apart. Beside it:

- the **mode**: **channel** (the channel you're in), **starred** (every favourite, and the
  channel you're in) or **scan** (the scan list, and the channel you're in);
- the **volume** (0–100).

While listening the button reads `LISTENING ♪ N`, N the calls being heard now, and those
channels get a speaker mark in the tree. The mode and the volume are remembered; listening
itself starts only on a click (or a typed `/listen`), never on reload. The same from the input:
`/listen` (on/off), `/listen channel|starred|scan`, `/listen off`, `/volume N`. While it is on,
the scanner's auto-play is paused, so a call isn't heard twice; ▶ still plays a recording.

## Name sync

This interface asks for **control access**, so it can write names to the recorder and read them back:

- **Channel rename (✎)** changes the talkgroup's name in the system's talkgroup file; **a radio's Save** edits
  the system's unit names (`unitNames.csv`: one exact `unit,name` line, comments and other rows untouched).
  Edits made elsewhere (another browser, the Talkgroup & UID Editor) appear here live, and the recorder's
  name wins over one kept here.
- The **SYNC** button in the title bar (or `/sync on|off`) turns writing on and off. Off, or with only listen
  access, renames are kept in this browser, as before.
- `/sync status` counts renames kept only here; `/sync push` writes them to the recorder and clears them
  here; `/sync pull confirm` throws them away.
- **Names that collide.** A channel is named from the talkgroup's name, with spaces and punctuation turned into hyphens, so
  `29 NPD DISP` and `29-NPD-DISP` are the same channel name. When two different talkgroups end up with one, the page keeps
  the first and adds the system's name (or, within one system, the talkgroup number) to the other, e.g.
  `#29-NPD-DISP-MESA-System`. That is not a failed save: the recorder has the name you typed. To get a plain name on both,
  give the talkgroups different names (for example a `-S` on the SAFE-T one).
- **Control access lets this page change the recorder's names and config.** Anyone who can reach this
  interface's port (the recorder assigns it) can use it. Don't expose that port beyond people you trust.

## Serving it

On the recorder's **Interfaces** page, **Add a folder…** and pick this folder (or
`trunk-pro interface add <folder>`). For one run, `trunk-pro --ui <folder>`. It is served on a
port of its own with the recorder's API beside it, and asks for control access (for name
sync; with only listen access it works read-only). It loads nothing from the internet; the themes name their fonts and fall back to the
computer's own.

## Transcripts

They come from the **transcribe plugin**'s HTTP API, at `http://<this page's host>:8767` unless you
say otherwise: `/api http://host:port` in the page (remembered; `/api reset` for the default), or
`?transcribe=http://host:port` in the address (that visit only, never remembered). In the plugin's settings:

- `http.port` must be set (e.g. `8767`);
- `http.origins` must list this interface's origin, exactly as the browser shows it, e.g.
  `http://127.0.0.1:8084` and `http://localhost:8084` (the port is the one the recorder gave the
  interface). Without it the browser refuses the transcripts.

Both take effect when recording next starts. Without the plugin the page works, with no text.

Made for Trunk Recorder Pro 0.2.11 (interface API 1).

## License

MIT.
