# Architecture plan and database schema

> Stage 0 deliverable. A rendered version is published as an Artifact alongside this file.

Rehlaty is a flight and hotel search and booking platform, built on a unified
adapter layer so that swapping any supplier or payment gateway is a
configuration change rather than a rewrite.

---

## 1. The four opening decisions

| Decision | Choice | What it means in the design |
|---|---|---|
| Business model | Affiliate commission | The user completes payment at the supplier and we take a commission. No IATA/TIDS needed at this stage. The `Booking` and `Payment` tables are still built in full now, so becoming a full travel agent later is an activation rather than a rebuild. |
| Suppliers | Amadeus, Travelpayouts, Duffel, Booking.com | All four sit behind one `SupplierAdapter` interface. Implementation order: Amadeus first (stages 2–3, since the brief is built on its endpoints), then Travelpayouts, then Duffel and Booking.com once their commercial approvals land. |
| Payments | Stripe first; Paymob and Tap as adapters | One `PaymentProvider` interface. Stripe is the real implementation in stage 5; Paymob (Egypt) and Tap (Gulf) are routed in later by registration country and currency. |
| Hosting | Vercel + Neon + Upstash | Next.js on Vercel, PostgreSQL on Neon through Prisma, Redis on Upstash for cache, rate limiting and BullMQ queues. PDFs on Cloudflare R2. |

**Language:** English only. This reverses section 9 of the original brief,
which specified Arabic-first with full RTL, at the client's direction. Copy
still lives in `messages/` rather than inline in components, so adding a
language back is configuration, not a rewrite.

---

## 2. The licensing boundary — commercial, not technical

**Issuing a real, flyable ticket is not a coding problem.** The
`test.api.amadeus.com` environment returns realistic flights and prices and
accepts booking requests, but **it does not issue tickets valid for travel**.
Moving to Production requires a registered business entity, a commercial
agreement with Amadeus, and IATA or TIDS accreditation.

- **Works fully from day one:** real flight and hotel search, price
  comparison, filtering and sorting, user registration, profiles and saved
  travellers, a five-step booking flow, a user dashboard, an admin dashboard,
  and email notifications — all on real supplier data.
- **Needs a licence:** issuing a PNR and a flyable ticket, and taking the
  customer's money for that ticket. Until then the completion button hands off
  to the supplier with a commission link — which is exactly the affiliate model.

---

## 3. Architecture — five layers

```
Browser — Next.js App Router · RSC · TanStack Query
        ↓  request + JWT
Request edge — API Routes: Zod validation · rate limit · session guard · idempotency
        ↓  validated commands
Domain services — search · pricing · booking · payment · markup
        ↓  normalised types only   ← the one insulating boundary
Adapter layer — SupplierAdapter + Normalizer · PaymentProvider
        ↓  HTTPS · keys from the environment
External parties — Amadeus · Travelpayouts · Duffel · Booking.com · Stripe · Paymob · Tap
```

Shared infrastructure hangs off the domain layer: PostgreSQL (Neon, via
Prisma) · Redis (Upstash: offer cache, rate limiting, BullMQ) · Cloudflare R2
(ticket PDFs) · Resend (React Email templates) · Sentry.

**The governing rule:** each layer knows only the layer beneath it. The UI does
not know Amadeus exists, and the booking logic never sees a supplier's response
shape. Adding Duffel later is a new adapter file plus a row in `suppliers`.

### Why API Routes rather than a separate server

The affiliate model means the real load is **search** — many short operations,
which is what Vercel Functions do well. A separate server becomes necessary
once real ticket issuance brings long-running operations, and at that point
`src/server/` moves across unchanged because it is written with no dependency
on Next. That separation is deliberate from the first step.

---

## 4. The adapter layer — one contract

`src/server/suppliers/types.ts`

```ts
// The only contract the booking logic knows. No supplier-specific type crosses it.
export interface SupplierAdapter {
  id: SupplierId;
  capabilities: SupplierCapabilities;      // who supports hotels? who supports cancellation?

  // search
  autocomplete(q: string, kind: PlaceKind): Promise<NormalizedPlace[]>;
  searchFlights(p: FlightSearchParams): Promise<NormalizedFlightOffer[]>;
  searchHotels(p: HotelSearchParams): Promise<NormalizedHotelOffer[]>;

  // price confirmation before payment — mandatory
  confirmFlightPrice(offerId: string): Promise<PricedOffer>;
  confirmHotelPrice(offerId: string): Promise<PricedOffer>;

  // booking
  bookFlight(o: FlightOrderRequest): Promise<BookingConfirmation>;
  bookHotel(o: HotelOrderRequest): Promise<BookingConfirmation>;
  cancelBooking(ref: string): Promise<CancellationResult>;
}

// Every result carries the net price; markup is applied in the service layer,
// so it stays editable from the admin dashboard without touching adapters.
export interface NormalizedFlightOffer {
  offerId: string;                // our identifier, not the supplier's
  supplierId: SupplierId;
  supplierOfferRef: string;       // the supplier's own id, for pricing and booking
  itineraries: Itinerary[];       // outbound / return / multi-city
  netPrice: Money;                // the supplier's price
  fareBreakdown: FareBreakdown;   // base + taxes + fees
  baggage: BaggageAllowance;
  refundable: boolean;
  expiresAt: Date;                // after this, re-pricing is required
}
```

**A hard rule (section 15):** no fake data on the production path. Exactly one
`MockAdapter` lives in `src/server/suppliers/mock/`, enabled only by
`SUPPLIER_MOCK_ENABLED=true`, and it refuses to run when
`NODE_ENV=production`. It exists for integration and E2E tests only.

---

## 5. The search flow

The brief specifies `Promise.allSettled` — one supplier failing must not spoil
the whole result:

1. **A composite cache key** built from every search parameter (route, dates,
   passengers, cabin, currency). A Redis hit returns immediately, with a 5–10
   minute lifetime.
2. **Parallel calls** to every active supplier that handles the service type,
   each with an 8-second budget — under the 15-second total, leaving room to merge.
3. **Circuit breaker:** five consecutive failures stops a supplier for 60
   seconds. The state lives in Redis so it is shared across instances.
4. **Merge and deduplicate:** the same flight from different suppliers collapses
   into one result at the cheapest price, keeping each supplier's reference for pricing.
5. **Markup** is applied immediately after the merge, so the user only ever
   sees the final price; `netPrice` never reaches the client.
6. **Progressive rendering:** each supplier's results appear as they arrive,
   with skeletons for the rest.

Every call is logged to `supplier_logs` with its duration and status code.

---

## 6. The booking flow — five steps, three guards

| # | Step | Detail |
|---|---|---|
| 1 | Select the offer | Held in the session, not the database |
| 2 | **Mandatory re-pricing** | Call the supplier's `pricing` endpoint again, always |
| 3 | Traveller details | Name as in the passport · number and expiry · age validation |
| 4 | Extras | Baggage · seat selection · travel insurance |
| 5 | Payment and confirmation | Full summary · terms acceptance · payment · then issue the booking |

**The three guards:**

- **A 15-minute session timer** with a visible countdown; expiry releases the offer.
- **Re-pricing:** if the price moved, show a clear warning and require explicit
  consent before continuing. Airfares change between the moment of search and
  the moment of payment, and skipping this step means selling a price that no
  longer exists.
- **An idempotency key** on every booking operation prevents double bookings on
  repeated clicks or a dropped connection.
- **Partial failure:** payment succeeded but booking failed → immediate
  automatic refund, an admin alert, and a notification to the user.

Every step is reversible without losing entered data.

---

## 7. Folder layout

Section 15 requires files under 300 lines; this layout makes that natural
rather than effortful.

```
src/
├─ app/
│  ├─ [locale]/
│  │  ├─ (marketing)/            // home · about · terms · privacy
│  │  ├─ (search)/flights|hotels/
│  │  ├─ (booking)/checkout/[step]/
│  │  ├─ (account)/dashboard/    // my bookings · favourites · profile
│  │  └─ (admin)/                // role-guarded
│  └─ api/
│     ├─ auth/[...nextauth]/
│     ├─ search/{flights,hotels,places}/
│     ├─ offers/[id]/price/      // re-pricing
│     ├─ bookings/               // POST with an idempotency key
│     ├─ payments/{intent,webhook}/
│     └─ admin/
│
├─ server/                       // nothing here imports from next/* — deliberate
│  ├─ suppliers/
│  │  ├─ types.ts                // the shared contract
│  │  ├─ registry.ts             // selecting active suppliers
│  │  ├─ orchestrator.ts         // allSettled + merge + deduplicate
│  │  ├─ resilience/             // retry · circuit breaker · timeouts
│  │  ├─ amadeus/                // client · normalizers · mappers
│  │  ├─ travelpayouts/  duffel/  bookingcom/
│  │  └─ mock/                   // tests only — blocked in production
│  ├─ payments/                  // PaymentProvider + stripe/ paymob/ tap/
│  ├─ booking/                   // booking state machine · idempotency · refunds
│  ├─ pricing/                   // markup · discount codes · currency conversion
│  ├─ notifications/             // React Email templates + BullMQ jobs
│  └─ pdf/                       // ticket generation
│
├─ lib/                          // zod schemas · date and currency formatting
├─ components/                   // ui/ · flights/ · hotels/ · booking/
└─ messages/                     // en.json — no hardcoded strings in components

prisma/          // schema.prisma · migrations/ · seed.ts · seed.sql
tests/           // unit/ · integration/ · e2e/ (Playwright)
docs/            // ARCHITECTURE.md · postman-collection.json · DEPLOYMENT.md
```

---

## 8. Database schema

Every table from section 6, plus the tables NextAuth needs. The full schema
lives in [`prisma/schema.prisma`](../prisma/schema.prisma); it validates and
generates 21 tables, 24 indexes and 16 foreign keys.

### Tables

`users` · `profiles` · `saved_travelers` · `accounts` · `sessions` ·
`verification_tokens` · `password_reset_tokens` · `searches` · `offers_cache` ·
`bookings` · `booking_items` · `passengers` · `payments` · `refunds` ·
`suppliers` · `markup_rules` · `promo_codes` · `favorites` · `notifications` ·
`supplier_logs` · `audit_logs`

### Deliberate departures from section 6

- **`Decimal(12,2)` rather than floating point** for every amount. Computing
  money in floats produces sub-cent drift that accumulates — unacceptable in a
  payment system. Verified: `0.10 + 0.20` returns exactly `0.30`.
- **`discountAmount` and `reference` added** to `bookings`. The brief asked for
  discount codes in section 4.7 without linking them to a booking, and users
  need a visible reference distinct from the internal `id`.
- **`favorites` is a new table.** Section 4.6 asked for a favourites list and a
  price-change alert, but section 6 defined no table for it.
- **`expiresAt` on `bookings`.** The 15-minute deadline has to live in the
  database rather than in memory, so the BullMQ sweep job can find it.
- **Passport numbers in `...Enc` columns.** Encryption is required by section
  8, and the naming makes any plaintext write an obvious review defect.
- **`priority` on `markup_rules`.** Without it, an "all suppliers" rule and an
  "Egypt only" rule conflict with no resolution.

---

## 9. Security and performance

| Area | Decision |
|---|---|
| Authentication | A 15-minute JWT plus a 30-day refresh token in an `httpOnly`, `SameSite=Lax` cookie. Five failed attempts locks for 15 minutes, counted in Redis against email and IP together. |
| Sensitive data | Passport numbers encrypted with AES-256-GCM using a key from the environment. Card data never touches our servers — Stripe Elements keeps us in PCI-DSS SAQ-A scope. |
| Rate limits | 30 searches per minute per user and 100 per IP, sliding window on Upstash. Autocomplete is debounced 300ms client-side with a separate server limit. |
| Errors | Generic messages to the user, full detail to Sentry. No empty `try/catch` — every third-party call returns an explicit success or a classified failure. |
| Performance | 5–10 minute search cache, ISR for static destination pages, per-route code splitting, WebP images through `next/image`. Target: Lighthouse ≥ 90 and LCP under 2.5s. |
| Compliance | An audit log for every sensitive operation, data export and account deletion (GDPR), a consent log, CSP and HSTS headers, and CSRF protection on every state-changing request. |

---

## 10. Environment variables

The full template is in [`.env.example`](../.env.example), with each variable
tagged by the stage that needs it. No key ever lives in code — section 3.3.

---

## 11. Roadmap

Ordered as section 16 specifies, with a pause for approval after each stage
(section 15).

| # | Stage | The deliverable that proves it is done | Status |
|---|---|---|---|
| 0 | Foundation and setup | A running Next.js project, Prisma migrated, the design system and tokens | **Done** |
| 1 | Authentication and profile | Email sign-up with verification, Google and Apple, password reset, saved travellers | **Done** |
| 2 | Amadeus integration and flight search | A complete adapter and normalizer, a results page with filters and sorting, a ±3 day date strip, progressive rendering | Next |
| 3 | Hotel search and map | A dual list-and-map view, a hotel detail page, amenity and rating filters | Later |
| 4 | Booking flow | The five steps, mandatory re-pricing, the session timer, traveller validation | Later |
| 5 | Payment and issuance | Stripe with 3DS, verified webhooks, a ticket PDF, a confirmation email | Later |
| 6 | User dashboard | Upcoming, past and cancelled bookings, cancellation and refunds under supplier terms, pre-travel reminders | Later |
| 7 | Admin dashboard | Statistics, booking and user management, markup rules, supplier activation, tiered permissions | Later |
| 8 | Performance, security and deployment | Unit, integration and E2E tests, a security audit, Lighthouse ≥ 90, deployment to Vercel, a pre-launch checklist | Later |

---

## 12. Open items

1. **Project name** — "Rehlaty" is a placeholder, set in `src/lib/config.ts`.
2. **Supplier order** — currently Amadeus → Travelpayouts → Duffel →
   Booking.com. Promoting Travelpayouts for faster commission is a cheap change.
3. **Default markup** for `DEFAULT_MARKUP_PERCENT` — 3%–6% is typical.
4. **Target markets** — determines when Paymob and Tap are added, and the
   default currency.

Standing commitments (section 15): no code before approval, a pause after each
stage, strict TypeScript with no `any`, files under 300 lines, and no fake data
on the production path.
