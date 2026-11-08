*the page was a form and a stack of cards. now it is a download manager: categories,
a sortable table, batch actions, drag-and-drop, a speed graph — still one binary, still
no framework, still no build step.*

The first version of the ftc web UI proved a point: a Rust binary can serve a page, and
that page can show real progress because it reads the same `Arc<Progress>` atomics the
terminal does. It was also not something anyone would choose to use. Three inputs in a
row, then a vertical stack of cards, one Cancel button each. That is a demo.

A download manager is a different artifact. Free Download Manager, and every tool in
that family, converges on the same shape: categories down the left, a dense sortable
table in the middle, a toolbar that acts on a selection, a details pane, a status bar.
That shape is not decoration — it is what makes twenty downloads legible at once.

So the page got rebuilt around it.

## the same page, in both places

There is one `ui.html`, embedded with `include_str!`. The browser tab and the macOS
`WKWebView` window load the same bytes. No framework, no bundler, no `node_modules` —
because the alternative is a build step between "fix a bug" and "ship the fix", and
this project's whole claim is that a user installs one file.

The layout is CSS grid, not a table: one `--cols` custom property defines the nine
columns, the header and every row share it, and a media query drops peers and age below
980 px by hiding two classes. The header is `position: sticky`, the rows are a flex
column of grids, and the whole thing stays under 70 KB uncompressed.

## state is one object, and actions resolve late

The page keeps one `app` object: jobs, totals, settings, filter, search, sort, the
selected ids, the job shown in the details pane. Every second it polls `/api/state`,
recomputes the visible view (filter → search → sort), and re-renders. No virtual DOM,
no diffing — just `replaceChildren` on the rows container, which is fast enough for the
dozens of jobs a desktop client actually holds.

The interesting decision is what a toolbar button acts on. If anything is selected, the
action applies to the selection. If nothing is selected, it applies to every job in the
current view that the action can affect — Pause is disabled when nothing in view is
downloading, Retry only counts failed or stopped jobs, Remove only sees finished ones.
That is the behaviour a file manager trains people to expect, and it means "stop
everything I am looking at" needs no extra button.

## the API grew to match the interface

A manager needs verbs a demo does not. `pause`, `resume` and `cancel` now take
`id=`, `ids=1,2,3` or `all=1`. `remove` drops finished jobs from the list
(`finished=1` clears them), `retry` queues a failed or stopped job again with its
original folder and cap, and `reveal` opens the file or folder in Finder, Explorer or
`xdg-open`. `GET`/`POST /api/settings` reads and writes the default folder and speed
limit, so Preferences changes what the next download does instead of only the current
one.

`/api/state` grew `version`, `settings`, `totals`, and per job `path`, `percent`,
`added`, `finished` and verified/total pieces. Every one of those exists because the
table or the details pane needed it — not because a schema looked tidy.

## drag-and-drop is an encoding problem

A browser cannot tell the server where a dropped file lives. It never has. So the file
is read as an `ArrayBuffer`, base64-encoded in 32 KB chunks to avoid blowing the
argument limit on `String.fromCharCode`, and posted to `/api/add-torrent`. The server
decodes it with sixty lines of base64 (no new dependency), rejects anything that is not
base64 or is larger than 8 MB, writes it into the temp folder under a sanitized name,
and queues it like any other torrent. Once the worker has parsed the file, the copy is
deleted — a dropped torrent does not need to survive the parse.

Dropping a magnet link or a `.torrent` path works too: the drop handler reads
`text/plain` when there are no files, splits it, and posts each target.

## the window that would not let go

The macOS app starts `ftc serve` as a child and terminates it on quit. Testing the
release bundle with `kill` showed the child still listening afterwards. Five of them had
accumulated over a day of runs — each holding a loopback port and a job queue nobody
could see.

The cause is AppKit, not the Rust: `applicationWillTerminate` runs for the framework's
own quit path (Cmd-Q, closing the last window) and not for `SIGTERM`. Logout sends
`SIGTERM`. `kill` sends `SIGTERM`. So the window closed and the server stayed.

The fix is a `DispatchSourceSignal` for `SIGTERM`, `SIGINT` and `SIGHUP` that runs the
same `stopServer()` as Quit: terminate, wait up to a second, escalate to `SIGKILL` if
the child is still alive. Verified by starting the app three times and sending one
signal each — page `200` before, no listener and no child after.

## what is verified, and what is not

59 tests (20 in the CLI, 39 in the engine) cover the engine and the new API: settings
round-trips, batch pause/resume leaving finished jobs alone, remove refusing a running
job, retry creating a new id, reveal reporting a missing job, base64 decoding, and an
uploaded torrent queueing with the right name and size. The page script is checked with
`node --check`, and every endpoint was exercised against a live server.

What I cannot show you is a screenshot. macOS screen capture and window enumeration are
both blocked by TCC in this environment, so the visual side is asserted structurally —
the markup, the CSS custom property, the rendered script — not by looking at pixels.

## the cross-platform part

The engine is std-only but socket-heavy, and "works on my Mac" is not a compatibility
claim. The test workflow now runs on Ubuntu, macOS and Windows. A second workflow,
`smoke.yml`, runs after every release and does what a user does: download the archive
for the platform, verify it against `SHA256SUMS`, run `--version`, start `serve`, read
`/api/state`, fetch the page, confirm a missing torrent surfaces as a job error, and
stop the server. Same commands, three operating systems.

The interface did not get a second implementation to be cross-platform. It got one page
and three places to prove the binary behind it runs.
