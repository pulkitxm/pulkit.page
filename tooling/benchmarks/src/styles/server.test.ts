import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureServers } from "./server.ts";

test("fixture responses apply measurable latency, gzip and body-free ETag revalidation", async () => {
  const output = mkdtempSync(join(tmpdir(), "style-server-test-"));
  const directory = join(output, "variants/utilities");
  mkdirSync(directory, { recursive: true });
  const body = "<!doctype html><title>Sample</title><p>Sample body</p>";
  writeFileSync(join(directory, "index.html"), body);
  const servers = fixtureServers(output, ["utilities"]);
  const server = servers.get("utilities");
  if (!server) {
    throw new Error("Fixture server is unavailable");
  }
  try {
    server.setLatency(25);
    const start = performance.now();
    const first = await fetch(server.url, { headers: { "accept-encoding": "gzip" } });
    expect(performance.now() - start).toBeGreaterThanOrEqual(20);
    expect(first.headers.get("content-encoding")).toBe("gzip");
    expect(await first.text()).toBe(body);
    const sent = server.counters().bodyBytes;
    expect(sent).toBeGreaterThan(0);
    const repeated = await fetch(server.url, {
      headers: { "if-none-match": first.headers.get("etag") ?? "" },
    });
    expect(repeated.status).toBe(304);
    expect(server.counters().bodyBytes).toBe(sent);
    expect(server.counters().revalidations).toBe(1);
  } finally {
    for (const item of servers.values()) {
      item.close();
    }
    rmSync(output, { recursive: true, force: true });
  }
});
