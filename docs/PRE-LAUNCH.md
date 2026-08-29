# Pre-launch checklist

Work through this in order. Everything above the line is code and
configuration; everything below it is commercial, and no amount of engineering
finishes it.

---

## 1. The database

- [ ] A PostgreSQL instance exists (Neon's free tier is enough to start).
- [ ] `DATABASE_URL` is the **pooled** connection string — the one with
      `-pooler` in the host. The direct one exhausts its connection limit under
      serverless traffic.
- [ ] Every migration in `prisma/migrations/` has been applied, in order.
- [ ] `prisma/seed.sql` has been run. Its verification query should report
      4 suppliers, 2 markup rules, 1 promo code.
- [ ] One account has been promoted by hand:
      `UPDATE "users" SET "role" = 'SUPER_ADMIN' WHERE "email" = '…';`
      Sign out and back in afterwards — the session token still says `USER`.

## 2. Environment

Every variable marked `[now]` in `.env.example` is set in the host.

- [ ] `AUTH_SECRET` — 40+ random characters, not shared with any other project.
- [ ] `ENCRYPTION_KEY` — exactly 64 hex characters. **Losing it makes every
      stored passport number unreadable.** Keep a copy somewhere that is not
      the hosting provider.
- [ ] `CRON_SECRET` — set, and different from `AUTH_SECRET`. Without it the
      reminder route refuses every call.
- [ ] `NEXT_PUBLIC_APP_URL` — the real domain. Emailed links are built from it,
      so a stale value sends people to the wrong host.
- [ ] `SUPPLIER_MOCK_ENABLED` and `PAYMENT_MOCK_ENABLED` are **unset or false**.
      The app refuses to start otherwise, which is the intended behaviour, but
      finding that out during a deploy wastes a deploy.
- [ ] `RESEND_API_KEY` — without it nobody can confirm an account.

## 3. Before the first deploy

- [ ] `npm audit` reports zero vulnerabilities.
- [ ] `npm run lint`, `npm run typecheck` and `npm test` all pass.
- [ ] `npm run test:e2e` passes against a local build.
- [ ] `npm run build` succeeds with `.env` **removed** — this catches anything
      that reads a secret at build time rather than at request time.

## 4. After the first deploy

- [ ] The home page loads over HTTPS and the theme switch survives a refresh.
- [ ] Sign-up sends a real confirmation email, and the link works.
- [ ] A search returns results from the live supplier, not an error.
- [ ] `curl -I https://yourdomain` shows `content-security-policy`,
      `strict-transport-security` and `x-frame-options`.
- [ ] `/api/cron/reminders` returns 401 without the secret.
- [ ] `/admin` returns 404 for a signed-out visitor and for an ordinary account.
- [ ] The Vercel cron for `/api/cron/reminders` appears in the dashboard and
      has run once.
- [ ] Lighthouse scores 90+ on the live domain — the numbers in this repo were
      measured locally, where there is no network latency.

## 5. Payments

- [ ] Stripe is in **live** mode and the keys in the host are the live pair.
- [ ] The webhook endpoint is registered at
      `https://yourdomain/api/payments/webhook` and its signing secret is in
      `STRIPE_WEBHOOK_SECRET`.
- [ ] A real card has been charged the smallest possible amount, refunded, and
      both movements appear in `payments` and `refunds`.
- [ ] The refund path has been exercised once end to end: cancel a confirmed
      booking and confirm the money returns.

---

## What engineering cannot finish

The application is complete. It cannot sell a ticket until these exist, and
none of them is a code change.

- [ ] **A supplier account that can issue.** Duffel is the shortest path: it
      makes us the merchant of record without an IATA licence, and the
      traveller never leaves the site. Amadeus has wider inventory but issuing
      on it needs a licence, so until then a booking there is a hand-off.
- [ ] **A registered company and a bank account** the payment provider will
      settle into.
- [ ] **Terms, privacy and refund policy reviewed by someone qualified.** The
      pages in this repo are placeholders written to have the right shape, not
      legal advice.
- [ ] **A support address that a person reads.** Cancellation emails and
      failed-issuance alerts point somewhere; that somewhere has to be staffed.
- [ ] **A decision on the name.** `BRAND` in `src/lib/config.ts` still says
      "Rehlaty", which was a placeholder from the first day.
- [ ] **A decision on the markup.** `DEFAULT_MARKUP_PERCENT` is 4.5. It is the
      difference between a business and a hobby, and no one has confirmed it.
