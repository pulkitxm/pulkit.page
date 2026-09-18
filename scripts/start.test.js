import { expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dir, "..");

test("start requires a build and serves nested built pages without development transforms", async () => {
  const directory = mkdtempSync(join(tmpdir(), "page-start-test-"));
  let child;
  try {
    cpSync(join(root, "scripts"), join(directory, "scripts"), { recursive: true });
    cpSync(join(root, "package.json"), join(directory, "package.json"));
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"));
    const missing = spawnSync("bun", ["run", "start"], {
      cwd: directory,
      env: { ...process.env, PORT: "0" },
      encoding: "utf8",
    });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Run `bun run build` first");
    mkdirSync(join(directory, "dist/blogs/example"), { recursive: true });
    const home = "<!doctype html><html><body>Built homepage</body></html>\n";
    const article = "<!doctype html><html><body>Built article</body></html>\n";
    writeFileSync(join(directory, "dist/index.html"), home);
    writeFileSync(join(directory, "dist/blogs/example/index.html"), article);
    writeFileSync(join(directory, "dist/styles.css"), "body { color: red; }\n");
    child = spawn("bun", ["start"], {
      cwd: directory,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const origin = await new Promise((accept, reject) => {
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /Built site: (http:\/\/[^\s]+)/.exec(output);
        if (match) {
          accept(match[1]);
        }
      });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Preview exited: ${code}`)));
    });
    expect(await (await fetch(origin)).text()).toBe(home);
    expect(await (await fetch(`${origin}blogs/example/`)).text()).toBe(article);
    expect((await fetch(`${origin}styles.css`)).status).toBe(200);
    expect((await fetch(`${origin}missing/`)).status).toBe(404);
    expect((await fetch(origin, { method: "HEAD" })).status).toBe(200);
    expect(readFileSync(join(directory, "dist/index.html"), "utf8")).toBe(home);
  } finally {
    if (child && child.exitCode === null) {
      const exited = new Promise((accept) => child.once("exit", accept));
      child.kill("SIGTERM");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);
