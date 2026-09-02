# Weissflug — flight and hotel search and booking

Search and compare flight and hotel prices across several global suppliers in
one request, with self-service sign-up and booking — no human agent in the loop.

> **Status:** all eight stages complete, per the
> [roadmap](docs/ARCHITECTURE.md#11-roadmap). What remains before it can sell a
> ticket is commercial, not technical — see the
> [pre-launch checklist](docs/PRE-LAUNCH.md).

---

## What works today

- Next.js 16 on the App Router with strict TypeScript (`strict` plus `noUncheckedIndexedAccess`).
- A design system built on tokens, with a three-state theme (light / dark / follow the OS).
- A complete Prisma schema with every index the brief requires.
- A seed for suppliers, markup rules and discount codes.
- Environment validation at boot — an incomplete configuration fails immediately with a readable message.
- Copy lives in `messages/`, never inline in components, so adding a second language later is configuration rather than a rewrite.
- Full authentication: email sign-up with verification, sign-in, password reset, Google and Apple sign-in when configured, and lockout after five failed attempts.
- Account pages behind a session guard: bookings, profile and saved travellers.
- Passport numbers encrypted at rest with AES-256-GCM; only a masked form ever reaches the browser.
- Flight search across suppliers behind one adapter interface, with retry, a circuit breaker, per-call timeouts and a shared result cache.
- Two supplier adapters: Amadeus, and Duffel — which reaches airlines Amadeus does not and makes us the merchant of record without an IATA licence. Adding a third is one directory; nothing else changes.
- Results ranked cheapest first across every supplier, with an explicit tie-break: an identical fare from two suppliers goes to the one that issues the ticket through us.
- A results page with filters, three sort orders, a ±3 day date strip and skeleton loading.
- Airport autocomplete, debounced 300ms.
- Markup applied server-side. Neither the supplier's net price, its verbatim offer object, nor a fare breakdown totalling our cost ever reaches the browser — the breakdown is rescaled onto the price actually charged, so its lines add up to what the traveller pays.
- Hotel search with a linked list and map view, filters for price, stars, amenities and free cancellation, and three sort orders.
- A five-step booking flow with mandatory re-pricing, a visible session timer, passport and age validation, and an idempotency key that survives a double-click.
- Payment through Stripe Payment Intents with 3-D Secure, a signature-verified webhook, a PDF ticket, and confirmation emails.
- Automatic refund when a payment succeeds but issuance fails, with an admin alert and an email to the traveller.
- A dashboard that splits bookings into upcoming, past and cancelled, with a detail page carrying the itinerary, travellers, payments, refunds and the ticket.
- Self-service cancellation that quotes the refund *before* anything is cancelled and re-quotes server-side on confirm, refunding through the payment provider.
- A 24-hour pre-travel reminder on a secret-protected cron route, deduplicated so a scheduler retry cannot send twice.
- An admin area on three tiers — support, finance, super admin — where every page and every route checks a named capability, not a role name.
- Statistics, booking and user search, markup rules and supplier activation, with every change written to an audit log naming who made it.
- Lockout rules that hold whether the request came from the UI or a script: nobody demotes or blocks themselves, the last super admin cannot be removed, and the last active supplier cannot be switched off.

## Testing

`npm test` runs the rules — pricing, cancellation, bucketing, supplier ranking,
permissions and the lockout cases — with no database and no browser.

`npm run test:e2e` runs eight suites against a real browser, a real server and a
real database. They are not unit tests and are not meant to be: every bug they
were written for lives in the seam between those three. See
[tests/e2e/README.md](tests/e2e/README.md).

| Suite | What it holds to account |
|---|---|
| `search` | Results come back, the badged offer really is the cheapest, an invalid query is refused rather than crashing |
| `auth` | Verification is required, a wrong password and an unknown address are indistinguishable, five failures lock the identifier |
| `abuse` | The endpoints reachable without an account: reset emails capped per address, sign-up capped per IP, no unsigned webhook, no open cron |
| `leak` | Nothing the browser receives reveals what we paid the supplier — checked over every response, RSC payloads included |
| `booking` | Re-pricing consent, passport validation, the summary, the idempotent confirm |
| `payment` | Payment, settlement, a real PDF ticket, a rejected forged webhook |
| `dashboard` | Bucketing, the refund quoted before cancelling, another account refused, the reminder that will not send twice |
| `admin` | Every tier against every page and route, the lockout rules, the audit trail |

## What is not built yet

Nothing in the brief. The open items are commercial — a supplier account that
can issue, live payment keys, reviewed policy pages — and are listed in
[docs/PRE-LAUNCH.md](docs/PRE-LAUNCH.md).

### Your first administrator

Sign up through the app, then promote that account once:

```sql
UPDATE "users" SET "role" = 'SUPER_ADMIN' WHERE "email" = 'you@example.com';
```

Sign out and back in afterwards — the session token carries the role, and the
one you are holding still says `USER`. From then on roles are granted from
**Admin → Users**, and only a super admin may grant one.

The seed deliberately creates no admin account: a hardcoded one is a credential
shared by everybody who can read the repository.

### Running payments without Stripe keys

Set `PAYMENT_MOCK_ENABLED=true` to use the mock payment provider. No card is
taken and no money moves, but the real settlement path runs: an amount ending
in `.01` is declined, `.02` stays processing, anything else succeeds. It is
refused in production by both the environment validator and the registry.

### Pre-travel reminders

`/api/cron/reminders` sends the 24-hour reminder. `vercel.json` schedules it
hourly; Vercel signs its own cron calls with `Authorization: Bearer $CRON_SECRET`,
so setting `CRON_SECRET` is all that is needed. Any other scheduler works the
same way — send that header. Without the variable the route refuses every call,
because an open endpoint that sends email is a spam relay.

The window is two hours wide so an hourly schedule cannot miss a departure by
landing between ticks, and every send is recorded before it goes out, so a
scheduler retry finds the record and does not send again.

### Map tiles

The map uses MapLibre, which needs no access token, with OpenStreetMap tiles by
default. Those tiles are fine for development but their usage policy rules out
production traffic — set `NEXT_PUBLIC_MAPBOX_TOKEN` before launch and the style
switches automatically. If tiles fail to load for any reason the map says so and
the pins and list keep working.

### Running search without Amadeus credentials

Set `SUPPLIER_MOCK_ENABLED=true` in `.env` to use the mock supplier, which
returns deterministic fixture data so the whole pipeline can be exercised
locally. It is refused in production by both the environment validator and the
supplier registry.

---

## Running it locally

### 1. Requirements

- Node.js 20 or newer
- A PostgreSQL database — [Neon](https://neon.tech) is free and enough for development

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Then open `.env` and fill in the variables marked `[now]`:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | The **pooled** connection string from the Neon dashboard — see below |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |
| `DEFAULT_MARKUP_PERCENT` | A number between 0 and 100 — defaults to `4.5` |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Generate with `openssl rand -hex 32` |
| `RESEND_API_KEY` | Optional locally — without it, emails print to the server console |

Everything else is filled in when its stage arrives; leaving them empty does
not stop the app from running.

<details>
<summary>Getting <code>DATABASE_URL</code> from Neon</summary>

1. Create an account at [neon.tech](https://neon.tech) — the free plan is enough.
2. Create a project and pick the region closest to your users.
3. Open **Connection Details** on the project page.
4. Choose **Pooled connection**, not Direct. The pooled string is the correct
   one for serverless hosting; a direct connection exhausts its limit quickly.
5. Copy the whole string into `.env`, in quotes. It should end with
   `?sslmode=require`, and the host should contain `pooler`.

**Already using Neon for another project?** Share the account, but not the
database. This schema creates tables named `users`, `accounts`, `sessions`,
`payments` and `notifications` — names another project very likely already
uses, which would fail the migration. Instead create a new database inside the
same project (**Databases → New Database**) and use its connection string.

</details>

### 4. Set up the database

```bash
npm run db:generate           # generate the Prisma client
npx prisma migrate deploy     # apply the existing migrations
npm run db:seed               # seed suppliers and markup rules
```

`migrate deploy` applies the migration in `prisma/migrations/` as written, and
is the right command for any environment other than your own machine. Use
`npm run db:migrate` only when you change `schema.prisma` and need to generate
a new migration.

To confirm it worked:

```bash
npm run db:studio
```

You should see 21 tables, four rows in `suppliers`, and two markup rules.

<details>
<summary>Alternative: local PostgreSQL instead of Neon</summary>

```bash
docker run --name weissflug-db -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=weissflug -p 5432:5432 -d postgres:16
```

Then in `.env`:

```
DATABASE_URL="postgresql://postgres:dev@localhost:5432/weissflug?schema=public"
```

</details>

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`node:test` via tsx) |
| `npm run test:e2e` | End-to-end suites in a real browser |
| `npm run typecheck` | Type check without emitting |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply existing migrations — use this everywhere else |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run db:seed` | Seed operational data |

---

## Project layout

```
src/
├─ app/[locale]/     Pages
├─ components/       ui/ (primitives) · layout/ · home/
├─ i18n/             Routing and navigation configuration
├─ lib/              Config · env validation · formatting · Prisma
└─ proxy.ts          Locale resolution

messages/            en.json — all user-facing copy
prisma/              schema.prisma · migrations/ · seed.ts · seed.sql
docs/                ARCHITECTURE.md — the full architecture plan
```

**Where to change what:** the project name, currencies, timeouts and rate
limits all live in `src/lib/config.ts` alone. All copy is in `messages/`.
Colours and fonts are in `src/app/globals.css`.

---

## Contributing rules

Taken from section 15 of the brief, and binding:

- Strict TypeScript — no `any`.
- Files under 300 lines; anything larger gets split into modules.
- No empty `try/catch` — every third-party call returns an explicit result.
- No fake data on the production path; the mock adapter is isolated and blocked.
- No secrets in code — everything comes from environment variables.
- No hardcoded strings in components — all copy lives in `messages/`.

---

## An important commercial note

Issuing real, flyable tickets through Amadeus Production requires a registered
business entity, a commercial agreement, and IATA or TIDS accreditation. The
`test.api.amadeus.com` environment returns realistic data and prices but
**does not issue real tickets**. Details in the
[architecture plan](docs/ARCHITECTURE.md#2-the-licensing-boundary).
