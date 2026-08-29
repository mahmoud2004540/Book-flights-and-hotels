import { BASE, launch, newPage, reporter } from "./harness.mjs";

/**
 * Nothing the browser receives may reveal what we paid the supplier.
 *
 * This runs over every response, not over the rendered page: the leak this
 * suite was written for lived in an API payload and in an RSC stream, neither
 * of which appears in the DOM.
 */
const { step, finish } = reporter("cost leakage");
const browser = await launch();
const page = await newPage(browser);

const bodies = [];
page.on("response", async (response) => {
  if (!/json|text|javascript/.test(response.headers()["content-type"] ?? "")) return;
  try {
    bodies.push({ url: response.url(), body: await response.text() });
  } catch {
    // Redirects carry no body; nothing to inspect.
  }
});

await page.goto(
  `${BASE}/flights?origin=CAI&destination=DXB&departDate=2026-12-05&adults=1&cabin=ECONOMY&currency=USD`,
  { waitUntil: "load" },
);
await page.waitForSelector("main ul > li", { timeout: 20000 });
await page.locator("main ul > li").first().locator('button:has-text("Select")').click();
await page.waitForURL("**/booking/**", { timeout: 20000 });
await page.waitForSelector('[role="timer"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const app = bodies.filter((r) => !r.url.includes("/_next/static/"));
step("responses were captured", app.length > 5, `${app.length} responses`);

for (const field of ["supplierPayload", "netPrice"]) {
  const hits = app.filter((r) => r.body.includes(field)).map((r) => r.url);
  step(`no response carries ${field}`, hits.length === 0, hits.slice(0, 2).join(" "));
}

let breakdowns = 0;
let broken = 0;
for (const response of app) {
  const pattern = /"fareBreakdown":\{"base":"([\d.]+)","taxesAndFees":"([\d.]+)","total":"([\d.]+)"\}/g;
  for (const [, base, taxes, total] of response.body.matchAll(pattern)) {
    breakdowns++;
    if (Math.abs(Number(base) + Number(taxes) - Number(total)) > 0.005) broken++;
  }
}
step("every fare breakdown adds up to its own total", broken === 0, `${breakdowns} checked`);

// The decisive one: a breakdown totalling less than the charged price is our
// cost, and the difference is the margin.
const search = app.find((r) => r.url.includes("/api/search/flights"))?.body;
if (search) {
  const offers = JSON.parse(search).offers ?? [];
  const undercutting = offers.filter(
    (offer) => Math.abs(Number(offer.fareBreakdown.total) - Number(offer.price.amount)) > 0.005,
  );
  step("no breakdown undercuts the price charged", undercutting.length === 0,
    `${offers.length} offers, ${undercutting.length} mismatched`);
} else {
  step("the search response was captured", false);
}

await browser.close();
process.exit(finish());
