import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Runs every suite in its own process, so one crashing does not take the rest
 * with it, and reports at the end.
 *
 * Order matters a little: the cheap suites run first, so a broken build is
 * obvious in seconds rather than after a full booking flow.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER = ["search", "auth", "abuse", "leak", "booking", "payment", "dashboard", "admin"];

const only = process.argv.slice(2);
const available = readdirSync(HERE)
  .filter((name) => name.endsWith(".e2e.mjs"))
  .map((name) => name.replace(".e2e.mjs", ""));

const suites = ORDER.filter((name) => available.includes(name))
  .concat(available.filter((name) => !ORDER.includes(name)))
  .filter((name) => only.length === 0 || only.includes(name));

if (suites.length === 0) {
  console.error(`No suite matched. Available: ${available.join(", ")}`);
  process.exit(1);
}

const run = (suite) =>
  new Promise((resolve) => {
    console.log(`\n── ${suite} ${"─".repeat(Math.max(0, 60 - suite.length))}`);
    const child = spawn(process.execPath, [join(HERE, `${suite}.e2e.mjs`)], { stdio: "inherit" });
    child.on("exit", (code) => resolve({ suite, ok: code === 0 }));
  });

const results = [];
for (const suite of suites) results.push(await run(suite));

const failed = results.filter((r) => !r.ok);
console.log("─".repeat(64));
for (const { suite, ok } of results) console.log(`${ok ? "✓" : "✗"} ${suite}`);
console.log(
  failed.length === 0
    ? `\n${results.length} suites passed.`
    : `\n${failed.length} of ${results.length} suites failed: ${failed.map((r) => r.suite).join(", ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
