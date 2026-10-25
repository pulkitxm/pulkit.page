import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot } from "@pulkit/shared/repository";
import sharp from "sharp";
import { validateMedia } from "./validate.ts";

const directories: string[] = [];
function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "media-repair-"));
  directories.push(directory);
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  mkdirSync(join(directory, "apps/example/assets"), { recursive: true });
  mkdirSync(join(directory, "apps/example/content"), { recursive: true });
  return directory;
}
function repair(cwd: string) {
  return spawnSync(
    process.execPath,
    [join(repositoryRoot, "tooling/checks/src/commands/fix-media.ts"), "--stage"],
    {
      cwd,
      encoding: "utf8",
    },
  );
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("automatic repair updates references, normalizes SVG syntax, and stages only related changes", async () => {
  const directory = fixture();
  const asset = join(directory, "apps/example/assets/photo.png");
  const page = join(directory, "apps/example/content/home.md");
  await sharp({ create: { width: 80, height: 40, channels: 3, background: "#1977bb" } })
    .png()
    .toFile(asset);
  const stable = join(directory, "apps/example/assets/stable.webp");
  const original = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#1977bb" },
  })
    .webp()
    .toBuffer();
  writeFileSync(stable, original);
  writeFileSync(page, "![Example](/assets/photo.png)\n");
  const vector = join(directory, "apps/example/assets/wordmark.svg");
  writeFileSync(
    vector,
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" data-fold><path d="M0 0H16V16H0Z" /></svg>\n',
  );
  execFileSync("git", ["add", "apps"], { cwd: directory });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=fixture",
      "-c",
      "user.email=fixture@localhost",
      "commit",
      "--quiet",
      "-m",
      "Initial fixtures",
    ],
    { cwd: directory },
  );
  writeFileSync(join(directory, "unrelated.txt"), "Unrelated work\n");
  const result = repair(directory);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(existsSync(asset)).toBe(false);
  expect(readFileSync(page, "utf8")).toContain("/assets/photo.webp");
  expect(await validateMedia(asset.replace(/\.png$/, ".webp"))).toEqual([]);
  expect(await validateMedia(vector)).toEqual([]);
  expect(readFileSync(vector, "utf8")).toContain('data-fold=""');
  expect(readFileSync(stable)).toEqual(original);
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: directory,
    encoding: "utf8",
  });
  expect(staged).toContain("apps/example/assets/photo.png");
  expect(staged).toContain("apps/example/assets/photo.webp");
  expect(staged).toContain("apps/example/content/home.md");
  expect(staged).toContain("apps/example/assets/wordmark.svg");
  expect(staged).not.toContain("stable.webp");
  expect(staged).not.toContain("unrelated.txt");
  expect(repair(directory).stdout).toContain("Repaired 0 media and reference paths");
});

test("unfixable vectors fail without replacing the source or staging anything", () => {
  const directory = fixture();
  const vector = join(directory, "apps/example/assets/large.svg");
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">${" ".repeat(70 * 1024)}</svg>\n`;
  writeFileSync(vector, source);
  const result = repair(directory);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("simplify the vector source");
  expect(readFileSync(vector, "utf8")).toBe(source);
  expect(
    execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: directory, encoding: "utf8" }),
  ).toBe("");
});
