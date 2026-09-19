import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot as repository } from "@pulkit/shared/repository";

const commands = import.meta.dir;
const engineFixture = join(repository, "packages/engine/test/fixture");
const page =
  "---\ntitle: Building things\ndescription: Example page.\nlayout: home\n---\n\nSoftware engineer based in India.\n";
const fixtureEnv = { ...process.env, NODE_ENV: "production", SITE_URL: "" };
const temporary: string[] = [];

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("pre-commit checks the staged snapshot, not unstaged repairs", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pre-commit-test-"));
  temporary.push(cwd);
  mkdirSync(join(cwd, "content"));
  cpSync(join(engineFixture, "layouts"), join(cwd, "layouts"), { recursive: true });
  const git = (...args: string[]): Buffer =>
    execFileSync("git", args, { env: fixtureEnv, cwd, stdio: "pipe" });
  git("init", "--quiet");
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { ci: `bun ${join(commands, "check-content.ts")}` },
    }),
  );
  cpSync(join(repository, "apps/page/content/_site.md"), join(cwd, "content/_site.md"));
  const broken = page.replace("description: Example page.\n", "");
  writeFileSync(join(cwd, "content/home.md"), broken);
  git("add", ".");
  mkdirSync(join(cwd, "node_modules"));
  writeFileSync(join(cwd, "content/home.md"), page);
  const before = git("diff", "--cached").toString();
  const run = () =>
    spawnSync("sh", [join(repository, ".githooks/pre-commit")], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  const failed = run();
  expect(failed.status).toBe(1);
  expect(failed.stderr).toContain("missing required metadata: description");
  expect(git("diff", "--cached").toString()).toBe(before);
  expect(readFileSync(join(cwd, "content/home.md"), "utf8")).toBe(page);
  git("add", "content/home.md");
  expect(run().status).toBe(0);
});
