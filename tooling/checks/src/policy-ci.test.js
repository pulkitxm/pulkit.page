import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { parse } from "yaml";

const checks = resolve(import.meta.dir);
const repository = resolve(import.meta.dir, "../../..");

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
      const result = spawnSync(process.execPath, [join(checks, script)], {
        cwd,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extras/forced.js:1:");
    }
    expect(readFileSync(join(cwd, "extras/forced.js"), "utf8")).toBe(source);
    writeFileSync(join(cwd, "extras/forced.js"), 'const label = "one-two";\n');
    for (const script of ["check-comments.mjs", "check-em-dashes.mjs"]) {
      expect(spawnSync(process.execPath, [join(checks, script)], { cwd }).status).toBe(0);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Knip rejects unused files, exports, and dependencies", () => {
  const cwd = mkdtempSync(join(tmpdir(), "portfolio-knip-"));
  try {
    symlinkSync(join(repository, "node_modules"), join(cwd, "node_modules"));
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
      spawnSync(
        process.execPath,
        [join(repository, "node_modules/knip/bin/knip.js"), "--no-progress"],
        {
          cwd,
          encoding: "utf8",
        },
      );
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
}, 60000);

test("turbo verify runs every check, lint, format and test script", () => {
  const read = (file) => JSON.parse(readFileSync(join(repository, file), "utf8"));
  const verify = new Set(read("turbo.json").tasks.verify.dependsOn);
  const workflow = readFileSync(join(repository, ".github/workflows/ci.yml"), "utf8");
  const rootScripts = Object.keys(read("package.json").scripts).filter(
    (name) => name.startsWith("check:") || ["format:check", "lint"].includes(name),
  );
  const workspaceScripts = read("package.json")
    .workspaces.flatMap((pattern) => {
      const directory = pattern.replace("/*", "");
      return readdirSync(join(repository, directory)).map(
        (name) => `${directory}/${name}/package.json`,
      );
    })
    .filter((file) => existsSync(join(repository, file)))
    .flatMap((file) => Object.keys(read(file).scripts ?? {}))
    .filter((name) => name.startsWith("check:") || name === "test");
  const missing = [
    ...rootScripts.filter((name) => !verify.has(`//#${name}`)),
    ...new Set(
      workspaceScripts.filter(
        (name) => !verify.has(name) && !workflow.includes(`turbo run ${name}`),
      ),
    ),
  ];
  expect(missing).toEqual([]);
});

const workflow = (name) => parse(readFileSync(join(repository, ".github/workflows", name), "utf8"));
const workflows = readdirSync(join(repository, ".github/workflows")).map((name) => ({
  name,
  ...workflow(name),
}));

test("a newer CI run cancels the older one on every branch, including main", () => {
  const { concurrency } = workflow("ci.yml");
  expect(concurrency["cancel-in-progress"]).toBe(true);
  expect(concurrency.group).toContain("github.event.pull_request.number");
  expect(concurrency.group).toContain("github.ref");
});

test("deploys run in the CI workflow after the gate, only for main pushes and manual runs", () => {
  const { jobs } = workflow("ci.yml");
  for (const id of ["deploy-page", "deploy-blog"]) {
    expect(jobs[id].needs).toBe("ci");
    expect(jobs[id].if).toContain("github.ref == 'refs/heads/main'");
    expect(jobs[id].if).toContain("github.event_name == 'push'");
    expect(jobs.ci.needs).not.toContain(id);
  }
  expect(readdirSync(join(repository, ".github/workflows"))).toEqual(["ci.yml"]);
});

test("every workflow job has a timeout and pins actions to a commit", () => {
  for (const { name, jobs } of workflows) {
    for (const [id, job] of Object.entries(jobs)) {
      expect(`${name}:${id}:${typeof job["timeout-minutes"]}`).toBe(`${name}:${id}:number`);
      for (const step of job.steps ?? []) {
        if (step.uses) {
          expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
        }
      }
    }
  }
});
