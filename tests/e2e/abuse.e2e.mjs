import { BASE, connect, launch, newPage, reporter, uniqueEmail } from "./harness.mjs";

/**
 * The endpoints an attacker can reach without an account.
 *
 * These all send email or write rows on behalf of someone who has not proved
 * they are anyone, which makes them the cheapest thing to abuse and the most
 * expensive to have abused — a mail-bombed stranger and a blocked sending
 * domain, not a broken page.
 */
const { step, finish } = reporter("abuse");
const browser = await launch();
const page = await newPage(browser);
const db = await connect();

const post = async (path, data) => {
  const response = await page.request.post(`${BASE}${path}`, { data });
  return { status: response.status(), body: await response.json().catch(() => ({})) };
};

// A victim who already has an account, so the reset path really would send.
const victim = uniqueEmail("victim");
await db.run(
  `INSERT INTO users (id, email, "passwordHash", role, locale, currency, "isBlocked", "createdAt", "updatedAt")
   VALUES ($1, $2, 'x', 'USER', 'EN', 'USD', false, now(), now())`,
  [`abuse-${Date.now()}`, victim],
);
await db.run(`DELETE FROM password_reset_tokens WHERE email = $1`, [victim]);
await db.run(`DELETE FROM auth_attempts WHERE identifier LIKE $1`, [`mail:reset:${victim}`]);

// Eight attempts: past the per-address cap of 3, under the per-IP cap of 10,
// so what refuses here is the limit that survives a serverless deployment.
const codes = [];
for (let i = 0; i < 8; i++) codes.push((await post("/api/auth/forgot-password", { email: victim })).status);
step("the reset endpoint accepts a first request", codes[0] === 200, `first ${codes[0]}`);

// The count of messages actually sent is what protects the stranger's inbox —
// not the status codes, which stay 200 on purpose so the endpoint never
// reveals whether the address is registered.
const sent = Number(
  await db.value(`SELECT "failedCount" FROM auth_attempts WHERE identifier = $1`, [
    `mail:reset:${victim}`,
  ]),
);
step("no more than three messages were sent for eight requests", sent === 3, `${sent} sent`);
// The neutral answer is the whole point of this endpoint, so it is checked
// from a fresh address — the per-IP limit has been spent above, and a 429
// would prove nothing either way.
const observer = await newPage(browser);
const ask = async (email) => {
  const response = await observer.request.post(`${BASE}/api/auth/forgot-password`, { data: { email } });
  return { status: response.status(), body: await response.json().catch(() => ({})) };
};

const capped = await ask(victim);
const unknown = await ask(uniqueEmail("nobody"));
step("a capped address answers exactly like an address with no account",
  capped.status === 200 &&
    capped.status === unknown.status &&
    capped.body.message === unknown.body.message,
  `${capped.status} "${capped.body.message}" vs ${unknown.status} "${unknown.body.message}"`);

const stillThree = Number(
  await db.value(`SELECT "failedCount" FROM auth_attempts WHERE identifier = $1`, [
    `mail:reset:${victim}`,
  ]),
);
step("and the extra request sent nothing", stillThree === 3, `${stillThree} sent`);

// Registration mails whatever address is typed, so it is an open relay if free.
const registrations = [];
for (let i = 0; i < 14; i++) {
  registrations.push(
    (await post("/api/auth/register", {
      name: "Spam Test",
      email: uniqueEmail("relay"),
      password: "correct-horse-battery",
    })).status,
  );
}
step("registration is rate limited too", registrations.includes(429),
  `first 429 at attempt ${registrations.indexOf(429) + 1}`);

// The webhook is the one endpoint that moves money and takes no session.
const forged = await post("/api/payments/webhook", {
  type: "payment_succeeded",
  providerRef: "pi_forged",
});
step("an unsigned payment webhook is refused", forged.status === 400, `HTTP ${forged.status}`);

const cron = await page.request.get(`${BASE}/api/cron/reminders`);
step("the reminder endpoint is not open", cron.status() === 401, `HTTP ${cron.status()}`);

await db.run(`DELETE FROM password_reset_tokens WHERE email = $1`, [victim]);
await db.run(`DELETE FROM users WHERE email = $1`, [victim]);
await db.close();
await browser.close();
process.exit(finish());
