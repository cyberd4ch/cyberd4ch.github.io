---
title: "the tablet lab: root first, then everything else"
date: 2026-11-14
category: technical
ai-assist: 100
tags: [android, mtk, magisk, k3s, forensics, radare2]
topics: [bug-bounty]
excerpt: "root first, then everything else: a double-read BROM backup script, the magisk cmdline flag k3s needs, a device-owner agent with documented denials, and what 2 GB of RAM decides."
---

A 2 GB MediaTek tablet is not a good computer. That is exactly why it is a good
lab: every abstraction I rely on has to be paid for in RAM, in 32-bit binaries,
or in a kernel config that Android switched off years ago.

This is the platform half of the Android work in my lab workspace: the same
`MediaTek NoteBook10Pro` from the attack-simulation write-up, now with the
bootloader in scope. It is my device, it stays on my desk, and the one rule is
the one that matters: **back up before you write**.

## What I expected, and what decides each track

I wrote the plan before touching anything, because a plan that names its own
blockers is cheap to falsify later:

| Track | Verdict | What decides it |
| --- | --- | --- |
| k3s on the tablet | demo only | memory cgroup + whether LMKD kills k3s first |
| root / deep modification | yes, via BROM | a verified full read before any write |
| C2 tiers | yes, three levels | root or Device Owner for anything past adb |
| forensic dive | yes | BROM image, or a rooted `dd` for plaintext `/data` |
| USB as radio antenna | **no** | USB is digital; only an external SDR can attach |

That last row is worth keeping in a post about capability: the honest answer to
"can the radio use USB as an antenna" is no, and the useful answer is an RTL-SDR
on OTG, receive-only, with a powered hub because the port will not source enough
current. Software cannot rewire an antenna.

## Backup is a test, not a copy

The MT6737M is vulnerable to the kamakiri BROM exploit, which `mtkclient`
implements. Generic MTK builds usually ship with `fastboot oem unlock` disabled,
so BROM is not a shortcut: it is the only door. The same door reads the entire
eMMC before Android is involved.

The trap is trusting a single read. A flaky cable produces a file of the right
size with the wrong bytes, and you find out when you restore it. So
`brom-backup.sh` reads every partition **twice**, hashes each file, and refuses
to finish unless the two reads agree:

```console
$ ./brom-backup.sh ~/tablet-backup-$(date +%F)
[*] read 1/2 — put the tablet in BROM now (power off, hold Vol+, plug USB)
[*] unplug, power off, then re-enter BROM for the verification read
[+] both reads agree; manifest in .../SHA256SUMS
```

The tablet was not attached when I wrote the script, so I tested the logic with
a fake `mtk` that emits deterministic partitions: once clean, once with one
partition corrupted. The failure path is the one that matters:

```console
$ CORRUPT_READ=read2 ./brom-backup.sh /tmp/run-bad
[!] MISMATCH or missing in read2: userdata.img
[!] reads disagree — do NOT flash; retry with a better cable/port
# exit 1
```

An existing output directory is also refused, because a second run must not
overwrite the only good copy. The real device run is still outstanding, and it
is listed as outstanding wherever this lab is tracked.

Two more rules from the runbook, both learned the hard way by other people:

- `preloader` is the one partition the BROM cannot recover. If it is half-written,
  the device is a test-point job. Charge above 50 %, use a direct port, no hub.
- never write `nvram`, `nvdata`, `persist`, `protect1/2`, `tee1/2` from any source
  except this device's own backup. They carry IMEI, MAC addresses and DRM keys.

## Root, and the one cmdline flag that matters

The root path is fastboot if the vendor allows it, and BROM if not. Patch `boot.img`
with Magisk, then, before flashing, repack it and append one argument:

```sh
magiskboot unpack magisk_patched.img
printf ' cgroup_enable=memory' >> cmdline
magiskboot repack magisk_patched.img new-boot.img
```

Android 4.4 kernels boot with the memory cgroup disabled and let
`lowmemorykiller` do the job. kubelet needs the cgroup. There is no userspace fix:
if the kernel was built without `CONFIG_MEMCG`, the flag does nothing and the
Kubernetes track is over before it starts. That is why the verification order is
`su -c id`, `/proc/cgroups`, `mount | grep cgroup`, `getenforce`: in that order,
because each one can invalidate the next.

Recovery is a table, not a hope: no BROM enumeration means the preloader is gone;
BROM enumerates but the device is dead means restore `boot`/`recovery`; boot loop
after Magisk means restore the stock boot image and redo the patch from the exact
same stock image. `read1/` gets `chmod -R a-w` after verification.

## Three C2 tiers, and why Device Owner is the interesting one

The plan compares three levels of control:

1. **adb over TCP**: the honest baseline. With an authorized key, "C2" is just
   adb: input events, screen capture, disabling packages for user 0. Wireless
   state, camera and the lock screen are out of reach.
2. **Meterpreter**: root, noisiest, quickest way to build an action matrix.
3. **Device Owner**: a supported Android management API, no root. This is the
   one worth measuring, because it is not an exploit and it still does the things
   people assume need root.

The agent is deliberately small Java: a `DeviceAdminReceiver`, a foreground
service polling a stdlib Python server, and a switch that maps one command to one
`DevicePolicyManager` call. `lock`, `camera_off`, `statusbar_off`,
`screenshot_off`, `keyguard_off`, user restrictions, `reboot`, and a `kill` that
calls `clearDeviceOwnerApp`. `wipe` exists but is refused unless a compile-time
flag is flipped.

Verification, in the order it happened:

- two genuine API mistakes were caught by compiling against `android.jar`
  (`UserManager.DISALLOW_CAMERA` does not exist; `isStatusBarDisabled()` takes no
  argument). Both would have been runtime crashes.
- then the tablet showed up on USB, and the debuggable test build actually ran:
  `ping` → `pong`, `camera_off`/`camera_on` succeeded as an **active admin**, and
  `state` returned a live policy document. `screenshot_off`, `statusbar_off` and
  the user restrictions came back `denied: does not own the profile`, which is
  exactly the boundary this tier is supposed to demonstrate.
- running it found a third bug that compiling could not: `isStatusBarDisabled()`
  is missing from the **API 27 framework** (it exists in the newer stub), so the
  first `state` threw `NoSuchMethodError` and killed the poll thread. `state` now
  calls it reflectively and reports `unknown (API < 28)`, and the command handler
  catches `Throwable` so no single command can kill the agent.
- the APK was assembled without Gradle (`aapt2`, `javac`, `d8`, `zipalign`,
  `apksigner`) and verified: `package: lab.c2`, minSdk 24, targetSdk 27,
  signature valid. `build-apk.sh` reproduces it.
- the server was exercised end to end: 401 on a bad token, empty `/poll` →
  `{"cmd":"none"}`, a queued `camera_off` returned on the next poll, a result
  logged to JSONL, `/status` reflecting state.

What is **not** verified: the Device Owner step itself. `dpm set-device-owner`
refused outright (`Not allowed to set the device owner because there are already
some accounts on the device`), so every owner-only command (`screenshot_off`,
`keyguard_off`, restrictions, `kill`) is still untested, as are `lock` and
`reboot`. The service is also `exported="false"`, so adb cannot start it; the
hardware run needed a debuggable build and `run-as lab.c2 am
start-foreground-service --user 0`, with `adb reverse tcp:8099 tcp:8099` so no
Wi-Fi was involved. The tablet disconnected before teardown, so the app and its
active-admin registration are still on the device. `on-device-test.md` keeps the
full matrix and the exact outputs; the untested rows are marked as such.

The forensic point of this tier is simple: `dumpsys device_policy` shows every
policy to any adb shell. A Device Owner that disables the camera is not hidden; it
is *declared*. That is the artifact an examiner would quote.

## k3s on 2 GB: feasible, demo-grade

The numbers: 600–900 MB for Android, 450–650 MB for k3s + containerd + kubelet,
50 MB for a demo pod, 100–200 MB of eviction headroom. Of 2 GB, before page cache.
LMKD does not know kubelet's eviction thresholds, so it will kill k3s first and
call it a low-memory event.

Then the blockers, in order: the memory cgroup (see above), a 32-bit userspace
(k3s publishes armhf; every image needs a `linux/arm/v7` manifest), and no CNI:
netd owns iptables, so the working shape is `--flannel-backend=none` plus pods
with `hostNetwork: true`. `--disable traefik --disable servicelb
--disable metrics-server --disable local-storage` keeps the footprint down.
`manifests/web.yaml` is a namespace, a ConfigMap and a `busybox:1.36` pod serving
a page on loopback; it is written and schema-checked, **not applied**.

If `memory` stays `0` in `/proc/cgroups`, the fallback is the better lab anyway:
k3s server on the Ubuntu VM, tablet joined as an **agent** (200–300 MB), pods
pinned with `nodeSelector: kubernetes.io/arch: arm`. The tablet is still a real
node; the control plane just lives where the RAM is.

## The forensic experiment

Collecting is easy; proving what changed is the lab. `labs/forensics` now has two
scripts:

- `acquire.sh` takes a logical, non-root snapshot over adb (props, packages,
  accounts, Wi-Fi/BT, usage stats, logcat, `/sdcard`, bugreport) and hashes
  **every** collected file, including the pulled storage tree, into `SHA256SUMS`.
- `baseline-diff.sh` verifies both snapshots against their manifests before
  comparing anything, then reports added/removed/changed files and writes unified
  diffs.

Volatile artifacts (logcat, battery, uptime, bugreport, the sdcard pull) are
excluded from the file diff, because they differ on every run and would drown the
signal. Tested with synthetic snapshots, including a tampered file:

```console
[+] before: 6 files verified
[+] after: 6 files verified
[~] 2: 02-packages-full.txt 13-settings-global.txt
[+] 1: 30-device-policy.txt
[-] 1: 25-bootstate.txt
[+] 2 text diffs in out/diff
```

and on tamper, the manifest check fails the run before any diff is produced. One
more caveat that matters for real evidence: a BROM image is a physical copy, but
`/data` is FBE-encrypted, so offline it is ciphertext. The plaintext deep dive is
the rooted `dd` from a booted, unlocked device; pair the two.

## The other half: reading the binaries

The platform work kept producing stripped aarch64 binaries, so the
reverse-engineering lab became the place to get good at reading them. Five
reproducible notes, all `r2` 6.0.5, each built from source, each with the exact
commands that produce the finding:

| Sample | What it taught |
| --- | --- |
| stripped branch crackme | recovering `main` without symbols |
| xor-string | the secret was built on the stack and XOR'd with `0x5a`; `strings` misses it |
| switch-tree | GCC 16.2 emitted a compare tree, not a jump table: the hypothesis was wrong |
| ptrace-guard | `PTRACE_TRACEME` + `cmn x0, 1`; patching `b.ne` at `0x808` flips a traced run to "running clean" |
| checksum-key | `ubfiz`/`add` ×33 inverted by brute force; 68 valid keys, `afh` one of them |

The shared helper is `scripts/triage.r2`, reused by all five. The discipline that
made it a lab rather than a folder of screenshots: every claim is a command, and
the samples are 67,720 bytes of reproducible build output, not mystery binaries
from the internet. The switch-tree note is my favourite, because it records a
disproven hypothesis instead of a faked jump table.

## What is actually done

Verified: the agent compiles and packages into a signed APK; the server's
endpoints behave; a debuggable build ran on the tablet (ping, camera on/off,
partial state, and the documented denials); the backup script passes/fails
correctly under simulation; the forensic diff verified two real acquisitions and
caught the installed `lab.c2` package in the package list; the five RE notes
reproduce; the k3s manifest parses.

Not verified, and therefore not claimed: the Device Owner matrix (the account on
the tablet blocks it), `lock`/`reboot`/`kill`, the BROM read and flash, k3s on the
tablet, and the teardown. The tablet also vanished from USB mid-acquisition, so
the post-install snapshot has no bugreport. That list is the next session's
queue, and it starts with a factory reset for the owner-only half.

The through-line is the same as the rest of this workspace: a capability you have
not exercised is a claim, not a finding. Root, C2 and Kubernetes all look easy
right up until the kernel config, the 32-bit image, or the empty `adb devices`
says otherwise.
