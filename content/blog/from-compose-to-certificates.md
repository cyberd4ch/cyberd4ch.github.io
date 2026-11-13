---
title: "from a compose file to a certificate chain"
date: 2026-11-12
category: technical
ai-assist: 100
tags: [docker, kubernetes, terraform, forgejo, tls, ci]
topics: [cloud-native, infrastructure-as-code]
excerpt: "the whole workspace arc in one post: three tiers in a compose file, the same tiers on kind, observability bolted on, terraform state moved to s3 — and a self-hosted forge in kubernetes publishing images from its own CI behind a TLS chain that actually verifies."
---
Learning cloud-native the only way that sticks: build the same thing four
times, each time with one fewer excuse.

This is the whole arc of this workspace, from a three-service `docker-compose.yml`
on a laptop to a self-hosted Git forge running in Kubernetes behind a TLS chain
that actually verifies, publishing container images from its own CI. No cloud
account, no managed services, no CI minutes on someone else's invoice.

Everything below is in this repository, and everything below broke at least
once.

---

## The premise

The rule I set for myself at the start was **$0, or nearly**. Not because free is
a personality, but because a paid platform hides the interesting parts behind a
console. When you can't buy a load balancer, you have to learn what a NodePort
is. When you can't buy a certificate authority, you have to learn what a root CA
is. Constraints are the curriculum.

The second rule was **one artefact per idea**. Each lab re-implements the
previous one with new vocabulary, so the only thing that changes is the concept
under test.

## Act 1 — Three tiers in one compose file

Lab 01 is the classic: nginx in front, a Flask API behind it, Postgres under
that.

```
browser :8080 → nginx (reverse proxy) → Flask API :8000 (app tier) → Postgres :5432 (data tier)
```

Almost nothing here is cloud-native. That is the point — it is the baseline
every later lab gets compared against. What I learned was small and concrete:
a compose network is a DNS zone (`api`, `postgres` are hostnames), a named
volume is where data survives `down`, and `.env` is where secrets go when you
have not yet admitted that secrets are a problem.

## Act 2 — The same three tiers, with Kubernetes vocabulary

Lab 02 rewrites those three services as three Deployments on a `kind` cluster and
maps the vocabulary one-to-one:

| lab 01 (Compose)              | lab 02 (Kubernetes)                          |
| ----------------------------- | -------------------------------------------- |
| `services.api`                | a `Deployment` (containers + replicas)       |
| compose network DNS           | a `Service` (`svc/api`, `svc/postgres`)      |
| published port `8080:80`      | NodePort `30080` + kind `extraPortMappings`  |
| named volume `pgdata`         | a PVC, dynamically provisioned               |
| `.env`                        | a `Secret` (and a `ConfigMap` for nginx)     |
| `scale api=2`                 | `spec.replicas`, live-editable               |

Two things did not map cleanly, and they are the two worth remembering.

**Storage changed character.** A named volume is a thing Docker owns. A PVC is a
*request* that something else fulfils — in kind, `local-path-provisioner`
creating a directory on the node. Delete the node and the data is a directory
nobody remembers. That was the first time a Kubernetes abstraction felt less
convenient than the thing it replaced, and understanding why is the whole lesson.

**The edge became a chain.** `8080:80` in compose is one line. In kind it is
`extraPortMappings` on the node container plus a NodePort Service plus the
controller deciding what to do with the traffic. The port is no longer a property
of the app; it is a property of the cluster's creation, which will matter a lot
later in this post.

## Act 3 — Making it observable

Lab 03 bolts a second namespace (`observe`) onto the same cluster, and the app
does not change at all. That is deliberate: observability is not a feature of
the application, it is a property of the platform.

The curriculum here is about **where numbers come from**:

- kube-state-metrics turns object state into metrics (how many pods *should*
  exist, how many restarts a container has had);
- cAdvisor, exposed by the kubelet on `10250`, turns actual CPU and memory use
  into metrics — scraped directly, no sidecar;
- logs answer "what happened", time-series answer "what has been happening", and
  only the second one can alert you before a user notices.

The thing that surprised me most was how much of it is just YAML parsed by
programs. A namespace is a folder. An exporter is a Deployment that reads an API.
Alerts are files. Nothing is magic; it is a stack of small programs agreeing on
conventions.

## Act 4 — Declaring it instead of clicking it

Lab 04 writes the same three tiers again, this time in HCL with the Terraform
Docker provider.

The app is identical. What changes is **ownership**: plan before apply, state
between runs, drift when someone deletes a container by hand, `import` when
something exists that the config does not know about, one `destroy` that leaves
nothing behind. I ran that cycle against the Docker provider because it exercises
every mechanic a cloud provider does — a resource graph, a state file, variables
and outputs, drift, import, destroy — without an expired AWS session standing
between me and the lesson.

Later this moved to an S3 backend with a `use_lockfile` lock, which I proved by
planting a `.tflock` file and watching `plan` refuse to run. That is the moment
remote state stopped being a bullet point.

## Act 5 — A forge in a container

Somewhere around here I noticed the gap. Every lab had a README claiming CI, and
none of them had CI. There was no pipeline anywhere — just me running commands
and writing down the output.

So: [Forgejo](https://forgejo.org/) plus its Actions runner on Docker Compose, on
the same daemon as everything else. A self-hosted Git server with a CI runner
that costs nothing and can see my code without a token going anywhere.

Two details mattered:

- the runner gets **the host Docker socket** (`docker_host: automount`), so job
  containers are siblings, not children — the classic Docker-out-of-Docker trick;
- Forgejo ships a **container registry** on the same host, so images have
  somewhere to live without a paid registry.

The first real tenant was **TruthGuard**, a Rust CLI that checks whether a docs
page still says what the docs claim it says. It was chosen because it is small
enough to build on every push and honest enough to fail in interesting ways.

Its pipeline is deliberately boring: `make ci` (fmt, clippy, tests, release
build) on every push, and on a `v*` tag: run `make ci` again, then build and push
the image. Boring is the goal — a pipeline you cannot debug at 2 a.m. is a
pipeline you will disable at 2 a.m.

## Act 6 — Move the forge into the cluster

The Compose forge worked, which meant it was time to break it. Re-implementing
it as a Helm chart on `kind-lab02` is where most of the Kubernetes learning in
this repo actually lives:

- **Forgejo** as a Deployment with a PVC, a Service, and a config Secret;
- **the registry** as a second Deployment inside the cluster, so pushes never
  leave the node;
- **the runner** as a pod with a **Docker-in-Docker sidecar**, `privileged`,
  because a kind node runs containerd and has no Docker socket to hand out.

That last one taught me more than any course. The runner creates a *new Docker
network per job* and then starts job containers on it, which means:

1. job containers inherit no DNS from the pod, so they cannot resolve
   `forgejo.forgejo.svc.cluster.local` until you hand them the cluster DNS
   explicitly (`container.options: "--dns 10.96.0.10"`);
2. the runner must register against the **in-cluster** Service address
   (`http://forgejo.forgejo.svc.cluster.local:3000`), not the pretty public URL,
   because the clone URL baked into a job is the registration URL;
3. `--insecure-registry` must list both the short and the fully-qualified name,
   because Docker matches the flag against the exact host string it pushes to.

Every one of those was a real failure with a misleading error message.

## Act 7 — The certificate chain

The forge was reachable, but only through `kubectl port-forward`, and anything
served over plain HTTP with a hand-managed cert eventually teaches you the wrong
lesson. So: **ingress-nginx** as the entry point (NodePorts 30080/30443),
**cert-manager** as the signer.

The obvious setup — a self-signed leaf — is the one that teaches nothing. Browser
warnings get clicked through and you never actually verify anything. What worked
was the three-layer pattern:

```
lab-selfsigned (self-signed)      → issues
lab-root-ca (a Certificate)       → whose key signs
lab-ca (a ClusterIssuer)          → which the Ingress asks for a leaf
```

The point is that the root is *trustable once*: extract it, add it to your trust
store, and every check afterwards is a plain exit code instead of a suppressed
error.

```sh
kubectl -n cert-manager get secret lab-root-ca -o jsonpath='{.data.ca\.crt}' \
  | base64 -d > lab-root-ca.crt

curl -s --resolve forgejo.lab02.local:8443:127.0.0.1 --cacert lab-root-ca.crt \
  https://forgejo.lab02.local:8443/api/healthz -o /dev/null && echo ok
# ok

echo | openssl s_client -connect 127.0.0.1:8443 -servername forgejo.lab02.local \
  -CAfile lab-root-ca.crt 2>&1 | grep Verification
# Verification: OK
```

Two "hostnames" exist at once, and that is correct, not a bug: the browser uses
`https://forgejo.lab02.local:8443/` (via `ROOT_URL`), while the runner and the
jobs use `http://forgejo.forgejo.svc.cluster.local:3000`. Same forge. Different
questions being asked of it.

## Act 8 — A tag that lied about itself

The first release proved something embarrassing: `v0.1.1` shipped an image whose
`--version` said `0.1.0`, because `Cargo.toml` had never been bumped. The tag was
in the registry, the pipeline was green, and the binary disagreed with both.

The fix is not clever — bump the version, re-tag, and then **prove it**:

```console
$ docker run --rm forgejo-registry.forgejo.svc.cluster.local:5000/dev/truthguard:v0.2.0 --version
truthguard 0.2.0
```

The lesson is the verification, not the bump. A green pipeline says the build
succeeded; it says nothing about whether the artefact is the thing you think it
is. Ask the artefact.

## Act 9 — The night the DNS went away

Then the interesting failure. Both pipelines failed within the same minute:

```
curl: (18) HTTP/2 stream 1 was not closed cleanly
curl: (6) Could not resolve host: sh.rustup.rs
```

Nothing was wrong with the code. The host had lost DNS for a few minutes, one
attempt wedged on a half-open HTTP/2 stream, and the three-attempt retry with a
five-second sleep was not long enough to outlast it.

I re-ran both workflows at once, which was the next mistake. Two concurrent cargo
builds on a 2-vCPU kind node pushed it over: `kube-apiserver`, `ingress-nginx`,
and `metrics-server` all went into `CrashLoopBackOff` on failed etcd keepalives.
Inside the node, load average hit 93. Nothing was OOM-killed. The cluster had not
crashed — it had been starved.

Three lessons, in order of value:

1. **A retry is a policy, not a `for` loop.** Five seconds stops working the
   moment the outage is measured in minutes.
2. **Capacity is a correctness property.** A cluster that cannot run its own
   builds will fail in ways that look like application bugs.
3. **Rerun one thing at a time on a small node.** The queue is the scheduler; you
   are part of it.

The fix is now a script both pipelines share, because the retry needs to be
testable on its own and because two copies of a retry will drift:

```sh
# dev/truthguard/scripts/install-rust.sh
curl --proto '=https' --tlsv1.2 -sSf \
  --connect-timeout 10 \
  --retry 5 --retry-delay 2 --retry-max-time 120 --retry-all-errors \
  -o "$tmp" "$rustup_init_url"
```

`--retry-all-errors` is the load-bearing flag: plain `--retry` covers HTTP errors
and connection resets, but **not** "could not resolve host" — which was the exact
failure. Outside that, attempts back off 5s → 10s → 20s → 40s → 60s, which covers
a couple of minutes of outage, and `RUSTUP_MAX_RETRIES` does the same for the
toolchain download that happens afterwards. `RUSTUP_INIT_URL` exists so the
failure path can be exercised without unplugging anything.

Both paths are verified:

```console
$ RUSTUP_INIT_URL=https://no-such-host.invalid/rustup.sh RUSTUP_ATTEMPTS=1 sh scripts/install-rust.sh
curl: (6) Could not resolve host: no-such-host.invalid     # ×5, ~10s
rustup install failed after 1 attempts; giving up
# exit 1
```

## Act 10 — A port that stays open

The last rough edge was the one I had been living with: the TLS URL only worked
while a `kubectl port-forward` process was alive. Every doc had to open with
"start the forward first", which is not documentation, it is a ritual.

The obvious fix — publish another kind port — does not exist. `extraPortMappings`
is fixed when the cluster is created, and Docker cannot add a port mapping to a
running container. Gaining one port would mean recreating the cluster, taking the
forge's PVC, its certificates, and the runner registration with it.

So the edge lives on the host instead: one `socat` container on the same Docker
network as the kind node, forwarding host `:8443` to the node's ingress NodePort
`30443`. It is a plain TCP relay, so the certificate the browser sees is still the
one cert-manager issued, and `restart: unless-stopped` means it comes back on its
own.

The trap that cost an hour: **`tcp4:` matters**. The node's name resolves to both
an IPv4 address and a kind-internal IPv6 address, and the kube-proxy NodePort
binds IPv4 only. Left to pick, `socat` accepts the connection and closes it
mid-handshake — which looks exactly like a broken certificate, not a routing
problem:

```
* Connected to forgejo.lab02.local port 8443
* TLS handshake, Client hello (1):
* LibreSSL SSL_connect: SSL_ERROR_SYSCALL
```

Diagnosis, in the order that worked: does the container reach the NodePort
directly (yes, `404` from the default backend)? Does the *container's own*
listener work (yes, `200`)? Then the fault is between the host and the container,
not in the cluster.

Result:

```console
$ curl -s --resolve forgejo.lab02.local:8443:127.0.0.1 --cacert lab-root-ca.crt \
    https://forgejo.lab02.local:8443/api/healthz -o /dev/null -w '%{http_code}\n'
200
```

---

## The concepts, collected

If you are following the same path, this is the whole syllabus, in the order it
actually arrived:

| Concept | Where it got real | The one-line lesson |
| --- | --- | --- |
| Container networks as DNS | lab 01 | Service discovery is just names resolving |
| Volumes vs. PVCs | lab 02 | A volume is data; a PVC is a request for data |
| Deployments, replicas, rolling updates | lab 02 | Availability is a controller's job, not a script's |
| NodePort and `extraPortMappings` | lab 02, again in act 10 | The edge of your cluster is a config decision |
| Secrets and ConfigMaps | lab 02 | A Secret is a base64 field until you handle it like a secret |
| Metrics, exporters, kube-state-metrics | lab 03 | Observability is plumbing, not an SDK |
| Time-series vs. logs | lab 03 | Logs answer "what", series answer "since when" |
| Terraform state, drift, import | lab 04 | IaC is about ownership, not syntax |
| Remote state with locking | lab 04 | Shared state without a lock is a data race |
| Idempotence (Ansible) | home-lab baseline | A second run that changes nothing is the test |
| CI as containers | act 5 | A pipeline is a container with a repo mounted in it |
| Helm charts | act 6 | Templating is easy; defaults are the product |
| Docker-out-of-Docker vs DinD | act 6 | A socket is privilege with a friendly name |
| Ephemeral job pods | act 6 | Jobs are cattle; their caches are the only thing worth keeping |
| In-cluster registry | act 6 | The shortest network path is the one inside the cluster |
| Ingress controllers | act 7 | Routing is a layer in front of Services, not a Service feature |
| cert-manager and ClusterIssuers | act 7 | A verifiable chain beats a warning you click through |
| Supply chain (Trivy, cosign) | roadmap | A green build is not a trustworthy artefact |
| SLOs, alerting | roadmap | Alert on the symptom your users feel |
| GitOps (Argo CD) | roadmap | Reconciliation beats deployment scripts |
| Failure drills | roadmap | Backups you have not restored are wishes |

## What it cost

Honestly, almost nothing: the compute is a laptop, the forge is self-hosted, the
registry is in the cluster, and the CA is a secret in `cert-manager`. The bill is
time, and most of it went to three categories — networking paths (who can resolve
whom), privilege (which socket, which user), and capacity (2 vCPUs is exactly one
build).

## What is still not done

Being precise about the gaps is part of the exercise:

- the cluster is **kind, not k3s** — a deliberate shortcut, named as a deviation
  in the roadmap;
- the registry is **unauthenticated**;
- the Compose forge still runs as the rollback, so there are two forges and one
  of them is going to rot;
- no Argo CD, so the chart is applied by hand — the cluster is not yet reconciled
  from Git;
- no image scanning or signing.

## What is next

Retire the Compose stack (the runbook exists), then Argo CD, then Trivy and
cosign, then a nightly CronJob that runs TruthGuard against a benchmark set with
Prometheus and Grafana watching it. After that the practice changes from building
a platform to *breaking* one on purpose — killing nodes, restoring from backup,
upgrading without downtime — because a platform you have never failed is a
platform you do not understand.

The through-line from `docker-compose.yml` to a verified certificate chain is
short: every layer added a question I could not answer with the previous one.
That is the only reason to add a layer.
