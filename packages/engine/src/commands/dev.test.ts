import { afterEach, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import {
  fixtureDirectory,
  fixtureSite,
  type RunningServer,
  removeTemporaryDirectories,
  runCommand,
  startServer,
} from "../../test/lib/harness.ts";

const source = (title: string, body = "Example body.") =>
  `---\ntitle: ${title}\ndescription: Example description.\n---\n\n${body}\n`;

afterEach(removeTemporaryDirectories);

async function eventually(url: string, expected: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await fetch(url);
    const body = await response.text();
    if (response.ok && body.includes(expected)) {
      return body;
    }
    await setTimeout(20);
  }
  throw new Error(`Expected updated response containing ${expected}`);
}

async function until(condition: () => Promise<boolean> | boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !(await condition()); attempt++) {
    await setTimeout(20);
  }
}

async function exerciseServer(directory: string, server: RunningServer): Promise<void> {
  const { origin } = server;
  expect(existsSync(join(directory, "dist"))).toBe(false);
  const home = await (await fetch(origin)).text();
  expect(home).toContain("Original");
  expect(home).toContain("/@vite/client");
  expect(home).toContain(`href="${origin}"`);
  expect((await fetch(`${origin}blogs/post/`)).status).toBe(500);
  writeFileSync(join(directory, "content/blogs/post.md"), source("Updated", "Fixed body."));
  await eventually(`${origin}blogs/post/`, "Fixed body.");
  await eventually(origin, "Updated");
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => fetch(`${origin}blogs/post/`)),
  );
  expect(responses.every((response) => response.ok)).toBe(true);
  expect((await fetch(`${origin}blogs/post/`, { method: "HEAD" })).status).toBe(200);
  expect(await (await fetch(origin, { method: "HEAD" })).text()).toBe("");
  const redirect = await fetch(`${origin}blogs/post?test=1`, { redirect: "manual" });
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get("location")).toBe("/blogs/post/?test=1");
  expect((await fetch(`${origin}missing/`)).status).toBe(404);
  expect((await fetch(`${origin}%ZZ`)).status).toBe(400);
  expect((await fetch(origin, { method: "POST" })).status).toBe(405);
  expect((await fetch(`${origin}content/home.md`)).status).toBe(404);
  expect((await fetch(`${origin}styles.css`)).status).toBe(200);
  expect((await fetch(`${origin}assets/favicon.svg`)).headers.get("content-type")).toBe(
    "image/svg+xml",
  );
  expect((await fetch(`${origin}@vite/client`)).status).toBe(200);
  expect((await fetch(`${origin}og/blogs/post/card.png`)).headers.get("content-type")).toBe(
    "image/png",
  );
  expect(await (await fetch(`${origin}sitemap.xml`)).text()).toContain(`${origin}blogs/post/`);
  writeFileSync(
    join(directory, "layouts/partials/footer.html"),
    "<footer>Updated footer</footer>\n",
  );
  await eventually(origin, "Updated footer");
  rmSync(join(directory, "content/blogs/post.md"));
  await until(async () => (await fetch(`${origin}blogs/post/`)).status === 404);
  expect((await fetch(`${origin}blogs/post/`)).status).toBe(404);
  expect(await (await fetch(`${origin}sitemap.xml`)).text()).not.toContain(`${origin}blogs/post/`);
  expect(existsSync(join(directory, "dist"))).toBe(false);
}

test("Vite serves pages on demand, refreshes dependencies, and recovers after errors", async () => {
  const directory = fixtureSite("page-dev-test-", {
    "content/_site.md": "---\nbrand: Example\n---\n",
    "content/home.md": source("Home", ":::list blogs"),
    "content/blogs/post.md": source("Original", ":::list missing"),
    "styles.css": "body { color: red; }\n",
  });
  let server: RunningServer | undefined;
  try {
    server = await startServer("dev", directory, /Development server: (http:\/\/[^\s]+)/);
    await exerciseServer(directory, server);
    const { output } = server;
    await until(() => output().includes("GET /blogs/post/ | 404"));
    expect(output()).toMatch(
      /\[\d{2}:\d{2}:\d{2}\.\d{3}\] GET \/ \| 200 \| compiled in \d+(?:\.\d+)? (?:ms|s) \| total \d+(?:\.\d+)? (?:ms|s)/,
    );
    expect(output()).toContain("GET /blogs/post/ | 200 | cached");
    expect(output()).toContain("GET / | 200 | rebuilt in");
    expect(output()).toContain("Changed content/blogs/post.md. Pages rebuild when requested.");
    expect(output()).toContain(
      "GET /blogs/post/ | 500 | failed: Empty or unknown collection: missing",
    );
    expect(output()).toContain("302 | redirect to /blogs/post/?test=1");
    expect(output()).toContain("GET /og/blogs/post/card.png | 200 | compiled in");
    expect(output()).not.toContain("GET /styles.css");
    expect(output()).not.toContain("INVENTORY");
    expect(output()).not.toContain("VITE transformed");
  } finally {
    await server?.stop();
  }
}, 15_000);

test("Vite rejects invalid and occupied explicit ports", () => {
  for (const port of ["invalid", "-1", "65536", "3000.5"]) {
    const result = runCommand("dev", fixtureDirectory, { ...process.env, PORT: port });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PORT must be an integer");
  }
  const occupied = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("Occupied"),
  });
  try {
    const result = runCommand("dev", fixtureDirectory, {
      ...process.env,
      PORT: String(occupied.port),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("already in use");
  } finally {
    occupied.stop(true);
  }
});
