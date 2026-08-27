# Rehlaty — flight and hotel search and booking

Search and compare flight and hotel prices across several global suppliers in
one request, with self-service sign-up and booking — no human agent in the loop.

> **Status:** stages 0 and 1 complete, per the [roadmap](docs/ARCHITECTURE.md#11-roadmap).
> Accounts work end to end; live search starts at stage 2.

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

## What is not built yet

Supplier integration, results pages, the booking flow, and payments. Each is
its own stage in the roadmap.

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
docker run --name rehlaty-db -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=rehlaty -p 5432:5432 -d postgres:16
```

Then in `.env`:

```
DATABASE_URL="postgresql://postgres:dev@localhost:5432/rehlaty?schema=public"
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
