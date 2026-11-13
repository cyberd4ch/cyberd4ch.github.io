---
title: "magnets that actually work: three wire bugs, a dead tracker list, and 917 KB that finally moved"
date: 2026-11-09
category: technical
ai-assist: 100
tags: [rust, bittorrent, debugging]
topics: [development]
excerpt: "footorrent 3.5.0 — metadata before disk, a bep 10 reply read from the wrong mailbox, peers discarded at the start line, and the measured numbers after the fix."
---
*footorrent 3.5.0 — metadata before disk, a bep 10 id read from the wrong mailbox,
peers discarded at the start line, and the 917 KB in the first minute that proved the fix.*

A magnet link is four lines of text that promises a file you cannot see yet. For a long
time Footorrent treated that promise as enough: announce, connect, start writing. If
anything on the wire went sideways, the window said "fetching metadata" until you gave up.
Three separate bugs were hiding behind that one sentence, and each of them made a healthy
swarm look dead.

## metadata first, disk second

Adding a magnet is now two deliberate steps. The first contacts the swarm, fetches the
`info` dictionary over BEP 9/10, hashes it against the magnet's info hash, and reports the
real name, exact byte size, piece count and file list. Nothing is created on disk. Only
then does the window ask where the download should go.

That is not polish. The size you approve is the size you get, and a link that cannot
produce verified metadata fails while the dialog is still open instead of leaving a
half-named folder behind.

## the extension id was somebody else's

BEP 10 has each side advertise the id the *other* must use. Our requests went out under the
peer's id (often 3), but replies come back under *our* advertised id (1). The receive loop
matched the wrong number and threw every real metadata reply away. Peers were answering;
we were reading the wrong mailbox.

## routine chatter counted as rejection

A peer that sent a bitfield or an unchoke before its extension handshake was treated as not
supporting `ut_metadata`. Ordinary clients do that constantly, so magnets failed against
perfectly good peers. Both loops now ignore routine chatter, and our handshake sets the
BEP 10 extension bit so peers actually answer with theirs.

## the peers we found, thrown away

The worst one lived on the boundary between resolving and downloading. Resolving a magnet
discovered 211 peers — and then `/api/start` dropped them and re-announced to the magnet's
own tracker list. When that list was dead, the job sat at zero peers and zero bytes
forever. The peers from resolve now go straight into the session that starts the download.

## when the announce list is dead

Old magnets carry tracker lists that rot: one returns 403, one is a UDP host that never
answers, one is an I2P name that will not resolve. Asking them in sequence let the first
failure eat the whole budget, so later trackers never got a turn.

- announces go out in parallel — 8 s each, 20 s overall
- if the whole list yields nothing, well-known public trackers are tried before the DHT
- the DHT gets a second hunt when its first answer is thin, and metadata exchanges run in
  parallel batches of eight in shuffled order
- failures say how many peers were tried and what the last one said, instead of one
  misleading tracker error

The window now shows the consequence: the confirmation step says when a magnet's own
announce list did not answer and public trackers were used, every peer row carries a live
rate, and a failed resolve keeps the links in place behind a **Retry** button.

```sh
ftc serve --port 8138     # headless, prints the URL
ftc gui                   # the macOS window, same binary
```

## what it measured

A Sintel magnet carrying a deliberately dead announce list — 403, two silent UDP trackers,
one unresolvable I2P host — resolved in 17–42 s and reported:

- 129,302,391 bytes
- 987 pieces, 11 files
- 207–211 peers

Starting it wrote 917,504 bytes in the first minute at 15–26 KB/s across 6 peers. The
earlier build, on the same magnet and network, wrote nothing at all.

## what it does not fix

A dead swarm is still dead. If every peer in the DHT and every tracker refuses the
connection, the client cannot invent a source — it can only say so. That is the point of
the new error: `tried 27 of 27 peer(s): connection refused` means the swarm is gone, not
that the client is confused.

One reported magnet remains unresolved for a simpler reason: the info hash arrived
truncated, so there was nothing to query. If you hit a failure, the full 40-character hash
and the tracker list are enough to tell a dead swarm apart from a client bug.

Commits behind this post: `2fc6640` (parallel announces, public fallback, batched
metadata), `46edeb8` (hand resolved peers to the download), `9f4197c` (tracker fallback,
per-peer rates, retry). Source and binaries:
[cyberd4ch/free-torrent-cli](https://github.com/cyberd4ch/free-torrent-cli).
