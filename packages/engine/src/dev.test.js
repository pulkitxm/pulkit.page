import { expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";

const engine = import.meta.dir;
const fixture = resolve(import.meta.dir, "../test/fixture");
const source = (title, body = "Example body.") =>
  `---\ntitle: ${title}\ndescription: Example description.\n---\n\n${body}\n`;

async function eventually(url, expected) {
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

test("Vite serves pages on demand, refreshes dependencies, and recovers after errors", async () => {
  const directory = mkdtempSync(join(tmpdir(), "page-dev-test-"));
  cpSync(join(fixture, "layouts"), join(directory, "layouts"), { recursive: true });
  mkdirSync(join(directory, "content/blogs"), { recursive: true });
  writeFileSync(join(directory, "content/_site.md"), "---\nbrand: Example\n---\n");
  writeFileSync(join(directory, "content/home.md"), source("Home", ":::list blogs"));
  writeFileSync(join(directory, "content/blogs/post.md"), source("Original", ":::list missing"));
  writeFileSync(join(directory, "styles.css"), "body { color: red; }\n");
  const child = spawn("bun", [join(engine, "dev.mjs")], {
    cwd: directory,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  try {
    const origin = await new Promise((accept, reject) => {
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /Development server: (http:\/\/[^\s]+)/.exec(output);
        if (match) {
          accept(match[1]);
        }
      });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Server exited: ${code}`)));
    });
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
    expect((await fetch(`${origin}theme.js`)).status).toBe(200);
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
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await fetch(`${origin}blogs/post/`)).status === 404) {
        break;
      }
      await setTimeout(20);
    }
    expect((await fetch(`${origin}blogs/post/`)).status).toBe(404);
    expect(await (await fetch(`${origin}sitemap.xml`)).text()).not.toContain(
      `${origin}blogs/post/`,
    );
    expect(existsSync(join(directory, "dist"))).toBe(false);
    for (let attempt = 0; attempt < 100 && !output.includes("GET /blogs/post/ | 404"); attempt++) {
      await setTimeout(20);
    }
    expect(output).toMatch(
      /\[\d{2}:\d{2}:\d{2}\.\d{3}\] GET \/ \| 200 \| compiled in \d+(?:\.\d+)? (?:ms|s) \| total \d+(?:\.\d+)? (?:ms|s)/,
    );
    expect(output).toContain("GET /blogs/post/ | 200 | cached");
    expect(output).toContain("GET / | 200 | rebuilt in");
    expect(output).toContain("Changed content/blogs/post.md. Pages rebuild when requested.");
    expect(output).toContain(
      "GET /blogs/post/ | 500 | failed: Empty or unknown collection: missing",
    );
    expect(output).toContain("302 | redirect to /blogs/post/?test=1");
    expect(output).toContain("GET /og/blogs/post/card.png | 200 | compiled in");
    expect(output).not.toContain("GET /styles.css");
    expect(output).not.toContain("INVENTORY");
    expect(output).not.toContain("VITE transformed");
  } finally {
    const exited = new Promise((accept) => child.once("exit", accept));
    child.kill("SIGTERM");
    await exited;
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);

test("Vite rejects invalid and occupied explicit ports", () => {
  for (const port of ["invalid", "-1", "65536", "3000.5"]) {
    const result = spawnSync("bun", [join(engine, "dev.mjs")], {
      cwd: fixture,
      env: { ...process.env, PORT: port },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PORT must be an integer");
  }
  const occupied = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("Occupied"),
  });
  try {
    const result = spawnSync("bun", [join(engine, "dev.mjs")], {
      cwd: fixture,
      env: { ...process.env, PORT: String(occupied.port) },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("already in use");
  } finally {
    occupied.stop(true);
  }
}, 20000);
