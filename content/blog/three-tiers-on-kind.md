---
title: "same tiers, new vocabulary: kind, crashloops, and the one secret spelling"
date: 2026-11-07
category: technical
ai-assist: 100
tags: [kubernetes, kind, docker]
topics: [cloud-native]
excerpt: "re-homing the lab 01 stack onto kind: a KeyError crashloop, the secret that is a bag of keys, boot-time retries, and a same-tag rebuild that never rolls."
---
*part 2 of the `cloud_prep/` lab log. part 1, [three tiers via colima and the
docker desktop ghosts](/blog/three-tiers-after-desktop/), ended with a
compose file going green. this one hands the same application to Kubernetes —
and learns that a crash loop is honest work, a secret is a bag of keys, and a
same-tag rebuild is a performance by a very small liar.*

## the vocabulary, written as a map

Running this app under kind is a study in translation, not translation
theory: every lab-01 concept buys an exact k8s word.

| compose (lab 01)                 | kind (lab 02)                              |
| -------------------------------- | ------------------------------------------ |
| `services.pg` (3 items)          | 3 Deployments                               |
| the compose network's DNS        | ClusterIP Services, bare Service names      |
| `ports: "8080:80"`               | NodePort + kind `extraPortMappings`(1-hop)  |
| a named docker volume            | a PVC, provisioned by kind's `standard`     |
| `.env` plain interpolation       | a Secret, read out with per-consumer mappings|
| `--scale api=2`                  | `spec.replicas`, editable at runtime        |

The stack deploys clean on the first apply. Pod table held everything green
except what mattered:

```
pod/api-5bb45d85d4-8qbpp   0/1  CrashLoopBackOff  9 restarts  23m
pod/pg-648795b-q4tt5       1/1  Running           0           23m
pod/web-677598dfcb-k4wq4   1/1  Running           0           23m
```

## the crash that recommends a look at a dict

This one logs itself honestly. Paste from `kubectl logs deploy/api`:

```
File "/app/app.py", line 14, in db
    user=os.environ["PGUSER"],
File "<frozen os>", line 717, in __getitem__
KeyError: 'PGUSER'
```

The API password Secret keys were `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` (the postgres image's vocabulary — its entrypoint script makes
that contract) while the application itself reads libpq spellings:
`PGUSER`, `PGPASSWORD`, `PGDATABASE`. In the compose lab, the API patched
`PGUSER` out of the same .env — nobody noticed that the *two* naming systems
already coexisted. Kubernetes noticed, precisely, and gave us a crash loop.

The fix is the k8s idiom worth stealing: one Secret, consumer-specific
renames:

```yaml
env:
  - name: PGHOST
    value: postgres
  - name: PGUSER
    valueFrom:
      secretKeyRef: { name: pg-creds, key: POSTGRES_USER }
  - name: PGPASSWORD
    valueFrom:
      secretKeyRef: { name: pg-creds, key: POSTGRES_PASSWORD }
  - name: PGDATABASE
    valueFrom:
      secretKeyRef: { name: pg-creds, key: POSTGRES_DB }
```

A Secret is a bag of keys, not a magic env block. `envFrom` ignores the
spelling your app reads. The lesson generalizes past k8s: whenever two
components share a credential, check who names it what — the source of most
"works in compose, fails in prod" stories.

## crashloop math, written large

The pods did not stay red. Kubernetes *does* self-heal — restart on repeat,
backoff widening until 5 minutes. Except: the rollout deadline I ran (180 s)
expires earlier than the backoff schedule. So the orchestrator reports
"deployment 'api' exceeded its progress deadline" about two hours before pods
would have converged. The orchestrator is not lying, exactly; it just gives
up patience sooner than remediation.

## endurance boot, spotted early

`init_schema()` used to exit the container whenever Postgres wasn't
listening yet (fresh cluster runs provision the PVC and take a minute). The
pod would exit, restart, exit again — a self-healing crash loop with the
orchestration equivalent of a shrug. Made it patient instead:

```python
def init_schema_with_retry(attempts=30, delay=1.0):
    for try_index in range(1, attempts + 1):
        try:
            init_schema()
            return
        except psycopg.Error as exc:
            print(f"postgres not ready ({try_index}/{attempts}): {exc}", flush=True)
            time.sleep(delay)
    raise SystemExit("postgres never became ready — giving up")
```

Now a fresh-cluster run waits politely rather than flexing restarts.

## the small roast: same tag, same template

`kind load docker-image` applies the new image bytes, but the deployment
never rolls it. Reason: a same-tag image needs no new pod template — for
k8s it is the *same* application by hash, so nothing to do regardless of the
fact your code changed. The fix is a one-liner in the deploy script:

```sh
kubectl -n three-tiers rollout restart deploy/api
```

## the numbers finally said it

After the shift everything answered the same three questions that compose
answered — same answers:

```
{"status":"ok"}
{"db":"up","version":["PostgreSQL","16.15"]}
{"hits":1}
{"hits":2}
```

Exercise 3: `kubectl -n three-tiers scale deploy/api --replicas=4` watched by
`kubectl -n three-tiers get endpoints api -w` — endpoint pairs tumbling into
place (`0.13/.14` → `.16` → `.15 + 1 more`). Exercise 2 — delete the *pg
pod*, not the cluster: `pod "pg-648795b-q4tt5" deleted`; counter still
answers from its archival memory because the PVC out lives the reroots.

## what I'd steal from the first k8s run

* **Endpoint view = load balancing proof** with zero dashboard. `kubectl get
  endpoints` is the view that answers "is traffic actually scaling?" in one
  line.
* **PVC & pod independence**, this time in contradiction of compose: k8s's
  most useful property got explained the hard way (see exercise 2).
* **Multiple name translations instead of one.** compose's one port map
  traded for: host→node port→service→pod IP and ports, all three — each
  tunable, each fragile in its own way, each debuggable with `get endpoints`.

## next in the series

The Rust rewrite of the client (`free-torrent-cli`) gains BEP 5 — DHT peer
discovery — next session, so a *trackerless* magnet works end to end. After
that, lab 03 covers observability on this same cluster (the container log
named the bug; the next lab will name it faster).
