import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

/**
 * The pieces every end-to-end suite needs, in one place.
 *
 * These drive a real browser against a real server and a real database. They
 * are deliberately not unit tests: the bugs they exist to catch — a leaked net
 * price, a role that still writes after being revoked, a reminder that sends
 * twice — all live in the seams between those three, where a mock would agree
 * with whatever we assumed.
 */

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = "correct-horse-battery";

/** The dev mail transport prints its links to the server log. */
export const LOG = process.env.E2E_SERVER_LOG ?? "";

export function reporter(suite) {
  const failures = [];
  return {
    step(name, ok, extra = "") {
      console.log(`  ${ok ? "✓" : "✗"} ${name}${extra ? `  — ${extra}` : ""}`);
      if (!ok) failures.push(name);
    },
    finish() {
      if (failures.length > 0) {
        console.log(`\n${suite}: ${failures.length} failed\n`);
        return 1;
      }
      console.log(`\n${suite}: all passed\n`);
      return 0;
    },
    failures,
  };
}

export async function launch() {
  return chromium.launch();
}

let ipCounter = 0;
// Each suite runs in its own process, so seeding from the pid keeps two suites
// from ever landing on the same address and sharing a rate-limit window.
const IP_BASE = process.pid % 250;

/**
 * A page, with its own client address.
 *
 * The request limits are keyed on the forwarded IP, so without this every
 * suite shares one window and whichever runs last is throttled by the ones
 * before it — a suite that only passes alone is not a suite. Distinct
 * addresses are also what actually happens: these are different people.
 */
export async function newPage(browser, options = {}) {
  ipCounter += 1;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    extraHTTPHeaders: { "x-forwarded-for": `10.${IP_BASE}.${ipCounter >> 8}.${ipCounter % 254}` },
    ...options,
  });
  return context.newPage();
}

/** How much of the server log exists right now, as a byte offset. */
export function logOffset() {
  if (!LOG) throw new Error("E2E_SERVER_LOG is not set — see tests/e2e/README.md");
  return statSync(LOG).size;
}

/**
 * The next link of a kind the server printed *after* a given point in the log.
 *
 * Reading the log rather than the database keeps the assertion honest: it
 * proves the mail was composed and sent, not merely that a token row exists.
 *
 * The offset is what makes it correct. The log is shared and append-only
 * across every suite in a run, and the server writes it a moment after
 * answering, so searching the whole file can return an *earlier* account's
 * link — which verifies the wrong account and leaves this one unable to sign
 * in, surfacing thirty lines later as a timeout that says nothing about why.
 * Take the offset before the request that sends the mail.
 */
export async function linkFromLog(kind, since = 0, timeoutMs = 15000) {
  const pattern = new RegExp(
    `${BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${kind}\\?token=[^\\s]+`,
    "g",
  );

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Sliced as bytes, not characters: the offset comes from the file size and
    // the log is full of multi-byte glyphs, so a string slice cuts in the
    // wrong place and silently hides the line being waited for.
    const tail = readFileSync(LOG).subarray(since).toString("utf8");
    const found = [...tail.matchAll(pattern)].at(-1)?.[0];
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`No ${kind} link appeared in the server log within ${timeoutMs}ms`);
}

let counter = 0;
export const uniqueEmail = (label) => `${label}.${Date.now()}.${counter++}@example.com`;

/** Registers an account and follows its verification link. */
export async function register(page, label) {
  const email = uniqueEmail(label);
  await page.goto(`${BASE}/sign-up`, { waitUntil: "load" });
  await page.fill("#name", `${label} user`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);

  // Marked before submitting, so the link we then wait for is this account's
  // and not one left in the log by an earlier test.
  const before = logOffset();
  await page.click('button[type="submit"]');
  await page.waitForSelector("[data-form-status]", { timeout: 15000 });

  // Surfaced here rather than as a mysterious missing link: a refused sign-up
  // sends no mail, and the wait below would then just time out.
  const status = (await page.textContent("[data-form-status]"))?.trim() ?? "";
  if (!/Check your inbox/i.test(status)) {
    throw new Error(`Sign-up for ${email} was not accepted: ${status}`);
  }

  await page.goto(await linkFromLog("verify-email", before), { waitUntil: "load" });
  return email;
}

export async function signIn(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

/** Registers, verifies and signs in — the usual starting point. */
export async function signedInUser(browser, label, options = {}) {
  const page = await newPage(browser, options);
  const email = await register(page, label);
  await signIn(page, email);
  return { page, email };
}

const continueButton = (page) =>
  // "Accept the new price and continue" also contains "Continue", so the nav
  // button is addressed by its exact accessible name.
  page.getByRole("button", { name: "Continue", exact: true });

/**
 * Drives the five-step booking flow to the payment page and returns the
 * reference. Accepts a re-priced fare, since the mock deliberately moves some.
 */
export async function bookToPayment(page, { search, passenger = "Test", guestEmail } = {}) {
  const query =
    search ??
    "origin=CAI&destination=DXB&departDate=2026-12-05&adults=1&cabin=ECONOMY&currency=USD";

  await page.goto(`${BASE}/flights?${query}`, { waitUntil: "load" });
  await page.waitForSelector("main ul > li", { timeout: 20000 });
  await page.locator("main ul > li").first().locator('button:has-text("Select")').click();
  await page.waitForURL("**/booking/**", { timeout: 20000 });

  await continueButton(page).click();
  await page.waitForSelector("[data-price-state]", { timeout: 20000 });
  if ((await page.getAttribute("[data-price-state]", "data-price-state")) === "changed") {
    await page.click('button:has-text("Accept the new price")');
    await page.waitForSelector('[data-price-state="accepted"]', { timeout: 20000 });
  }
  await continueButton(page).click();

  await page.waitForSelector("#first-0", { timeout: 10000 });
  await page.fill("#first-0", passenger);
  await page.fill("#last-0", "User");
  await page.fill("#dob-0", "1990-05-05");
  await page.fill("#nat-0", "EG");
  await page.fill("#passport-0", "A1234567");
  await page.fill("#expiry-0", "2031-01-01");
  await continueButton(page).click();

  await page.waitForSelector("#extra-bags", { timeout: 10000 });
  await continueButton(page).click();

  await page.waitForSelector('button:has-text("Confirm booking")', { timeout: 10000 });
  if (guestEmail && (await page.locator("#guest-email").count()) > 0) {
    await page.fill("#guest-email", guestEmail);
  }
  await page.click('input[type="checkbox"] >> nth=-1');
  await page.click('button:has-text("Confirm booking")');

  await page.waitForURL("**/booking/pay/**", { timeout: 20000 });
  return page.url().split("/").pop();
}

/** Pays with the mock provider and waits for the confirmation page. */
export async function pay(page) {
  await page.waitForSelector('button:has-text("Pay ")', { timeout: 20000 });
  await page.click('button:has-text("Pay ")');
  await page.waitForURL("**/booking/confirmed/**", { timeout: 25000 });
}

/**
 * A direct query, for the handful of assertions that have to look past the API
 * — that a role change reached the row, that an audit entry names its actor,
 * that an empty form field was stored as null and not as "".
 *
 * Also the only honest way to set up a state the app deliberately has no
 * endpoint for, such as granting the very first admin role.
 */
export async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  return {
    /** Returns the first column of the first row, or null. */
    async value(text, params = []) {
      const result = await client.query(text, params);
      const row = result.rows[0];
      return row ? Object.values(row)[0] : null;
    },
    async rows(text, params = []) {
      return (await client.query(text, params)).rows;
    },
    async run(text, params = []) {
      await client.query(text, params);
    },
    close: () => client.end(),
  };
}
