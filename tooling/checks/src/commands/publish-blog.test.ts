import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot } from "@pulkit/shared/repository";

const revision = "a".repeat(40);
const script = join(repositoryRoot, "tooling/checks/publish-blog.sh");

function fixture(
  run: (
    root: string,
    invoke: (env?: Record<string, string>) => ReturnType<typeof spawnSync>,
  ) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "blog-publisher-"));
  const bin = join(root, "bin");
  const build = join(root, "build");
  mkdirSync(bin);
  mkdirSync(build);
  mkdirSync(join(build, "my-first-talk"));
  writeFileSync(join(build, "my-first-talk/index.html"), "synthetic article\n");
  for (const name of ["index.html", "404.html", "feed.xml", "sitemap.xml"]) {
    writeFileSync(join(build, name), "synthetic content\n".repeat(5000));
  }
  writeFileSync(join(build, "CNAME"), "pulkit.blog\n");
  const programs = {
    gh: `case "$1 $2" in
  'auth status') [ "\${PUBLISH_EXISTING_SESSION:-false}" = true ]; exit $? ;;
esac
printf '%s\\n' "\${PUBLISH_CAN_PUSH:-true}"`,
    git: `if [ "\${PUBLISH_REJECT_GIT_ENV:-false}" = true ]; then
  for variable in GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES; do
    if env | grep -q "^$variable="; then exit 97; fi
  done
fi
case "$1" in
  diff) exit 1 ;;
  rev-parse) printf '%s\\n' "$SOURCE_REVISION" ;;
  ls-remote) printf '%s\\trefs/heads/gh-pages\\n' "\${PUBLISH_TARGET_HEAD:-$SOURCE_REVISION}" ;;
esac`,
    pukbot: `case "$*" in
  *--dry-run*) if [ "\${PUBLISH_DRYRUN_FAIL:-false}" = true ]; then exit 7; fi ;;
esac
printf '%s\\n' accepted`,
  };
  for (const [name, body] of Object.entries(programs)) {
    writeFileSync(
      join(bin, name),
      `#!/bin/sh\nset -eu\nprintf '%s %s\\n' '${name}' "$*" >> "$PUBLISH_TRACE"\n${body}\n`,
      { mode: 0o755 },
    );
  }
  try {
    run(root, (env = {}) =>
      spawnSync("sh", [script, build], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_REF: "refs/heads/main",
          BLOG_PUBLISH_APPROVED: "true",
          GH_TOKEN: "synthetic-token",
          SOURCE_REVISION: revision,
          RUNNER_TEMP: root,
          PUKBOT_BIN: join(bin, "pukbot"),
          PUBLISH_TRACE: join(root, "trace"),
          ...env,
        },
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("blog publishing fails closed without manual approval or a target-repository token", () => {
  const rejected: Record<string, string>[] = [
    { GITHUB_EVENT_NAME: "push" },
    { BLOG_PUBLISH_APPROVED: "false" },
    { GH_TOKEN: "" },
  ];
  for (const env of rejected) {
    fixture((_, invoke) => {
      const result = invoke(env);
      expect(result.status).toBe(1);
      expect(result.stderr?.toString()).toMatch(/manual dispatch|authenticated GitHub session/);
    });
  }
});

test("blog publishing rejects invalid artifacts, insufficient access and a changed target", () => {
  fixture((_, invoke) => {
    const result = invoke({ PUBLISH_CAN_PUSH: "false" });
    expect(result.status).toBe(1);
    expect(result.stderr?.toString()).toContain("cannot write");
  });
  fixture((_, invoke) => {
    const result = invoke({ PUBLISH_TARGET_HEAD: "b".repeat(40) });
    expect(result.status).toBe(1);
    expect(result.stderr?.toString()).toContain("branch changed");
  });
  fixture((root, invoke) => {
    writeFileSync(join(root, "build/CNAME"), "wrong.example\n");
    expect(invoke().status).toBe(1);
  });
  fixture((root, invoke) => {
    mkdirSync(join(root, "build/.github"));
    expect(invoke().status).toBe(1);
  });
});

test("a verified artifact uses default Pukbot mode after a successful dry run", () => {
  fixture((root, invoke) => {
    const result = invoke();
    expect(result.status).toBe(0);
    const trace = readFileSync(join(root, "trace"), "utf8");
    expect(trace).toContain("git add -A");
    const commits = trace.split("\n").filter((line) => line.startsWith("pukbot commit create"));
    expect(commits).toHaveLength(2);
    expect(commits[0]).toContain("--dry-run");
    expect(commits[1]).not.toContain("--dry-run");
    expect(trace).not.toContain("--as-app");
    expect(trace).not.toMatch(/git (?:commit|push)/);
    expect(trace).toContain("--repo pulkitxm/pulkit.blog --branch gh-pages");
  });
});

test("a failed Pukbot dry run prevents publication", () => {
  fixture((root, invoke) => {
    const result = invoke({ PUBLISH_DRYRUN_FAIL: "true" });
    expect(result.status).toBe(7);
    const trace = readFileSync(join(root, "trace"), "utf8");
    const commits = trace.split("\n").filter((line) => line.startsWith("pukbot commit create"));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toContain("--dry-run");
  });
});

test("an existing local GitHub session can publish without storing a new token", () => {
  fixture((_, invoke) => {
    expect(invoke({ GH_TOKEN: "", PUBLISH_EXISTING_SESSION: "true" }).status).toBe(0);
  });
});

test("temporary publishing does not inherit repository-control Git variables", () => {
  fixture((root, invoke) => {
    expect(
      invoke({
        PUBLISH_REJECT_GIT_ENV: "true",
        GIT_DIR: join(root, "unrelated-git"),
        GIT_WORK_TREE: join(root, "unrelated-worktree"),
        GIT_INDEX_FILE: join(root, "unrelated-index"),
        GIT_COMMON_DIR: join(root, "unrelated-common"),
        GIT_OBJECT_DIRECTORY: join(root, "unrelated-objects"),
        GIT_ALTERNATE_OBJECT_DIRECTORIES: join(root, "unrelated-alternates"),
      }).status,
    ).toBe(0);
  });
});
