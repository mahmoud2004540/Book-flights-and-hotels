import { BASE, PASSWORD, launch, linkFromLog, logOffset, newPage, reporter, uniqueEmail } from "./harness.mjs";

const { step, finish } = reporter("auth");
const browser = await launch();
const page = await newPage(browser);
const STATUS = "[data-form-status]";

const statusText = async () => {
  await page.waitForSelector(STATUS, { timeout: 15000 });
  return (await page.textContent(STATUS))?.trim() ?? "";
};

const email = uniqueEmail("auth");
const beforeSignUp = logOffset();

await page.goto(`${BASE}/sign-up`, { waitUntil: "load" });
await page.fill("#name", "Auth User");
await page.fill("#email", email);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
step("sign-up confirms without saying whether the address was new", /Check your inbox/i.test(await statusText()));

await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
await page.fill("#email", email);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
step("an unverified account cannot sign in", /Confirm your email/i.test(await statusText()));

await page.goto(await linkFromLog("verify-email", beforeSignUp), { waitUntil: "load" });
step("the emailed link verifies the account", /confirmed/i.test(await statusText()));

await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
await page.fill("#email", email);
await page.fill("#password", "not-the-password");
await page.click('button[type="submit"]');
const wrongPassword = await statusText();
step("a wrong password is refused", /do not match/i.test(wrongPassword));

await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
await page.fill("#email", uniqueEmail("nobody"));
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
// The two must be indistinguishable, or the form becomes a way to ask which
// addresses hold accounts.
step("an unknown address gets the same answer as a wrong password",
  (await statusText()) === wrongPassword);

await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
await page.fill("#email", email);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });
step("the right password signs in", page.url().includes("/dashboard"));

for (const path of ["/profile", "/travellers", "/dashboard"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  step(`${path} opens while signed in`, !page.url().includes("/sign-in"));
}

const victim = uniqueEmail("lockout");
for (let attempt = 0; attempt < 5; attempt++) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill("#email", victim);
  await page.fill("#password", `wrong-${attempt}`);
  await page.click('button[type="submit"]');
  await page.waitForSelector(STATUS, { timeout: 15000 });
}
step("five failed attempts lock the address out", /Too many failed attempts/i.test(await statusText()));

const signedOut = await newPage(browser);
for (const path of ["/dashboard", "/profile", "/travellers", "/admin"]) {
  await signedOut.goto(`${BASE}${path}`, { waitUntil: "load" });
  step(`${path} sends a signed-out visitor to sign in`, signedOut.url().includes("/sign-in"));
}

await browser.close();
process.exit(finish());
