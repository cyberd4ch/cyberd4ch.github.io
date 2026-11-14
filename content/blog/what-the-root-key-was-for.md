---
title: "what the root key was for"
date: 2026-11-08
category: technical
ai-assist: 100
tags: [aws, terraform, iam, s3]
topics: [cloud-native, infrastructure-as-code]
excerpt: "scoping AWS credentials to a lab user, then using them to move Terraform state off a laptop — including the IAM action name that does not exist."
---
The lab README had a line I did not like: exercise 6 (remote state) was skipped
because "the AWS session is expired". The account was being driven by the root
user, which is the cloud equivalent of debugging production as `sudo` on the
host — it works, and it teaches you nothing about permissions.

Root also turned out to have **no access keys at all**. The default profile was a
`login` session, a temporary credential derived from a console login. So the
task was not "rotate the root key", it was "stop having a reason to use root":

```
arn:aws:iam::560615624746:root        → 0 access keys (verified)
default profile                       → type: login (temporary, expires)
```

## One user, one policy, one prefix

The new identity is `ftc-labs`, attached to a managed policy `ftc-labs-s3` that
allows S3 only on `arn:aws:s3:::ftc-labs-*` and `…/ftc-labs-*/*`:

```json
{
  "Sid": "LabsBucketControl",
  "Effect": "Allow",
  "Resource": "arn:aws:s3:::ftc-labs-*",
  "Action": ["s3:CreateBucket", "s3:DeleteBucket", "s3:ListBucket",
             "s3:GetBucketVersioning", "s3:PutBucketVersioning",
             "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration"]
}
```

The interesting part is not the list, it is the prefix. A policy scoped to a
naming convention means the credential cannot touch anything that was not
created for the lab — not another bucket, not somebody's production data, not
even by accident with a mistyped name.

Proving it beats believing it:

```bash
$ aws iam list-access-keys        # as root: []
$ aws sts get-caller-identity --profile ftc-labs
arn:aws:iam::560615624746:user/ftc-labs
$ aws s3api create-bucket --bucket definitely-not-a-labs-bucket-9d2f --profile ftc-labs
An error occurred (AccessDenied) ... because no identity-based policy allows
the s3:CreateBucket action
```

That denial is the deliverable. The success path proves the lab works; the
failure path proves the blast radius.

Credentials live in `~/.aws/credentials` under a profile, mode 600, written by
`aws configure set` so the secret never appears in a terminal buffer, a chat
log, or a git diff. The default profile stays untouched, because it may be
needed for console-only tasks — root is for account-level work, not for `aws s3`.

## The action name that does not exist

First run of the bucket-hardening script:

```
An error occurred (AccessDenied) when calling the PutBucketEncryption operation:
... not authorized to perform: s3:PutEncryptionConfiguration
```

The call was `put-bucket-encryption`; the IAM action it checks is
`s3:PutEncryptionConfiguration`, not `s3:PutBucketEncryption`. The same trap
sits on lifecycle (`s3:PutLifecycleConfiguration`) and public-access-block
(`s3:PutBucketPublicAccessBlock` — that one *does* carry the `Bucket`). The
error message is the documentation: read the action it names, not the name of
the CLI call.

There is also a satisfying detail in the failure: the lab user could not update
its own policy (`iam:CreatePolicyVersion` denied — correct), so the fix had to be
made as root. The permission boundary held even against the person fixing it.

## Then exercise 6: move the truth

The docker stack had been running for three hours with eight resources in a
local `terraform.tfstate`. Moving it is three commands:

```bash
export AWS_PROFILE=ftc-labs
./bootstrap.sh                  # bucket + versioning + SSE + public-access block
terraform init -migrate-state   # copy the state into S3
```

`backend.tf` is eleven lines. The modern lock is one of them:

```hcl
terraform {
  backend "s3" {
    bucket       = "ftc-labs-tfstate-560615624746"
    key          = "lab04/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

`use_lockfile = true` makes Terraform write a `.tflock` object next to the state
and delete it when the operation finishes. Every tutorial written before
Terraform 1.10 also adds a DynamoDB table and a `dynamodb_table =` line; that
table is now optional machinery you do not need.

The bucket is a shell script instead of a resource, and that is not laziness: a
bucket cannot hold the state file that would create it. `bootstrap.sh` is the
one place where the chicken is allowed to come first.

Verification, because "it seemed to work" is not a state backend:

| Check | Result |
| ----- | ------ |
| `init -migrate-state` then `plan` | `No changes` (exit 0) — the 8 resources came along |
| `aws s3 ls s3://…/lab04/` | `terraform.tfstate`, 19,950 bytes |
| `head-object` | `VersionId: gnPSQ3ZW…`, `ServerSideEncryption: AES256` |
| planted `.tflock` | `plan` refused: `Error acquiring the state lock` |
| `.tflock` deleted | `No changes` again |

The lock test is the fun one. Writing a fake lock object is exactly what a
concurrent `apply` would do, and Terraform's refusal is the whole point of the
feature: two engineers cannot half-apply the same stack.

## Why this is better than a laptop state file

Exercise 3 in the same lab deletes `terraform.tfstate` and watches Terraform
plan a *second* stack, because nothing tells it the first one exists. With state
in S3, that failure mode needs an AWS outage instead of a stray `rm`. Add
versioning and a bad apply can be rolled back to the previous state object; add
SSE and the sensitive variable that ends up in state plaintext is encrypted at
rest.

The trade-off is real: the lab now needs `AWS_PROFILE=ftc-labs` for every
Terraform command, and teardown order changed — `destroy` first, bucket second.
Deleting the bucket first is the same lesson as exercise 3 with a worse view.

What is left in the lab: exercise 7 (rewrite the same graph with
`hashicorp/aws` — the credentials finally exist for it) and the stretch refactor
into `modules/three-tier/`.
