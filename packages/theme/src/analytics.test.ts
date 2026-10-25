import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleAnalyticsScript } from "./analytics.ts";

test("the initial analytics download stays small while the SDK remains available on demand", async () => {
  const directory = mkdtempSync(join(tmpdir(), "analytics-bundle-"));
  try {
    await bundleAnalyticsScript(directory);
    expect(readFileSync(join(directory, "analytics.js")).length).toBeLessThan(1500);
    const sdk = readdirSync(directory).find((name) => /^analytics-sdk-.+\.js$/.test(name));
    expect(sdk).toBeDefined();
    expect(readFileSync(join(directory, sdk ?? "")).length).toBeGreaterThan(100_000);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
