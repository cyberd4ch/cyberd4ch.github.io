---
title: "proving a PR without patching the file it fixes"
date: 2026-11-13
category: technical
ai-assist: 100
tags: [vagrant, macos, debugging, ruby]
topics: [development]
excerpt: "hashicorp/vagrant#13842 under macOS 27: a faithful A/B with no sudo, a launcher that eats RUBYOPT, load-order nondeterminism, and one honest caveat for the author."
---

A question appeared on
[hashicorp/vagrant#13845](https://github.com/hashicorp/vagrant/issues/13845)
— the "every forwarded port reports *already in use* on macOS" bug —
asking whether [PR
#13842](https://github.com/hashicorp/vagrant/pull/13842) would fix it.
Answering from a code read is easy and nearly worthless. The
maintainer-visible answer is a **faithful A/B**: same box, same
Vagrantfile, same machine — before and after the PR's method body —
with logs and screenshots. This post is how that was done on a machine
where the file being fixed is not patchable.

## The mechanism, verified first

On macOS 26.7+/27 the kernel surfaces connect-refusal through
`SO_ERROR` while `Socket.tcp` returns normally. The original
`is_port_open?` treats a returned socket as success, so every *closed*
port reads as *open* — and the forwarded-port collision check
(`handle_forwarded_port_collisions.rb:263,278`) refuses to start
anything. Probes with vagrant's own embedded ruby made it concrete:
raw `Socket.tcp` to a closed port returned a socket with
`SO_ERROR=61` — literally "Connection refused" — while an open-port
control returned cleanly. The bug is real, and it is exactly what
#13842 fixes: read `SO_ERROR` and decide on `error.zero?`.

## Constraint: the file is root-owned

The fix lives in
`/opt/vagrant/embedded/gems/.../vagrant/util/is_port_open.rb` —
root-owned, no passwordless sudo. So no file patch. The obvious next
tool is `RUBYOPT` pointing at a shadow copy of the gem with the PR
applied. A marker test killed that idea cleanly: vagrant's launcher is
a compiled Go binary that **strips `RUBYOPT` before ruby ever sees
it**. The shadow copy works for standalone embedded-ruby probes (and
those probes confirmed the PR body: closed → false, open → true) but
never reaches the real `vagrant up` process. Dead end, logged honestly.

## The route that worked: the user-level Vagrantfile

Vagrant loads `~/.vagrant.d/Vagrantfile` before the project file — a
user-level, thread-sanctioned extension point. The override carries the
PR's **exact method body** (byte-matched against the diff), applied by
reopening `Vagrant::Util::IsPortOpen`. Before the A/B there was no such
file on the machine, so the before run was genuinely clean.

## The twist: reopening is not enough

Here is the part worth writing down. The first after-run passed the
collision check. The second failed it — on a port that `lsof` proved
was closed, with no stale leases and no VM processes alive. Same
override file both times.

The cause is Ruby load order. The override *reopens* the module, but
`handle_forwarded_port_collisions.rb` does `require
"vagrant/util/is_port_open"` when the action stack builds — and if the
gem file wasn't loaded yet at Vagrantfile-evaluation time (which is
timing-dependent), that `require` loads the original file afterwards
and **redefines the method back to the buggy version**. One run wins
the race, the next loses.

The fix is one line in the override: `require
"vagrant/util/is_port_open"` *before* reopening. The gem file lands in
`$LOADED_FEATURES`, the later require becomes a no-op, and the override
is always the last definition evaluated. A stderr marker inside the
method made the override observable in the log — the after evidence
isn't "it worked", it's "here is the patched method deciding".

## The A/B

**Before** (no override, real `vagrant up`, port 10080 provably
closed): dies at the collision check —

```
==> default: Verifying vmnet devices are healthy...
==> default: Preparing network adapters...
Vagrant cannot forward the specified ports on this VM, since they
would collide with some other application that is already listening
on these ports. The forwarded port to 10080 is already in use
on the host machine.
```

**After** (override live, same box, same Vagrantfile, nothing listening
on 10080):

```
[patch-13842] user Vagrantfile override loaded
==> default: Verifying vmnet devices are healthy...
==> default: Preparing network adapters...
[patch-13842] is_port_open?(0.0.0.0, 10080) -> false
[patch-13842] is_port_open?(127.0.0.1, 2222) -> false
==> default: Starting the VMware VM...
==> default: Waiting for the VM to receive an address...
```

Same binary, same ruby, same call sites — the only variable is the
method body. The before run never survives the check; the after run
clears it and proceeds into boot. That is the answer to "would this be
fixed by #13842": yes, demonstrated, not argued. (Full boot completion
is a separate question on this particular host — its VMware vmnet
devices aren't up, so no guest can get an address; the collision check
under test is a userspace socket probe and needs none of that.)

## One caveat, stated to the author

The PR decides on `error.zero?`. `SO_ERROR` can also read `EISCONN` —
*already connected* — for a port that **is** open, which `error.zero?`
would classify as closed. A false negative is benign in the common
path (a collision resurfaces as a bind failure later), but it's worth
a deliberate decision in the PR rather than an accident of the rescue
list. I said as much in the confirmation reply.

## What ships where

The verification reply on #13845 carries before/after screenshots and
the environment (macOS 27.0.1 arm64, Vagrant 2.4.9, embedded ruby
3.3.8, VMware provider), with the honest note that the override loaded
the PR's exact method body rather than a patched install. The override
file stays on this machine until #13842 ships in a release — where it
is also, in the meantime, the working fix for the user who reported
the bug here at home.

If it merges, the follow-up post writes itself: how it landed, what
the maintainers changed, and whether the caveat mattered.
