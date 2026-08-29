# Security audit

Written at the end of stage 8, against the code on this branch. It records
what was checked, what was wrong and fixed, and — the part that matters more —
what is still weak and why.

## What was found and fixed

### The supplier's net price reached the browser

The search API sent every offer's `supplierPayload` (the supplier's verbatim
offer object) and a `fareBreakdown` whose total was our **cost**, sitting
beside the marked-up price. Subtracting one from the other gave the margin
exactly: `244.00` under a `254.98` fare.

It was invisible because the TypeScript type said otherwise — `Omit` removes a
field from a type, not from an object at runtime, so the spread that built the
public offer carried both fields through and compiled without complaint.

Fixed by destructuring both away at the boundary and rescaling the breakdown
onto the price actually charged. `tests/e2e/leak.e2e.mjs` now asserts over
every response the browser receives, RSC payloads included, because neither
leak appeared in the DOM.

### Anyone could mail-bomb any address

`/api/auth/forgot-password` had no limit. It answers identically whether or not
the address is registered — correct, and the reason it must be rate limited:
posting a thousand times put a thousand messages in a stranger's inbox, from
anywhere, with no account.

A first attempt counted the reset tokens already written. That does not work:
issuing a link deliberately deletes the previous one, so the count is always
one and the limit never fires. It now counts in `auth_attempts` under a
namespaced identifier, which survives that deletion. Three messages per address
per hour; the responses stay identical after the cap, so the throttle does not
become the enumeration oracle the neutral answer exists to prevent.

`/api/auth/register` was limited too: each accepted sign-up mails whatever
address was typed, which is an open relay pointed at strangers and ends with
the sending domain blocked.

### A dependency advisory

`prisma` (a devDependency) pulled `deepmerge-ts < 8.0.0`, which has a stack
exhaustion on recursive object graphs. npm's suggested fix was a major
downgrade of Prisma. Pinned forward with an `overrides` entry instead;
`npm audit` reports zero.

## What is deliberately weak

**`'unsafe-inline'` in `script-src`.** Next injects inline bootstrap scripts
whose contents differ per page, so only a per-request nonce can allow them.
Next takes that nonce from the request's own CSP header, and a proxy cannot put
it there — `NextRequest` headers are immutable, so it arrives at the renderer
as `undefined` and every script on the page is refused. Measured, not assumed:
with a nonce policy the home page logged fourteen refusals and shipped dead.

So CSP here will not stop an injected inline script. What it does still do, and
what most of its value is: no third-party script origin may load, an injected
script has nowhere to send what it steals because `connect-src` is closed, the
site cannot be framed, no form may post elsewhere, and no `<base>` may redirect
relative URLs. The condition that would make script injection possible is also
absent — the app renders no user-supplied HTML, and its one inline script is a
constant.

**In-memory request limits.** `src/server/rate-limit.ts` keeps its windows in
memory, so each serverless instance has its own and an attacker spread across
instances gets a multiple of the limit. It is a first line, not the control.
Where a limit has to hold — reset emails — the count is in the database. Moving
the rest to Upstash is the remaining work, and the module is the only thing
that changes.

**Roles in the session token.** A page reads the viewer's role from the JWT,
which refreshes on its own schedule, so a revoked admin can still *read* an
admin page for up to that window. Every mutation re-reads the role from the
database instead, so nothing can be *changed* by a revoked account. That
asymmetry is the intended trade.

## What holds

| | |
|---|---|
| Passport numbers | AES-256-GCM, random IV per value; only a masked form ever reaches the browser |
| Passwords | bcrypt; five failed attempts lock the identifier for fifteen minutes |
| Account enumeration | Sign-up, sign-in and reset answer identically for known and unknown addresses, in wording and in timing |
| Tokens | SHA-256 hashed, single use; issuing a new reset link invalidates the old one |
| Payment webhooks | Signature verified; an unsigned call is refused before anything is read |
| Card details | Never touch our servers — Stripe Elements, which is what keeps this inside PCI-DSS SAQ-A |
| Admin routes | Capability-checked, refused as 404 so they do not confirm they exist; every change writes an audit entry naming its actor |
| Lockout | Nobody demotes or blocks themselves; the last super admin cannot be removed; the last active supplier cannot be switched off |
| Secrets | None in the repository; the mock supplier and mock payment provider refuse to run in production |
| Cron | Shared secret compared in constant time; without it the route refuses every call |

## Lighthouse

Measured against a production build, mobile emulation, on this machine — so
these are a floor for the code, not a promise about a live domain, where
network latency is real. Re-run on the domain before launch.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 97 | 100 | 100 | 100 |
| Flight results | 95 | 100 | 100 | 100 |
| Hotel results, list and map | 97 | 100 | 100 | 100 |
| Sign in | 96 | 100 | 100 | 100 |

Three accessibility defects were found and fixed on the way: `aria-label` on a
bare `<span>` (prohibited, so the star rating announced nothing at all),
`role="tabpanel"` on a `<form>` (a browser given both treats the element as
neither), and two colour tokens under WCAG AA — `--brand` at 3.98:1 as text on
its own soft background, `--fg-faint` at 3.65:1 on white and 3.10:1 on
`--surface-2`. Both were darkened; the buttons that use `--brand` as a
background gained contrast rather than losing any.

The hotels page went from 82 to 97 by not mounting the map where it is not
visible. On a phone the list is shown first and the map sits behind a switch,
but it was still being mounted off-screen — 245KB and roughly 1.2s of parsing
downloaded before the list was usable, for something nobody had asked to see.

## Running the checks

```bash
npm audit                     # dependencies
npm test                      # the rules, including the lockout cases
npm run test:e2e -- abuse leak admin   # the boundaries, in a real browser
```
