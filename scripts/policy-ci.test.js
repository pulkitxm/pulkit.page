import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { parse } from "yaml";

const root = resolve(import.meta.dir, "..");

test("policy CLIs inspect force-tracked ignored files without rewriting them", () => {
  const cwd = mkdtempSync(join(tmpdir(), "portfolio-policy-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    writeFileSync(join(cwd, ".gitignore"), "extras/\n");
    mkdirSync(join(cwd, "extras"));
    const source = `const label = "one${String.fromCodePoint(0x2014)}two"; // comment\n`;
    writeFileSync(join(cwd, "extras/forced.js"), source);
    execFileSync("git", ["add", "-f", "extras/forced.js"], { cwd });
    for (const script of ["check-comments.mjs", "check-em-dashes.mjs"]) {
      const result = spawnSync(process.execPath, [join(root, "scripts", script)], {
        cwd,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extras/forced.js:1:");
    }
    expect(readFileSync(join(cwd, "extras/forced.js"), "utf8")).toBe(source);
    writeFileSync(join(cwd, "extras/forced.js"), 'const label = "one-two";\n');
    for (const script of ["check-comments.mjs", "check-em-dashes.mjs"]) {
      expect(spawnSync(process.execPath, [join(root, "scripts", script)], { cwd }).status).toBe(0);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Knip rejects unused files, exports, and dependencies", () => {
  const cwd = mkdtempSync(join(tmpdir(), "portfolio-knip-"));
  try {
    symlinkSync(join(root, "node_modules"), join(cwd, "node_modules"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "policy-fixture",
        private: true,
        type: "module",
        devDependencies: { yaml: "2.9.1" },
      }),
    );
    writeFileSync(
      join(cwd, "knip.json"),
      JSON.stringify({ entry: ["entry.js"], project: ["*.js"], includeEntryExports: true }),
    );
    writeFileSync(
      join(cwd, "entry.js"),
      'import { used } from "./helper.js"; console.log(used);\n',
    );
    writeFileSync(join(cwd, "helper.js"), "export const used = 1; export const unused = 2;\n");
    writeFileSync(join(cwd, "orphan.js"), "export const orphan = 1;\n");
    const run = () =>
      spawnSync(process.execPath, [join(root, "node_modules/knip/bin/knip.js"), "--no-progress"], {
        cwd,
        encoding: "utf8",
      });
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("orphan.js");
    expect(result.stdout).toContain("unused");
    expect(result.stdout).toContain("yaml");
    rmSync(join(cwd, "orphan.js"));
    writeFileSync(join(cwd, "helper.js"), "export const used = 1;\n");
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ name: "policy-fixture", private: true, type: "module" }),
    );
    expect(run().status).toBe(0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("every check script runs in the GitHub workflow", () => {
  const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
  const workflow = parse(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"));
  const commands = new Set(
    Object.values(workflow.jobs).flatMap((job) =>
      (job.strategy?.matrix?.include ?? []).map((entry) => entry.command),
    ),
  );
  const required = Object.keys(scripts).filter(
    (name) => name.startsWith("check:") || ["format:check", "lint", "test"].includes(name),
  );
  expect(required.filter((name) => !commands.has(name))).toEqual([]);
});
