*shipping a torrent client's ui without electron: a hand-written http server, html
compiled into the binary, cancel and pause moved into the engine, and the favicon bug
that explained why 204 is not an icon.*

A CLI is a fine interface right up until you want to hand something to a person who
does not live in a terminal. The usual answer is Electron, which turns a 3 MB download
into 120 MB and asks the user to trust a second bundled Chromium. For a BitTorrent
client that trade is embarrassing.

So the client serves a page, and the page is compiled into the binary.

```sh
ftc gui     # native window on macOS; browser elsewhere
ftc serve   # same server, headless, prints the URL
```

## the server is 300 lines you can read

`http.rs` implements exactly enough HTTP/1.1 to serve a local single-page app: request
line, headers, `Content-Length`, form bodies, a response with a content type. No
keep-alive, no chunked encoding, no TLS, and it binds loopback unless `--bind` says
otherwise.

The UI is one `ui.html` embedded with `include_str!`, so the shipped binary and the
shipped page cannot disagree — that class of bug does not exist here. The JSON API is
five endpoints, and every number in the page comes from the same `Arc<Progress>`
atomics the terminal progress bar reads.

## cancel and pause belong in the engine

The first Cancel button just dropped the job from the list. The download kept running.
That is not a cancellation; it is a lie with a `fetch` call.

The fix moved control into the session: `stop_handle()` returns a flag checked at each
checkpoint, and `pause_handle()` parks the workers between blocks. A paused job stops
touching the network within one block and keeps every verified piece. The test starts a
run paused, resumes it 400 ms later, and asserts the download only finished after the
gate opened — the timing *is* the assertion.

## two bugs worth writing down

**`favicon.ico: 404`.** The route existed and answered `204 No Content`, and the page
declared no icon. Browsers ask anyway, a `204` is not an icon, so the console logged a
failure. The fix serves a real SVG at `/favicon.ico` *and* declares a `data:` icon, so
the request never happens.

**A path that did not exist.** Typing a new directory into the output box failed the
job; it is created now. The larger point: a torrent client downloads torrents — a
magnet or a `.torrent`. An `https://…/file.pdf` URL is not a target, and saying so
plainly beats a cryptic failure.

## the rate limit is one bucket

`--limit 2M` caps a download. Inside each worker it would mean six peers at 2 MB/s
each. The bucket is shared instead: every block reserves its transfer time before the
request goes out, so the number on the flag is the aggregate. Six peers, 2 MiB/s total.
An unparseable rate is a `400`, not a silently unlimited job.

## the window

A browser tab is not an app. On macOS the release now ships `ftc.app`: 87 KB of Swift
(`gui/macos/main.swift`) that starts `ftc serve` on a free loopback port, reads the URL
it prints, loads it in a `WKWebView`, and terminates the child on quit. Same binary
inside, same page, a real menu and Cmd-Q. Released as `ftc-macos-app.zip` and installed
to `~/Applications` by `install.sh`, which falls back to a browser launcher for older
releases.

The archive lesson came free: bare binaries lose their executable bit on download, so
every release ships `.tar.gz`/`.zip` plus `SHA256SUMS`, and the installer verifies the
hash before installing anything.

## the bill

The binary is 3.1 MB with six dependencies, unchanged: `sha1`, `hex`, `rand`, `ureq`,
`base32`, `percent-encoding`. 51 tests. The macOS window adds no Rust dependency at
all — it is compiled by the installer and by CI, not linked into the engine.

The flaky test that kept failing once in four runs turned out to be a real discovery
bug: the DHT hunt stopped reading replies as soon as one peer answered, so in-flight
`get_peers` responses never recorded their tokens and `announce` reached one node
instead of two. Forty consecutive isolated runs now pass, and the failure message
names the token-holder count.
