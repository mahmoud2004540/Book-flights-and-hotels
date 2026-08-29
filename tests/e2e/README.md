# End-to-end suites

These drive a real browser against a running server and a real database.
They are not unit tests and are not meant to be: every bug they were written
for lives in the seam between the browser, the server and the database — a
leaked net price in an RSC payload, a role that still writes after being
revoked, a reminder that sends twice — and a mock would have agreed with
whatever we assumed.

## Running them

```bash
npm run dev > /tmp/dev.log 2>&1 &      # the log is how the suites read emailed links
E2E_SERVER_LOG=/tmp/dev.log npm run test:e2e
```

One suite at a time:

```bash
E2E_SERVER_LOG=/tmp/dev.log npm run test:e2e -- admin dashboard
```

## What they need

| Variable | Why |
|---|---|
| `E2E_SERVER_LOG` | The dev mail transport prints verification and reset links to the server log. Reading them there proves the mail was actually composed and sent, not merely that a token row exists. |
| `DATABASE_URL` | A few assertions look past the API — that a role change reached the row, that an audit entry names its actor. It is also the only honest way to grant the first admin role, which the app deliberately has no endpoint for. |
| `CRON_SECRET` | The reminder route refuses every call without it. |
| `SUPPLIER_MOCK_ENABLED=true` | Real supplier credentials are not needed, and a live search would make the assertions non-deterministic. |
| `PAYMENT_MOCK_ENABLED=true` | No card is taken, but the whole settlement path runs. |
| `E2E_BASE_URL` | Optional; defaults to `http://localhost:3000`. |

Both mock flags are refused in production by the environment validator, so
these settings cannot follow the code to a live deployment.

## Writing another one

Put shared machinery in `harness.mjs` — registering an account, driving the
five-step booking flow, paying. A suite should read as the sequence of claims
it is making, and each `step()` should name a behaviour someone cares about
rather than the mechanism that implements it.

Assert on what a person or an attacker can actually observe: the response the
browser receives, the row the database holds. A test that asserts on the
implementation passes for the wrong reason the day the implementation changes.
