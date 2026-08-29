import { BASE, bookToPayment, launch, newPage, pay, reporter } from "./harness.mjs";

const { step, finish } = reporter("payment");
const browser = await launch();
const page = await newPage(browser);

const reference = await bookToPayment(page, { guestEmail: "pay@example.com" });
step("confirming leads to payment, not straight to a ticket", page.url().includes("/booking/pay/"));
await page.waitForSelector('button:has-text("Pay ")', { timeout: 20000 });
step("a payment intent is prepared", true, reference);

await pay(page);
const body = (await page.textContent("main")) ?? "";
step("the booking reads as confirmed", /Your booking is confirmed/.test(body));
step("a ticket download is offered", (await page.locator('a:has-text("Download ticket")').count()) === 1);

const ticket = await page.request.get(`${BASE}/api/bookings/${reference}/ticket`);
step("the ticket downloads", ticket.status() === 200, `HTTP ${ticket.status()}`);
step("it is served as a PDF", (ticket.headers()["content-type"] ?? "").includes("application/pdf"));
const bytes = await ticket.body();
step("the file really is a PDF", bytes.subarray(0, 5).toString() === "%PDF-", `${bytes.length} bytes`);

const unknown = await page.request.get(`${BASE}/api/bookings/WVG-NOPE99/ticket`);
step("an unknown reference gets no ticket", unknown.status() === 404);

// An unsigned webhook must never move a booking: it is the one endpoint an
// attacker can reach without an account.
const forged = await page.request.post(`${BASE}/api/payments/webhook`, {
  data: { type: "payment_succeeded", providerRef: "pi_mock_forged" },
});
step("an unsigned webhook is rejected", forged.status() === 400, `HTTP ${forged.status()}`);

await browser.close();
process.exit(finish());
