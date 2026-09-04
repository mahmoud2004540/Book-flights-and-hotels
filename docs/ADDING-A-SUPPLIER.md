# Adding a supplier

Three suppliers have been added this way — Amadeus, Duffel, Travelpayouts — and
each one touched a single directory plus two lines in the registry. Nothing in
the orchestrator, the pricing, the booking flow or the UI knows how many
suppliers exist.

This is the recipe, and the reasoning behind the parts that are easy to get
wrong.

## What you need before writing code

- **Credentials**, and an idea of what the account costs per booking.
- **The response shapes**, from their documentation.
- **A decision**: can a fare from this supplier actually be *bought* through us?
  It changes the design more than anything else below. Amadeus and Duffel can
  be. Travelpayouts cannot — it publishes prices and links out.

## The directory

```
src/server/suppliers/<name>/
├─ client.ts      HTTP, auth, timeouts, error classification
├─ schemas.ts     zod schemas for the responses you read
├─ normalize.ts   their shapes → ours; the only file that knows theirs
└─ adapter.ts     implements SupplierAdapter
```

Then two lines in `registry.ts`, and a row in `suppliers` (the seed has four;
add yours to `prisma/seed.ts` and `prisma/seed.sql` together).

## The rules that matter

**Be strict about response shapes.** Every adapter after Amadeus was written
without a live key, against documentation. Strict schemas are what make that
safe: a field that differs fails the parse, the circuit breaker drops the
supplier, and the search still answers from the others. A loose schema turns
the same mistake into a price read out of the wrong field, which nobody
notices until a traveller is charged it.

**Money is a string, from their response to the database.** Never parse it to a
number on the way through. If a supplier sends a JSON number — Travelpayouts
does — convert it with `toFixed(2)` immediately and keep the string. A price
that has been through binary floating point is a price that can be a cent
wrong, and it will be wrong in the direction nobody checks.

**Drop what you cannot sell, do not convert it.** An offer priced in a currency
outside `CURRENCIES` is dropped. We hold no exchange rate, and inventing one
quotes a price we cannot charge.

**Do not invent what the supplier did not send.** No guessed tax split, no
plausible routing, no assumed baggage allowance. Unknown is `null`, and
`refundable` is `false` — because "we do not know" must never read as "yes".

**Return null when credentials are missing.** `static create()` returning null
is how the registry skips a supplier that is switched on but not configured.
Search then degrades instead of failing, which is verified.

## If it cannot be booked here

Set `capabilities.booking: false`, mark every offer `bookable: false`, and give
it a `bookingUrl`. The offer is shown, labelled, and links out.

`findOfferForBooking` refuses unbookable offers server-side. Do not rely on the
button being hidden — a guard that only exists in the UI is not a guard.

## Ordering

`suppliers.priority` decides ties only: every active supplier is searched at
once and the cheapest result wins regardless of order. The order settles the
case where two suppliers return the same fare at the same price, and there it
should favour whoever gives the better booking — the one that issues.

Reorder from **Admin → Suppliers** with the arrows. It swaps two rows in one
transaction, because priorities carry no unique constraint and a half-applied
swap would leave two suppliers claiming the same place.

## Before you call it done

- Unit tests for the normalizer against a fixture in their documented shape.
  That fixture is the contract: when the real API differs, it is where the
  correction goes.
- Switch the supplier on with no credentials and confirm search still returns
  results from the rest.
- `npm test && npm run test:e2e`.
