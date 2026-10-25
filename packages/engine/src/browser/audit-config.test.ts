import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import process from "node:process";

const script = `import { auditsPages, auditsSiteFlows } from ${JSON.stringify(new URL("./audit-config.ts", import.meta.url).href)}; console.log(JSON.stringify({ pages: auditsPages, flows: auditsSiteFlows }));`;

function run(environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--eval", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      BROWSER_SUITE: "all",
      BROWSER_SHARD: "1/1",
      BROWSER_VIEWPORT: "",
      ...environment,
    },
  });
}

test("separate browser suites retain page audits and run interactions exactly once", () => {
  for (const suite of ["all", "pages", "flows"]) {
    for (const viewport of ["desktop", "mobile"]) {
      for (const shard of ["1/4", "2/4", "3/4", "4/4"]) {
        const result = run({
          BROWSER_SUITE: suite,
          BROWSER_VIEWPORT: viewport,
          BROWSER_SHARD: shard,
        });
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual({
          pages: suite !== "flows",
          flows: suite === "flows" || (suite === "all" && viewport === "mobile" && shard === "4/4"),
        });
      }
    }
  }
  expect(JSON.parse(run({}).stdout)).toEqual({ pages: true, flows: true });
});

test("an unknown browser suite fails instead of silently skipping checks", () => {
  const result = run({ BROWSER_SUITE: "unknown" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Unknown BROWSER_SUITE unknown");
});
