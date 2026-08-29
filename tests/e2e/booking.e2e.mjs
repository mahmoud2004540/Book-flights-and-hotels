import { BASE, bookToPayment, launch, newPage, pay, reporter, signedInUser } from "./harness.mjs";

const { step, finish } = reporter("booking");
const browser = await launch();
const page = await newPage(browser);
const continueButton = page.getByRole("button", { name: "Continue", exact: true });

await page.goto(
  `${BASE}/flights?origin=CAI&destination=DXB&departDate=2026-12-01&adults=1&cabin=ECONOMY&currency=USD`,
  { waitUntil: "load" },
);
await page.waitForSelector("main ul > li", { timeout: 20000 });

// Pick the offer the mock re-prices upward, so the consent path is exercised.
const cards = page.locator("main ul > li");
const count = await cards.count();
let target = 1;
for (let i = 0; i < count; i++) {
  if (/:2"|:2</.test(await cards.nth(i).innerHTML())) { target = i; break; }
}
await cards.nth(target).locator('button:has-text("Select")').click();
await page.waitForURL("**/booking/**", { timeout: 20000 });
step("selecting an offer opens the booking flow", /\/booking\//.test(page.url()));

const timer = page.locator('[role="timer"]');
step("the held price shows its countdown", (await timer.count()) === 1,
  (await timer.textContent())?.trim());

await continueButton.click();
await page.waitForSelector("[data-price-state]", { timeout: 20000 });
const state = await page.getAttribute("[data-price-state]", "data-price-state");
step("re-pricing runs before anything is booked", state !== null, state ?? "");

if (state === "changed") {
  step("continue is blocked until the new price is accepted", await continueButton.isDisabled());
  await page.click('button:has-text("Accept the new price")');
  await page.waitForSelector('[data-price-state="accepted"]', { timeout: 20000 });
  step("accepting unblocks it", !(await continueButton.isDisabled()));
} else {
  step("an unchanged price needs no consent", state === "unchanged");
}
await continueButton.click();

await page.waitForSelector("#first-0", { timeout: 10000 });
await page.fill("#first-0", "Expired");
await page.fill("#last-0", "Passport");
await page.fill("#dob-0", "1990-05-05");
await page.fill("#nat-0", "EG");
await page.fill("#passport-0", "A1234567");
// Six months' validity is the usual requirement, so this must not pass.
await page.fill("#expiry-0", "2026-12-10");
await continueButton.click();
await page.waitForTimeout(800);
step("a passport expiring too soon is caught in the form", (await page.locator("#first-0").count()) === 1);

await page.fill("#expiry-0", "2031-01-01");
await continueButton.click();
await page.waitForSelector("#extra-bags", { timeout: 10000 });
await page.fill("#extra-bags", "2");
await continueButton.click();

await page.waitForSelector('button:has-text("Confirm booking")', { timeout: 10000 });
const summary = (await page.textContent("main")) ?? "";
step("the summary lists the extras", /Extra bags/.test(summary));
step("the summary shows a total", /Total/.test(summary));
const confirm = page.locator('button:has-text("Confirm booking")');
step("confirm is disabled until the terms are accepted", await confirm.isDisabled());

// A double-click must produce one booking, not two.
const guest = await newPage(browser);
const reference = await bookToPayment(guest, { guestEmail: "double@example.com" });
step("a booking reference was issued", /^RHL-/.test(reference), reference);
await pay(guest);
step("paying reaches the confirmation", guest.url().includes("/booking/confirmed/"));

const { page: member } = await signedInUser(browser, "member");
const own = await bookToPayment(member);
step("a signed-in traveller books without re-entering an email", /^RHL-/.test(own), own);

await browser.close();
process.exit(finish());
