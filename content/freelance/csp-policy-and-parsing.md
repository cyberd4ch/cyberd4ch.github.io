# Case study: CSP policy & parsing analysis

**Engagement:** authorized CSP-bypass program on a large commerce platform.
**Role:** independent security researcher.
**Deliverable:** a scope memo and a measured policy-parsing report.

## The problem

The program published a Content-Security-Policy in a PDF and said only bypasses
to *that* policy count. The live site sent a different header. Before spending
any time on bypasses, the client needed an answer to a deceptively simple
question: **which policy is actually enforced, and what does it allow?**

Getting this wrong wastes the whole engagement — you either chase a bypass the
program will reject, or dismiss a real one because the PDF was stale.

## Approach

1. **Quote the printed policy** verbatim and treat it as the scope boundary.
2. **Capture the live header** on the in-scope hosts, unmodified.
3. **Reproduce the exact header locally** and test it against a page with known
   controls, so each observation has a baseline:

   | Observation | What it isolates |
   | --- | --- |
   | inline `<script>` without a nonce | baseline: inline blocked |
   | nonce'd script | nonce works |
   | `eval()` / `new Function()` | whether `'unsafe-eval'` is real |
   | string `onerror=` attribute | `script-src-attr` behaviour |
   | `<object data=…>` | `object-src` |
   | comma-separated header + discriminator page | whether a comma starts a **second policy** or extends the first |

4. **Test the comma question directly** with a discriminator page
   (`default-src 'self', img-src 'none'`): if the image is blocked, the comma
   separates two independently enforced policies.

## What was delivered

- A one-page scope memo: *"only bypasses to the printed policy are valid"*, with
  the exact directive string.
- A measurement table comparing printed policy, live header, and controls.
- A decision framework: what counts as a bypass, what is just a weak header, and
  the one genuine divergence (`'unsafe-eval'` present live, absent from the PDF)
  flagged as a question for the program rather than assumed exploitable.
- A clear "do not report" list (comma-separated header ≠ bypass; missing header
  ≠ finding).

## Result

The comma tail was **not** absorbed into `object-src` — it started a second,
independently enforced policy. Enforcement is the intersection, so the weaker
clause loosens nothing. The only real weakening was `'unsafe-eval'`, and only
against the live header, not the PDF.

Net result: **no CSP bypass found**, plus a defensible scope position that saved
the engagement from chasing invalid targets.

## Why this matters to a client

- You learn quickly whether your CSP is actually protecting anything.
- You get a written, evidence-backed boundary for what a bounty program will and
  will not accept.
- You avoid the classic trap of reporting "missing/unsafe CSP" when the program
  only pays for execution.

*Tools used: local static server, browser devtools, curl. No automated scanning.*
