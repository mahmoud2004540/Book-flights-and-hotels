import { BASE, launch, newPage, reporter } from "./harness.mjs";

const { step, finish } = reporter("search");
const browser = await launch();
const page = await newPage(browser);

await page.goto(
  `${BASE}/flights?origin=CAI&destination=DXB&departDate=2026-12-05&adults=1&cabin=ECONOMY&currency=USD`,
  { waitUntil: "load" },
);
await page.waitForSelector("main ul > li", { timeout: 20000 });
const offers = await page.locator("main ul > li").count();
step("flights come back", offers > 0, `${offers} offers`);

const prices = async () =>
  (await page.locator("main ul > li [data-offer-price]").evaluateAll((cards) =>
    cards.map((card) => Number(card.getAttribute("data-offer-price"))),
  ));

// The list opens on "best", which balances price against duration on purpose —
// the cheapest flight is often a twenty-hour routing. So the default order is
// not expected to be ascending; the badge is what has to be right.
const shown = await prices();
const cheapestCard = page.locator('main ul > li:has-text("Cheapest") [data-offer-price]').first();
step("the cheapest offer is the one badged as such",
  Number(await cheapestCard.getAttribute("data-offer-price")) === Math.min(...shown),
  `badged ${await cheapestCard.getAttribute("data-offer-price")}, lowest ${Math.min(...shown)}`);

await page.getByRole("tab", { name: /cheapest/i }).click();
await page.waitForTimeout(300);
const byPrice = await prices();
step("choosing cheapest sorts by price", byPrice.every((p, i) => i === 0 || byPrice[i - 1] <= p),
  byPrice.slice(0, 3).join(" → "));

await page.goto(
  `${BASE}/hotels?cityCode=DXB&checkIn=2026-11-10&checkOut=2026-11-13&adults=2&rooms=1`,
  { waitUntil: "load" },
);
await page.waitForSelector("main ul > li", { timeout: 20000 });
step("hotels come back", (await page.locator("main ul > li").count()) > 0);

const places = await page.request.get(`${BASE}/api/search/places?q=cai`);
step("airport autocomplete answers", places.status() === 200, `HTTP ${places.status()}`);

// A search with nowhere to go must fail cleanly rather than 500.
const nonsense = await page.request.get(
  `${BASE}/api/search/flights?origin=&destination=&departDate=&adults=1&cabin=ECONOMY&currency=USD`,
);
// 422, not 400: the request is well formed, its contents are not.
step("an invalid search is rejected, not crashed", nonsense.status() === 422, `HTTP ${nonsense.status()}`);

await browser.close();
process.exit(finish());
