---
title: "three tiers become a module: two stacks, one graph, no collisions"
date: 2026-11-08
category: technical
ai-assist: 100
tags: [terraform, docker, modules]
topics: [infrastructure-as-code]
excerpt: "lab 04 exercise 8: the same three tiers as a reusable module, instanced twice on 8082 and 8083 — including the readiness wait that caught a green apply serving nothing."
---
*the fourth lab in the `cloud_prep/` series stops adding features and starts deleting
duplication. same three tiers, one module, instanced twice on two ports — and a
`destroy` that has to take both down without touching the other.*

The previous lab declared nginx → api → postgres in HCL and ran it. It worked, and it
had the flaw every one-off Terraform config has: the names were literals. `lab04-net`,
`lab04-pgdata`, `lab04-api`. A second stack could not exist, because everything
would collide on the first one's names.

Exercise 8 is the fix: move the graph into `modules/three-tier/` and call it twice.

## what a module actually has to change

Nothing about the resources. The move is entirely about turning literals into inputs:

| before | after |
| --- | --- |
| `name = "lab04-net"` | `name = "${var.name_prefix}-net"` |
| `external = 8081` | `external = var.web_port` |
| `host_path = "${path.module}/../../cloud-native/…"` | `host_path = "${var.app_dir}/nginx/nginx.conf"` |
| provider block inside the config | provider block stays in the root |

That last row is the one people get wrong. A module describes *what* the stack is;
the root decides *where* it runs. The provider is a root concern, and a module that
declares its own `provider "docker" {}` cannot be reused across two hosts.

The API image tag follows the prefix too:

```hcl
resource "docker_image" "api" {
  name = "${var.name_prefix}-api:lab04"
  build { context = "${var.app_dir}/api" }
}
```

Two instances, two tags, two builds. Sharing a tag across instances would be faster
and would also mean one `apply` silently reusing an image built from a different
context — the same class of bug as `latest` in production.

## the root is now four lines of intent

```hcl
module "blue" {
  source            = "../modules/three-tier"
  name_prefix       = "lab04-blue"
  web_port          = 8082
  app_dir           = local.app_dir
  postgres_password = var.postgres_password
}

module "green" {
  source            = "../modules/three-tier"
  name_prefix       = "lab04-green"
  web_port          = 8083
  app_dir           = local.app_dir
  postgres_password = var.postgres_password
}
```

`terraform plan` counts it plainly: **16 to add** — eight resources per instance.
Apply, and both stacks exist:

```
blue_url     = "http://localhost:8082"
blue_volume  = "lab04-blue-pgdata"
green_url    = "http://localhost:8083"
green_volume = "lab04-green-pgdata"
```

## the part that is easy to get wrong: readiness

The first run "succeeded" and then both `curl`s timed out. Terraform created sixteen
resources and returned; the api containers were still building their image, waiting
for postgres, and initialising the schema. The orchestrator ordering the *creation*
is not the same as the application being *ready* — the same lesson as lab 01 and the
crash loop under kind, wearing IaC clothes.

Second run, with thirty seconds of patience instead of optimism:

```
{"status":"ok"}          # 8082
{"status":"ok"}          # 8083
{"hits":1} {"hits":2}    # blue keeps its own counter
{"hits":1}               # green starts from zero
```

That counter line is the proof of isolation. One database each, one volume each, one
network each; they share nothing but the source code and the password variable.

`docker ps` agrees: `lab04-blue-{nginx,api,postgres}` and `lab04-green-{…}`, six
containers, two volumes, and the original `lab04-*` stack from exercise 1 still
running beside them on 8081.

## destroy is per-root, not per-resource

`terraform destroy` reports `16 destroyed` and `terraform state list` is empty. The
blue and green stacks are gone entirely — containers, networks, volumes, built image
tags. The independently-managed `lab04-*` stack is untouched, because it lives in a
different root with a different state.

That is the real argument for modules over copy-paste, and it is not about typing
less. It is that "this stack" becomes a thing you can have two of, and that
`destroy` means a stack, not a directory.

## what this changes about the lab

The lab README's exercise list ends here, with a note that the stretch goal was the
module refactor. It is now done, and it turned out to be a better exercise than the
AWS provider swap: nothing new to learn about APIs, everything new to learn about
*ownership* — which root owns which prefix, and why the answer has to be in the name.
