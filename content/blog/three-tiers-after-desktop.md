*part 1 of a series from my new `cloud_prep/` practice workspace — home lab, cloud
native, reverse engineering. this one is small on purpose: a three-tier compose
lab, and what it cost to bring it up on a machine that had already divested from
docker desktop.*

## the lab

The goal of lab 01 was deliberately boring: the canonical cloud-native hello
world. nginx as the edge, a tiny Flask API as the app tier, Postgres 16 as the
data tier, one compose file, three services, one network. If this shape is
intimate, Kubernetes later becomes a re-implementation exercise instead of a
new religion.

```
host :8080 → nginx (1.27-alpine) → api (flask, python 3.13-alpine) → postgres (16-alpine)
```

The whole definition of success was three endpoints:

```sh
curl localhost:8080/health     # {"status":"ok"}
curl localhost:8080/db-check   # {"db":"up","version":["PostgreSQL","16.15"]}
curl localhost:8080/counter    # {"hits":1} then {"hits":2} — state survives
```

## choice 1: no desktop app, a daemon

8 GB of RAM on an ARM mac. Docker Desktop was already gone (I uninstalled it
during a cleanup pass months ago), and a GUI container runtime spends bytes I
wanted for VMs. The plan: **colima** as the engine, homebrew's plain `docker`,
`docker-compose` and `docker-buildx` as the CLI:

```sh
brew install colima docker docker-compose docker-buildx
colima start --cpu 2 --memory 2
docker context use colima
```

This part works exactly as advertised. colima came up on the macOS
Virtualization.Framework, mounted my workspace via virtiofs, and gave the CLI
a socket. Everything broken after that point was **ghost inheritance from the
uninstalled Docker Desktop**, not colima's fault.

## ghost 1: the plugin cabinet full of dead keys

`docker compose version` → `unknown command: docker compose`.

The brew CLI happily loaded plugins whenever its _plugins lookup_ found them,
and months ago Docker Desktop had installed **16 symlinked CLI plugins** into
`~/.docker/cli-plugins` — every single one pointing into
`/Applications/Docker.app/...`, which no longer exists. The `docker-compose`
plugin symlink was dead, so the `docker compose` subcommand stopped existing.
Walking `ls -la ~/.docker/cli-plugins` was all the debugging this needed; the
dates on the symlinks told the story.

The fix is the undo button that never existed:

```sh
# remove every plugin symlink whose target is gone
for f in ~/.docker/cli-plugins/*; do
  [ -L "$f" ] && [ ! -e "$f" ] && rm "$f"
done
# re-wire the homebrew ones
ln -sfn "$(brew --prefix)/opt/docker-compose/bin/docker-compose" \
    ~/.docker/cli-plugins/docker-compose
ln -sfn "$(brew --prefix)/lib/docker/cli-plugins/docker-buildx" \
    ~/.docker/cli-plugins/docker-buildx
```

(also worth knowing: brew's buildx caveat prints a `cliPluginsExtraDirs`
snippet you can paste into `~/.docker/config.json` instead of symlinking.
either works; symlinks are durable and grep-able.)

## ghost 2: the credential store pointing at a corpse

Compose came back to life, `docker compose up --build` started pulling
postgres 16-alpine, and immediately:

```
error getting credentials - err: exec: "docker-credential-desktop":
executable file not found in $PATH
```

That helper binary used to ship *inside* Docker.app. My
`~/.docker/config.json` was still telling docker to authenticate with it:

```json
{ "auths": {}, "credsStore": "desktop", "currentContext": "colima" }
```

Backup the file, delete the `credsStore` line, pulls work again. The only
reason this stung less than it could have: it's the same class of mistake as
ghost 1 — **the config outlived the software**. Any uninstall script that
leaves your dotfiles claiming a component still exists is a time bomb for the
next person who uses the machine. Future lab note for the `.zshrc`-style
audits: after removing any desktop app, grep `~/.docker`, `~/Library`, and
anything in `PATH` for its name.

## ghost 3, brief and ignorable

With both fixed, the first build sat at a leisurely ~1.2 MB/s (from the pip
log inside the build, no tools required to measure it) through the head base
images — python 3.13-alpine alone took ~35 s of layer download. Slow mirror,
not a broken thing. The lesson I keep re-learning: distinguise *slow* from
*stuck* before touching anything. 88 MB in the image store means moving.

## the stack came up

Full build in about five minutes, then green across the board:

| endpoint | response | proves |
| --- | --- | --- |
| `/health` | `{"status":"ok"}` | nginx → api over the compose network |
| `/db-check` | `{"db":"up","version":["PostgreSQL","16.15"]}` | api → postgres by service name |
| `/counter` ×2 | `{"hits":1}`, `{"hits":2}` | writes land in pg data via volume |

And `docker compose ps` shows the design payoff: **only nginx** has a
published port (`0.0.0.0:8080->80`). postgres and the api expose `5432/tcp`
and `8000/tcp` to the compose network and to the compose network alone.
Within the network, service *names* are DNS — `PGHOST=postgres` needs no IP,
nothing. Compose is quietly practicing for the k8s Services lesson.

## what I'd steal from the compose file

* **`depends_on: condition: service_healthy`** plus a `pg_isready` healthcheck
  — the api never starts against a database that isn't accepting connections.
* **one published port, the other two dark.** Edges are routable, everything
  behind them stays internal. (Exercise 3 in the lab README: `psql -h
  localhost` should *fail*.) That embarrassment is the learning.
* **all state in a named volume.** `docker compose down` keeps state,
  `down -v` destroys it. My `/counter` proved that second contrast same day.

## next in the series

Lab 02 is the same three tiers, deployed onto a kind cluster: Deployment,
PVC, Secret, Service — and the nginx tier becomes a NodePort so the mental
model is unchanged. The point won't be "docker done"; it'll be noticing
precisely which lab-01 reflexes port over and which one is wrong — the
volumes, it turns out, are the fun part.
