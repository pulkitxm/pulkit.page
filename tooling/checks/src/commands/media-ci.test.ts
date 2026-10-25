import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot } from "@pulkit/shared/repository";
import { parse } from "yaml";

interface Step {
  id?: string;
  name?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
}
interface Job {
  permissions?: Record<string, string>;
  outputs?: Record<string, string>;
  steps: Step[];
}
const workflow: { jobs: Record<string, Job> } = parse(
  readFileSync(join(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
);
const media = workflow.jobs.media;
const gate = workflow.jobs.ci;

test("media repairs publish through Pukbot with source verification, a branch race guard, and no dispatch", () => {
  expect(media?.permissions).toEqual({ contents: "write" });
  const verified =
    media?.steps.findIndex((step) => step.run === "bunx turbo run verify:source") ?? -1;
  const published = media?.steps.findIndex((step) => step.id === "publish") ?? -1;
  expect(verified).toBeGreaterThan(-1);
  expect(published).toBeGreaterThan(verified);
  const script = media?.steps[published]?.run ?? "";
  expect(script).toContain('"$RUNNER_TEMP/pukbot" commit create');
  expect(script).toContain('"$current" != "$SOURCE_REVISION"');
  expect(script).toContain('echo "revision=$revision" >> "$GITHUB_OUTPUT"');
  expect(script).not.toContain("workflow dispatch");
  const repair = media?.steps.find((step) => step.run === "bun run media:fix --stage");
  expect(repair?.if).toContain(
    "github.event.pull_request.head.repo.full_name == github.repository",
  );
  expect(media?.outputs?.revision).toContain("steps.publish.outputs.revision");
});

test("the aggregate result is recorded against the exact verified SHA even after a failed check", () => {
  expect(gate?.permissions).toEqual({ contents: "read", checks: "write" });
  expect(gate?.outputs?.revision).toMatch(/^\$\{\{ needs.media.outputs.revision \}\}$/);
  const step = gate?.steps.find(
    (candidate) => candidate.name === "Attach CI result to the verified revision",
  );
  expect(step?.if).toContain("always()");
  expect(step?.if).toContain("needs.media.outputs.revision != github.sha");
  expect(step?.env?.REVISION).toMatch(/^\$\{\{ needs.media.outputs.revision \}\}$/);
  expect(step?.env?.CONCLUSION).toMatch(/^\$\{\{ job.status \}\}$/);
  if (!step?.run) {
    throw new Error("Missing check publication script");
  }
  for (const result of ["success", "failure", "cancelled"]) {
    const script = `gh() { printf '%s\\n' "$@"; }\n${step.run}`;
    const executed = spawnSync("bash", ["-eo", "pipefail", "-c", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        REPOSITORY: "example/site",
        REVISION: "verified-revision",
        CONCLUSION: result,
        RUN_URL: "https://example.com/run",
      },
    });
    expect(executed.status).toBe(0);
    expect(executed.stdout).toContain("head_sha=verified-revision");
    expect(executed.stdout).toContain(`conclusion=${result}`);
  }
});
