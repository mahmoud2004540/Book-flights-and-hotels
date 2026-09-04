import { BASE, connect, launch, newPage, register, reporter, signIn } from "./harness.mjs";

const { step, finish } = reporter("admin");
const browser = await launch();
const db = await connect();

/**
 * A session for each tier.
 *
 * The role is set before signing in, because the session token carries it —
 * which is also what an actual promoted admin does: sign out, sign back in.
 */
async function staff(label, role) {
  const page = await newPage(browser);
  const email = await register(page, label);
  if (role) await db.run(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
  await signIn(page, email);
  const id = await db.value(`SELECT id FROM users WHERE email = $1`, [email]);
  return { page, email, id };
}

const traveller = await staff("plain", null);
const support = await staff("support", "SUPPORT");
const finance = await staff("finance", "FINANCE");
const boss = await staff("boss", "SUPER_ADMIN");
step("the roles were assigned",
  (await db.value(`SELECT role FROM users WHERE id = $1`, [boss.id])) === "SUPER_ADMIN");

const open = async ({ page }, path) => (await page.goto(`${BASE}${path}`)).status();

// A page someone may not use should not confirm it exists.
step("a traveller cannot see the admin area", (await open(traveller, "/admin")) === 404);
step("nor its users page", (await open(traveller, "/admin/users")) === 404);
step("support can open the overview", (await open(support, "/admin")) === 200);
step("support can open bookings", (await open(support, "/admin/bookings")) === 200);
step("support cannot open markup — the markup is the margin", (await open(support, "/admin/markup")) === 404);
step("finance can open markup", (await open(finance, "/admin/markup")) === 200);
step("a super admin can open suppliers", (await open(boss, "/admin/suppliers")) === 200);

await support.page.goto(`${BASE}/admin`, { waitUntil: "load" });
step("support sees no revenue", !/Taken|Refunded/.test((await support.page.textContent("main")) ?? ""));
await finance.page.goto(`${BASE}/admin`, { waitUntil: "load" });
step("finance sees revenue", /Taken/.test((await finance.page.textContent("main")) ?? ""));

const navOf = async ({ page }) => {
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  return (await page.locator('nav[aria-label="Admin"] a').allTextContents()).map((t) => t.trim());
};
const supportNav = await navOf(support);
step("support is not offered a page it would be refused", !supportNav.includes("Markup rules"), supportNav.join(","));
step("support is offered what it may use", supportNav.includes("Bookings") && supportNav.includes("Users"));
step("a super admin is offered everything", (await navOf(boss)).includes("Suppliers"));

const send = async ({ page }, method, url, data) => {
  const response = await page.request.fetch(`${BASE}${url}`, {
    method, data, headers: { "content-type": "application/json" },
  });
  return { status: response.status(), body: await response.json().catch(() => ({})) };
};

step("a traveller's write is refused as 404",
  (await send(traveller, "PATCH", "/api/admin/suppliers/amadeus", { isActive: false })).status === 404);
step("support cannot switch a supplier off",
  (await send(support, "PATCH", "/api/admin/suppliers/amadeus", { isActive: false })).status === 404);
step("finance cannot either",
  (await send(finance, "PATCH", "/api/admin/suppliers/duffel", { isActive: true })).status === 404);
step("a super admin can",
  (await send(boss, "PATCH", "/api/admin/suppliers/duffel", { isActive: true })).status === 200);

await send(boss, "PATCH", "/api/admin/suppliers/duffel", { isActive: false });
const lastSupplier = await send(boss, "PATCH", "/api/admin/suppliers/amadeus", { isActive: false });
step("the only active supplier cannot be switched off", lastSupplier.status === 409, lastSupplier.body.reason ?? "");

const selfRole = await send(boss, "PATCH", `/api/admin/users/${boss.id}`, { action: "role", role: "USER" });
step("a super admin cannot demote themselves", selfRole.status === 409, selfRole.body.reason ?? "");
const selfBlock = await send(boss, "PATCH", `/api/admin/users/${boss.id}`, { action: "block", blocked: true });
step("nor block themselves", selfBlock.status === 409, selfBlock.body.reason ?? "");

step("a super admin can change someone else's role",
  (await send(boss, "PATCH", `/api/admin/users/${support.id}`, { action: "role", role: "FINANCE" })).status === 200);
step("the change reached the row",
  (await db.value(`SELECT role FROM users WHERE id = $1`, [support.id])) === "FINANCE");
step("finance cannot grant a role",
  (await send(finance, "PATCH", `/api/admin/users/${support.id}`, { action: "role", role: "SUPER_ADMIN" })).status === 404);
step("finance can block an account",
  (await send(finance, "PATCH", `/api/admin/users/${support.id}`, { action: "block", blocked: true })).status === 200);
// The session token still says FINANCE; the guard re-reads the row instead.
step("a blocked account cannot use the admin API",
  (await send(support, "PATCH", `/api/admin/users/${support.id}`, { action: "block", blocked: false })).status === 404);

// --- reordering the suppliers ------------------------------------------------
const orderNow = async () =>
  (await db.rows(`SELECT id, priority FROM suppliers ORDER BY priority ASC`)).map((r) => r.id);

const before = await orderNow();
step("the suppliers have an order to start with", before.length === 4, before.join(" → "));

const moved = await send(boss, "PATCH", `/api/admin/suppliers/${before[1]}`, { move: "up" });
step("a super admin can move one up", moved.status === 200, `HTTP ${moved.status}`);

const after = await orderNow();
step("the two swapped places and nothing else moved",
  after[0] === before[1] && after[1] === before[0] && after[2] === before[2] && after[3] === before[3],
  `${before.join(",")} → ${after.join(",")}`);

// Priorities carry no unique constraint, so a half-applied swap would leave two
// suppliers claiming one place. The transaction is what prevents it.
const priorities = (await db.rows(`SELECT priority FROM suppliers`)).map((r) => r.priority);
step("no two suppliers share a place", new Set(priorities).size === priorities.length,
  priorities.join(","));

const first = await send(boss, "PATCH", `/api/admin/suppliers/${after[0]}`, { move: "up" });
step("the first one cannot move up", first.status === 409, first.body.reason ?? "");
const last = await send(boss, "PATCH", `/api/admin/suppliers/${after[3]}`, { move: "down" });
step("the last one cannot move down", last.status === 409, last.body.reason ?? "");

step("support cannot reorder",
  (await send(support, "PATCH", `/api/admin/suppliers/${after[2]}`, { move: "up" })).status === 404);

// Put it back, so the suite leaves the order it found.
await send(boss, "PATCH", `/api/admin/suppliers/${after[0]}`, { move: "down" });
step("the order was restored", (await orderNow()).join(",") === before.join(","));

const badRule = await send(boss, "POST", "/api/admin/markup", {
  supplierId: "", serviceType: "", destination: "", type: "PERCENT", value: 250, priority: 50,
});
step("an impossible percentage is refused", badRule.status === 400, badRule.body.reason ?? "");
const rule = await send(boss, "POST", "/api/admin/markup", {
  supplierId: "", serviceType: "FLIGHT", destination: "DXB", type: "PERCENT", value: 7, priority: 40,
});
step("a valid rule is created", rule.status === 200, `HTTP ${rule.status}`);
step("an empty scope field is stored as null, not as an empty string",
  (await db.value(`SELECT "supplierId" FROM markup_rules WHERE id = $1`, [rule.body.id])) === null);

const audited = await db.value(
  `SELECT count(*) FROM audit_logs WHERE action IN
   ('user.role_changed','user.blocked','supplier.updated','markup.created')`,
);
step("the actions were written to the audit log", Number(audited) >= 4, `${audited} entries`);
step("an entry names who did it",
  (await db.value(
    `SELECT "actorId" FROM audit_logs WHERE action = 'markup.created' ORDER BY "createdAt" DESC LIMIT 1`,
  )) === boss.id);

// Leave the suppliers as the rest of the suite expects them.
await send(boss, "PATCH", "/api/admin/suppliers/amadeus", { isActive: true });
await db.close();
await browser.close();
process.exit(finish());
