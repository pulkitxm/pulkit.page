import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import {
  type RunningServer,
  removeTemporaryDirectories,
  runCommand,
  startServer,
  temporaryDirectory,
  writeFiles,
} from "../../test/lib/harness.ts";

afterEach(removeTemporaryDirectories);

test("start requires a build and serves nested built pages without development transforms", async () => {
  const directory = temporaryDirectory("page-start-test-");
  const missing = runCommand("start", directory, { ...process.env, PORT: "0" });
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain("Run `bun run build` first");
  const home = "<!doctype html><html><body>Built homepage</body></html>\n";
  const article = "<!doctype html><html><body>Built article</body></html>\n";
  const notFoundPage = "<!doctype html><html><body>Page not found</body></html>\n";
  writeFiles(directory, {
    "dist/index.html": home,
    "dist/blogs/example/index.html": article,
    "dist/styles.css": "body { color: red; }\n",
    "dist/404.html": notFoundPage,
  });
  let server: RunningServer | undefined;
  try {
    server = await startServer("start", directory, /Built site: (http:\/\/[^\s]+)/);
    const { origin } = server;
    expect(await (await fetch(origin)).text()).toBe(home);
    expect(await (await fetch(`${origin}blogs/example/`)).text()).toBe(article);
    expect((await fetch(`${origin}styles.css`)).status).toBe(200);
    const notFound = await fetch(`${origin}missing/`);
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toBe(notFoundPage);
    expect((await fetch(origin, { method: "HEAD" })).status).toBe(200);
    expect(readFileSync(join(directory, "dist/index.html"), "utf8")).toBe(home);
  } finally {
    await server?.stop();
  }
}, 15_000);
