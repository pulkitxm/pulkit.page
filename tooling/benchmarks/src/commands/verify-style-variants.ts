import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { chromium, firefox } from "playwright";
import { variants } from "../styles/config.ts";
import { checkParity, type ParityResult } from "../styles/parity.ts";
import { fixtureServers } from "../styles/server.ts";

const output = resolve(process.argv[2] ?? "reports/style-benchmark");
const servers = fixtureServers(
  output,
  variants.map((variant) => variant.id),
);
const results: ParityResult[] = [];
try {
  for (const [engine, type] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ] as const) {
    const browser = await type.launch();
    try {
      results.push(...(await checkParity(browser, engine, servers, output)));
    } finally {
      await browser.close();
    }
    writeFileSync(join(output, "parity.json"), `${JSON.stringify(results, null, 2)}\n`);
  }
} finally {
  for (const server of servers.values()) {
    server.close();
  }
}
const failures = results.filter((result) => !result.passed);
console.log(`${results.length} checks; ${failures.length} failures`);
process.exitCode = failures.length > 0 ? 1 : 0;
