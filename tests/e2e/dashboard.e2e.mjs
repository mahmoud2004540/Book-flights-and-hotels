import { BASE, bookToPayment, connect, launch, newPage, pay, reporter, signedInUser } from "./harness.mjs";

const { step, finish } = reporter("dashboard");
const browser = await launch();
const { page } = await signedInUser(browser, "dash");
const tab = (name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const countOn = async (name) => (await tab(name).textContent())?.trim().replace(/\D/g, "") ?? "";

await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
step("three tabs are offered", (await page.getByRole("tab").count()) === 3);
step("upcoming is selected first", (await tab("Upcoming").getAttribute("aria-selected")) === "true");
step("the empty state explains itself", /No upcoming trips/.test((await page.textContent("main")) ?? ""));
await tab("Cancelled").click();
step("each tab has its own empty copy", /Nothing cancelled/.test((await page.textContent("main")) ?? ""));

const reference = await bookToPayment(page);
await pay(page);

await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
step("upcoming counts the new booking", (await countOn("Upcoming")) === "1");
step("cancelled counts none", (await countOn("Cancelled")) === "0");
const row = page.locator(`main li a[href*="${reference}"]`);
step("the booking is listed under upcoming", (await row.count()) === 1);

await row.click();
await page.waitForURL(`**/bookings/${reference}`, { timeout: 20000 });
const detail = (await page.textContent("main")) ?? "";
step("the itinerary is shown", /Itinerary/.test(detail));
step("the traveller is shown", /Test User/.test(detail));
step("the payment is shown", /Payment/.test(detail) && /succeeded/.test(detail));
step("the confirmation can be downloaded", (await page.locator('a:has-text("Download confirmation")').count()) === 1);

// The refund must be quoted before anything is cancelled — a figure discovered
// afterwards is how trust is lost.
const total = Number((detail.match(/USD\s([\d,]+(?:\.\d+)?)/) ?? [])[1]?.replace(/,/g, "") ?? 0);
await page.click('button:has-text("See what I would get back")');
await page.waitForSelector("text=You would get back", { timeout: 15000 });
const quoted = (await page.textContent("main")) ?? "";
step("the refund is shown before cancelling", /You would get back/.test(quoted));
step("the fee is itemised", /Cancellation fee/.test(quoted));
const refund = Number(
  ((quoted.match(/You would get back\s*USD\s([\d,]+(?:\.\d+)?)/) ?? [])[1] ?? "0").replace(/,/g, ""),
);
step("the refund is the total less the fee", Math.abs(total - refund - 25) < 0.01,
  `total ${total}, refund ${refund}`);
step("asking did not cancel anything", /confirmed/.test((await page.textContent("h1")) ?? ""));

await page.click('button:has-text("Cancel this booking")');
await page.waitForFunction(() => /cancelled/.test(document.querySelector("h1")?.textContent ?? ""), null, { timeout: 20000 });
step("the booking reads as cancelled", /cancelled/.test((await page.textContent("h1")) ?? ""));
step("the refund is recorded against the payment", /Refund ·/.test((await page.textContent("main")) ?? ""));
step("cancellation is no longer offered", (await page.locator('button:has-text("See what I would get back")').count()) === 0);

await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
step("upcoming is back to none", (await countOn("Upcoming")) === "0");
step("cancelled now counts one", (await countOn("Cancelled")) === "1");

// Someone else's booking.
const stranger = await newPage(browser);
step("a signed-out stranger cannot quote its cancellation",
  (await stranger.request.get(`${BASE}/api/bookings/${reference}/cancel`)).status() === 403);
await stranger.goto(`${BASE}/bookings/${reference}`, { waitUntil: "load" });
step("and is sent to sign in rather than to the booking", stranger.url().includes("/sign-in"));

const { page: other } = await signedInUser(browser, "other");
step("another account cannot open it", (await other.goto(`${BASE}/bookings/${reference}`)).status() === 404);
step("nor quote its cancellation",
  (await other.request.get(`${BASE}/api/bookings/${reference}/cancel`)).status() === 403);

// The reminder cron: a secret-protected endpoint that sends email.
const secret = process.env.CRON_SECRET;
step("the cron route refuses with no secret",
  (await stranger.request.get(`${BASE}/api/cron/reminders`)).status() === 401);
step("and refuses a wrong one",
  (await stranger.request.get(`${BASE}/api/cron/reminders`, {
    headers: { authorization: "Bearer definitely-not-it" },
  })).status() === 401);

const db = await connect();
await db.run(`DELETE FROM notifications WHERE type = 'trip_reminder_24h'`);
const first = await stranger.request.get(`${BASE}/api/cron/reminders`, {
  headers: { authorization: `Bearer ${secret}` },
});
const firstRun = await first.json();
step("it runs with the right secret", first.status() === 200, JSON.stringify(firstRun));

const second = await stranger.request.get(`${BASE}/api/cron/reminders`, {
  headers: { authorization: `Bearer ${secret}` },
});
const secondRun = await second.json();
// A scheduler retry is normal and must not email anyone twice.
step("a second run sends nothing", secondRun.sent === 0 && secondRun.skipped === firstRun.considered,
  JSON.stringify(secondRun));
await db.close();

await browser.close();
process.exit(finish());
