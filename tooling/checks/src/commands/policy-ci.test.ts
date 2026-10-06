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
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot as repository } from "@pulkit/shared/repository";
import { parse } from "yaml";

interface PackageManifest {
  scripts?: Record<string, string>;
  workspaces?: string[];
}

interface TurboConfig {
  tasks: { verify: { dependsOn: string[] } };
}

interface WorkflowJob {
  uses?: string;
  with?: Record<string, string>;
  outputs?: Record<string, string>;
  permissions?: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  needs?: string | string[];
  if?: string;
  "timeout-minutes"?: unknown;
  steps?: { id?: string; uses?: string; run?: string; if?: string }[];
}

interface Workflow {
  on?: { workflow_call?: { inputs?: Record<string, { required?: boolean; type?: string }> } };
  concurrency: { group: string; "cancel-in-progress": boolean | string };
  jobs: Record<string, WorkflowJob>;
}

const commands = import.meta.dir;

function readText(file: string): string {
  return readFileSync(join(repository, file), "utf8");
}

function manifest(file: string): PackageManifest {
  const value: PackageManifest = JSON.parse(readText(file));
  return value;
}

function workflow(name: string): Workflow {
  const value: Workflow = parse(readText(join(".github/workflows", name)));
  return value;
}

function job(jobs: Record<string, WorkflowJob>, id: string): WorkflowJob {
  const found = jobs[id];
  if (!found) {
    throw new Error(`Missing workflow job ${id}`);
  }
  return found;
}

test("policy CLIs inspect force-tracked ignored files without rewriting them", () => {
  const cwd = mkdtempSync(join(tmpdir(), "portfolio-policy-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    writeFileSync(join(cwd, ".gitignore"), "extras/\n");
    mkdirSync(join(cwd, "extras"));
    const source = `const label = "one${String.fromCodePoint(0x2014)}two"; // comment\n`;
    writeFileSync(join(cwd, "extras/forced.js"), source);
    execFileSync("git", ["add", "-f", "extras/forced.js"], { cwd });
    for (const script of ["check-comments.ts", "check-em-dashes.ts"]) {
      const result = spawnSync(process.execPath, [join(commands, script)], {
        cwd,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("extras/forced.js:1:");
    }
    expect(readFileSync(join(cwd, "extras/forced.js"), "utf8")).toBe(source);
    writeFileSync(join(cwd, "extras/forced.js"), 'const label = "one-two";\n');
    for (const script of ["check-comments.ts", "check-em-dashes.ts"]) {
      expect(spawnSync(process.execPath, [join(commands, script)], { cwd }).status).toBe(0);
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
  const turbo: TurboConfig = JSON.parse(readText("turbo.json"));
  const verify = new Set(turbo.tasks.verify.dependsOn);
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const root = manifest("package.json");
  const rootScripts = Object.keys(root.scripts ?? {}).filter(
    (name) => name.startsWith("check:") || ["format:check", "lint"].includes(name),
  );
  const workspaceScripts = (root.workspaces ?? [])
    .flatMap((pattern) => {
      const directory = pattern.replace("/*", "");
      return readdirSync(join(repository, directory)).map(
        (name) => `${directory}/${name}/package.json`,
      );
    })
    .filter((file) => existsSync(join(repository, file)))
    .flatMap((file) => Object.keys(manifest(file).scripts ?? {}))
    .filter((name) => name.startsWith("check:") || name === "test");
  const missing = [
    ...rootScripts.filter((name) => !verify.has(`//#${name}`)),
    ...new Set(
      workspaceScripts.filter(
        (name) => !verify.has(name) && !ciWorkflow.includes(`turbo run ${name}`),
      ),
    ),
  ];
  expect(missing).toEqual([]);
});

const workflows = readdirSync(join(repository, ".github/workflows")).map((name) => ({
  ...workflow(name),
  name,
}));

test("main CI runs are isolated by workflow and revision while branch runs stay cancellable", () => {
  const { concurrency } = workflow("ci.yml");
  expect(concurrency["cancel-in-progress"]).toMatch(
    /^\$\{\{ github.ref != 'refs\/heads\/main' \}\}$/,
  );
  expect(concurrency.group).toContain("github.workflow");
  expect(concurrency.group).toContain("github.event.pull_request.number");
  expect(concurrency.group).toContain("github.ref");
  expect(concurrency.group).toContain("inputs.revision || github.sha");
});

test("deployments serialize and skip stale revisions without failing their completed CI checks", () => {
  const directory = mkdtempSync(join(tmpdir(), "deployment-revision-"));
  try {
    for (const id of ["deploy-page", "deploy-blog"]) {
      const definition = job(workflow("ci.yml").jobs, id);
      expect(definition.concurrency).toEqual({ group: id, "cancel-in-progress": false });
      const [guard, ...steps] = definition.steps ?? [];
      expect(guard?.id).toBe("revision");
      if (!guard?.run) {
        throw new Error("Missing deployment revision check");
      }
      for (const step of steps) {
        expect(step.if).toBe("steps.revision.outputs.current == 'true'");
      }
      for (const current of [true, false]) {
        const output = join(directory, "output");
        const summary = join(directory, "summary");
        writeFileSync(output, "");
        writeFileSync(summary, "");
        const result = spawnSync(
          "bash",
          ["-e", "-c", `gh() { printf '%s\\n' "$TEST_HEAD"; }\n${guard.run}`],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              TEST_HEAD: current ? "current-revision" : "newer-revision",
              REVISION: "current-revision",
              REPOSITORY: "example/site",
              GITHUB_OUTPUT: output,
              GITHUB_STEP_SUMMARY: summary,
            },
          },
        );
        expect(result.status).toBe(0);
        expect(readFileSync(output, "utf8")).toBe(`current=${current}\n`);
        expect(readFileSync(summary, "utf8").includes("Skipped deployment")).toBe(!current);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deploys run in the CI workflow after the gate and only on main", () => {
  const { jobs } = workflow("ci.yml");
  for (const id of ["deploy-page", "deploy-blog"]) {
    expect(job(jobs, id).needs).toBe("ci");
    expect(job(jobs, id).if).toContain("github.ref == 'refs/heads/main'");
    expect(job(jobs, id).if).toContain("github.event_name == 'push'");
    expect(job(jobs, "ci").needs).not.toContain(id);
  }
  expect(
    workflows
      .filter(({ jobs: definitions }) =>
        Object.keys(definitions).some((id) => id.startsWith("deploy-")),
      )
      .map(({ name }) => name),
  ).toEqual(["ci.yml"]);
  expect(job(jobs, "deploy-page").if).toContain("github.workflow == 'Sync guestbook'");
  expect(job(jobs, "deploy-page").if).toContain("github.event_name == 'schedule'");
});

test("guestbook publishing uses Pukbot and the automatic token, then verifies the published revision", () => {
  const source = readText(".github/workflows/guestbook.yml");
  const { jobs } = workflow("guestbook.yml");
  expect(source).not.toContain("GUESTBOOK_PUBLISH_TOKEN");
  expect(source).toMatch(/GH_TOKEN: \$\{\{ github.token \}\}/);
  expect(source).toContain('"$RUNNER_TEMP/pukbot" commit create');
  expect(job(jobs, "sync").permissions?.contents).toBe("write");
  const downstream = job(jobs, "verify-and-deploy");
  expect(downstream.needs).toBe("sync");
  expect(downstream.if).toBe("needs.sync.outputs.changed == 'true'");
  expect(downstream.uses).toBe("./.github/workflows/ci.yml");
  expect(downstream.with?.revision).toMatch(/^\$\{\{ needs.sync.outputs.revision \}\}$/);
  expect(workflow("ci.yml").on?.workflow_call?.inputs?.revision).toEqual({
    required: true,
    type: "string",
  });
  expect(
    readText(".github/workflows/ci.yml").match(/ref: \$\{\{ inputs.revision \|\| github.sha \}\}/g),
  ).toHaveLength(7);
});

test("every workflow job has a timeout and pins actions to a commit", () => {
  for (const { name, jobs } of workflows) {
    for (const [id, definition] of Object.entries(jobs)) {
      if (definition.uses) {
        expect(definition.uses).toMatch(/^\.\/\.github\/workflows\/[\w-]+\.yml$/);
        continue;
      }
      expect(`${name}:${id}:${typeof definition["timeout-minutes"]}`).toBe(`${name}:${id}:number`);
      for (const step of definition.steps ?? []) {
        if (step.uses) {
          expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
        }
      }
    }
  }
});
