---
title: "Server-side trace of the deeplink gadget: positive and negative findings"
date: 2026-11-10
category: technical
ai-assist: 100
tags: [xss, csp, deeplink, meli]
topics: [bug-bounty]
excerpt: "The deeplink gadget in Mercado Libre's home component D interpolates server-rendered deeplink and redirectUrl values into single-quoted JavaScript inside a nonce'd script. Verified against the saved bundle: a mobile User-Agent flips openInApp.shouldRedirect and mounts it anonymously — but a quote nulls redirectUrl, non-UUID d2id nulls deeplink, and </script> is edge-blocked. Sink confirmed, sanitiser confirmed, no execution."
---
*Field notes from an authorized bug-bounty engagement. No user data was
touched, no mass scanning was run, and nothing here is a submitted finding — it
is a trace, with the parts that worked and the parts that hit a wall.*

## The pattern

While auditing a large desktop web bundle, one component stood out. Call it
component `D`. It takes two props and builds an inline script by string
concatenation:

```js
D = ({ deeplink: e, redirectUrl: t = null }) => {
  // ...emitted into a <script nonce="..."> block
  var deeplink = '${e}';
  window.location.replace('${t}' + window.location.hash);
};
```

Both `e` and `t` are interpolated **raw**, inside **single quotes**, inside a
**nonce'd** inline `<script>`. That is the interesting part. A `'` in either
value does not need to break the CSP — the script was already trusted and
already carries the page nonce. A quote only changes the JavaScript, not the
browser's trust decision. If the value is server-controlled or attacker-seeded,
that is a nonce-laundering XSS primitive: the CSP is intact and irrelevant at
the same time.

The rest of this post is how far I got proving it, honestly.

## Positive: the values are server-rendered

The component doesn't invent `e` and `t` on the client. Grepping the rendered
HTML across downloaded pages found the values surfaced in a server JSON blob,
`_n.ctx.r`, and the Nordic context `<script>` referenced `_n.ctx.r.openInApp`.
Real samples from three sites looked like:

```
meli://home?d2id=784d1222-...-59ff238d4398#in_app=true&in_app_d2id=784d1222-...
meli://home?d2id=a4a5bd79-...-f17ba7b20fc4#in_app=true&in_app_d2id=a4a5bd79-...
meli://home?d2id=657766c0-...-17ee2588afd7#in_app=true&in_app_d2id=657766c0-...
```

So the source is real, server-side, and string-shaped. The sink is real: the
component's template builds `'${e}'`. The only missing link is getting the two
to meet in a live, authenticated document.

Of ten downloaded bundles, three of four desktop home pages contained the
deeplink wiring. The sink is not a one-off; it is shipped.

## Correction: it mounts without an account — and the inputs are sanitised

My first read was that the component needed a signed-in home payload. That was
wrong, and re-fetching the bundle settled it. The gate is `shouldRedirect` in
`_n.ctx.r.openInApp`, and a **mobile `User-Agent`** flips it to `true` for an
anonymous request. The mobile home then emits, verbatim:

```js
window.location.replace('https://www.mercadolibre.com.co/?skipInApp=true&matt_ignore=true' + window.location.hash);
var deeplink = 'meli://home?d2id=<uuid>#in_app_all=true&in_app_d2id=<uuid>';
```

So the sink is live without authentication. The interesting part is what happens
when you push on the two inputs:

| Input | Result |
|---|---|
| `?redirect_url=ZZ1&…` (benign) | `redirectUrl` reflects the **whole query string** |
| `?zz=abc'def` (raw or `%27`) | `redirectUrl` becomes `null`; emits `replace('null'…)` |
| `?zz=abc%5C` | backslash stays **percent-encoded** |
| `?zz=</script><b>x</b>` | blocked at the edge (13 KB block page) |
| `x-d2id: BB33'44` (non-UUID) | `deeplink` becomes `null` |
| `x-d2id: CC"55</script>66` | JSON-escaped `\"` and `</\u0073cript>`; melidata HTML-escaped |

The server builds `deeplink` from a validated `d2id` UUID and nulls it
otherwise; it builds `redirectUrl` from the query but nulls it on a quote, keeps
`\` encoded, and the edge blocks `</script>`. Both values are server-rendered
(not session-gated), and both are defended.

A quick cross-host check on a mobile UA: `www.mercadolibre.com.ar` behaves the
same as `.co` (benign query reflected, `'` nulls `redirectUrl`).
`www.mercadopago.com.ar` is a different application that never mounts this
component — its only `deeplink` string is a static `adjust_deeplink` affiliate
link. So the guard is consistent wherever the component ships.

So the honest status is: **pattern confirmed in code, source confirmed
server-side, mount confirmed for mobile — and every reachable input sanitised.
Negative result.**

## What is and isn't a finding here

Worth writing down plainly, because "I found a suspicious template" is not a
vulnerability and triage will say so:

- ❌ "The CSP is weak / allows `unsafe-inline`." Not a finding. The policy I was
  measuring against is the printed program policy
  (`script-src 'nonce' 'strict-dynamic' https: 'unsafe-inline' 'report-sample'`),
  and a header complaint by itself pays nothing anywhere.
- ❌ "The bundle contains a string concatenation." Also not a finding on its own.
- ✅ "A server-controlled value reaches that concatenation and a single quote
  executes in the origin under the page nonce." That is the bug — and it needs
  the authenticated document to prove.

The honest state is a lead with a confirmed sink and a confirmed source, and a
reproduction gap that is purely access, not technique.

## What is left (weak hypotheses only)

1. A different host or `mainDomain` path that derives `redirectUrl` from a
   less-validated source than the query string.
2. A second-order stored field that populates `openInApp` for a signed-in seller
   (this is where the dead test account actually mattered).
3. An encoding trick that survives the `'` guard yet terminates a JS string —
   none is known; `\u2028`/`\u2029` do not terminate string literals in modern JS.

Absent one of those, the right outcome is to write down the negative: the sink
is real, the mount is real, the sanitiser is real, and there is no execution.
That is a defensible result — and much better than filing a "suspicious
template" report that triage closes as N/A.

## A second nonce-copy primitive (for completeness)

The same audit turned up another "copy the page nonce" helper in
`viewability.js`:

```js
function g(e, t = document) {
  const i = t.querySelector(`${e}[nonce]`);
  return i ? (i.nonce || i.getAttribute("nonce") || "") : "";
}
function w(e) {
  const t = g("script", e.ownerDocument);
  t && e.setAttribute("nonce", t);
}
```

`window.viewability.setTag()` uses it: it parses a `pixel_tag` HTML string and
clones its `<script>` children into the page **with the document nonce**, so an
inline script in a `pixel_tag` would run. On paper that is the Basecamp-Turbo
shape again — a trusted script handing its nonce to attacker-influenced markup.

It does not lead anywhere from the outside, though:

- no in-scope bundle calls `setTag`; it is an API left for ad code;
- ADN, the one place that handles `pixel_tag`, renders it in a **cross-origin
  iframe** (`assets.meliadn.com`) instead of the top document;
- the placement endpoint the script uses (`https://www.<site>/adn/api`) returns
  **204 No Content** anonymously, and MercadoPago's goes to an out-of-scope
  `placements.*` host.

So it is a real primitive behind an ad-config door that the challenge scope does
not open. Written down, closed.

## Evidence

The analysis was run against the exact public bundle, so you can reproduce it
without trusting my notes:

- Bundle: [`home.desktop.fe5d475a.js`](https://http2.mlstatic.com/frontend-assets/homes-palpatine/home.desktop.fe5d475a.js)
- SHA-256: `7aee14a17d4fde667727f4ea7ec6a76d0ef56caf3ffc671de1f15185a6d14646`
- Component `D` at ~20,119; call site `k && k.shouldRedirect && jsx(D,{...k})`
  at ~30,304; `_n.ctx.r` accessor at ~307,934.

The engagement repo keeps a byte-for-byte copy plus a `SHA256SUMS` manifest and
a rate-limited `fetch-bundles.sh`, so the offsets above stay checkable if the
CDN ever rotates the hash.
