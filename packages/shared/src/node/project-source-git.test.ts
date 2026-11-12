import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { deflateSync } from "node:zlib";
import { projectSourceLimits } from "../content/project-source.ts";
import { readProjectSource, sourceTree, verifySourceCommit } from "./project-source-git.ts";

const project = "hero-sections/example-studio";
const original = ["\uFEFF", "<!doctype html>", "\r\n", "<p>Example studio</p>", "\r\n"].join("");
function fixture(
  run: (value: {
    root: string;
    revision: string;
    tree: string;
    projectTree: string;
    put(path: string, value: string | Buffer): void;
    git(...arguments_: string[]): string;
  }) => void,
  files: Record<string, string | Buffer> = {
    "index.html": original,
  },
): void {
  const root = mkdtempSync(join(tmpdir(), "project-source-test-"));
  const git = (...arguments_: string[]) =>
    execFileSync("git", ["-C", root, ...arguments_], { encoding: "utf8" }).trim();
  const put = (path: string, value: string | Buffer) => {
    mkdirSync(dirname(join(root, project, path)), { recursive: true });
    writeFileSync(join(root, project, path), value);
  };
  try {
    git("init", "--quiet");
    for (const [path, value] of Object.entries(files)) {
      put(path, value);
    }
    git("add", ".");
    const tree = git("write-tree");
    const revision = execFileSync("git", ["-C", root, "commit-tree", tree], {
      input: "Add synthetic interface fixture\n",
      env: {
        PATH: process.env.PATH,
        GIT_AUTHOR_NAME: "Example Developer",
        GIT_AUTHOR_EMAIL: "example@example.test",
        GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
        GIT_COMMITTER_NAME: "Example Developer",
        GIT_COMMITTER_EMAIL: "example@example.test",
        GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
      },
      encoding: "utf8",
    }).trim();
    run({
      root,
      revision,
      tree,
      projectTree: git("rev-parse", `${revision}:${project}`),
      put,
      git,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function corruptObject(root: string, oid: string, type: string, body: Buffer): void {
  chmodSync(join(root, ".git/objects", oid.slice(0, 2), oid.slice(2)), 0o644);
  writeFileSync(
    join(root, ".git/objects", oid.slice(0, 2), oid.slice(2)),
    deflateSync(Buffer.concat([Buffer.from(`${type} ${body.length}\0`), body])),
  );
}

test("reads exact approved Git source rather than dirty files and preserves UTF-8 BOM and line endings", () => {
  fixture(({ root, revision, tree, projectTree, put }) => {
    verifySourceCommit(root, revision, tree);
    put("index.html", "Changed working file");
    const files = readProjectSource(root, revision, project, projectTree);
    expect(files).toHaveLength(1);
    expect(files[0]?.content).toBe(original);
    expect(files[0]?.sha256).toBe(
      createHash("sha256")
        .update(files[0]?.content ?? "")
        .digest("hex"),
    );
    expect(files[0]?.language).toBe("html");
    expect(() => readProjectSource(root, revision, project, "a".repeat(40))).toThrow();
    expect(() => verifySourceCommit(root, revision, "b".repeat(40))).toThrow();
  });
});

test("keeps only positive runtime extensions and the explicit license file, omitting documentation and prompts", () => {
  fixture(
    ({ root, revision, projectTree }) => {
      const files = readProjectSource(root, revision, project, projectTree);
      expect(files.map((file) => file.path)).toEqual([
        ".gitignore",
        "LICENSES/three-MIT.txt",
        "index.html",
        "src/main.ts",
      ]);
      expect(files.map((file) => file.content).join("\n")).not.toContain("Omitted synthetic");
    },
    {
      "index.html": "<p>Example</p>",
      "src/main.ts": "export const example = 1;\n",
      ".gitignore": "node_modules\n",
      "LICENSES/three-MIT.txt": "Synthetic license fixture\n",
      "README.md": "Omitted synthetic documentation",
      "prompt.md": "Omitted synthetic brief",
      "THIRD_PARTY_NOTICES.txt": "Omitted synthetic notice supplied separately",
    },
  );
});

test("rejects captures, media, dependency output and malformed project paths", () => {
  for (const path of [
    ".reference/index.html",
    "captures/page.html",
    "node_modules/package/main.js",
    "dist/main.js",
    "image.png",
    "other.txt",
  ]) {
    fixture(
      ({ root, revision, projectTree }) => {
        expect(() => readProjectSource(root, revision, project, projectTree)).toThrow();
        expect(() =>
          readProjectSource(root, revision, "templates/premium/example", projectTree),
        ).toThrow();
      },
      { "index.html": "<p>Example</p>", [path]: "Synthetic content" },
    );
  }
});

test("rejects executable files and symlinks", () => {
  fixture(({ root, put, git }) => {
    put("script.js", "export const example = true;\n");
    chmodSync(join(root, project, "script.js"), 0o755);
    git("add", ".");
    const tree = git("write-tree");
    const projectTree = git("rev-parse", `${tree}:${project}`);
    expect(() => readProjectSource(root, tree, project, projectTree)).toThrow();
    rmSync(join(root, project, "script.js"));
    symlinkSync("index.html", join(root, project, "alias.html"));
    git("add", ".");
    const linked = git("write-tree");
    expect(() =>
      readProjectSource(root, linked, project, git("rev-parse", `${linked}:${project}`)),
    ).toThrow();
  });
});

test("rejects binary bodies, invalid UTF-8 and file count or byte budgets", () => {
  for (const body of [
    Buffer.from([0xff]),
    Buffer.from("example\0content"),
    Buffer.alloc(projectSourceLimits.fileBytes + 1, 97),
  ]) {
    fixture(
      ({ root, revision, projectTree }) => {
        expect(() => readProjectSource(root, revision, project, projectTree)).toThrow();
      },
      { "index.html": body },
    );
  }
  for (const files of [
    Object.fromEntries(
      Array.from({ length: projectSourceLimits.files + 1 }, (_, index) => [
        `file-${index}.js`,
        "x",
      ]),
    ),
    Object.fromEntries(
      Array.from({ length: 15 }, (_, index) => [`file-${index}.js`, Buffer.alloc(300_000, 97)]),
    ),
  ]) {
    fixture(({ root, revision, projectTree }) => {
      expect(() => readProjectSource(root, revision, project, projectTree)).toThrow();
    }, files);
  }
});

test("detects tampered blob and nested tree objects even when their stored object names are unchanged", () => {
  fixture(
    ({ root, revision, projectTree, git }) => {
      const oid = git("rev-parse", `${revision}:${project}/src/main.js`);
      corruptObject(root, oid, "blob", Buffer.from("different source"));
      expect(() => readProjectSource(root, revision, project, projectTree)).toThrow();
    },
    { "src/main.js": "example source" },
  );
  fixture(
    ({ root, revision, projectTree, git }) => {
      const oid = git("rev-parse", `${revision}:${project}/src`);
      const body = execFileSync("git", ["-C", root, "cat-file", "tree", oid]);
      const changed = Buffer.from(body);
      changed[changed.indexOf(Buffer.from("main.js"))] = 77;
      corruptObject(root, oid, "tree", changed);
      expect(() => readProjectSource(root, revision, project, projectTree)).toThrow();
    },
    { "src/main.js": "example source" },
  );
  fixture(({ root, revision, projectTree }) => {
    const body = execFileSync("git", ["-C", root, "cat-file", "tree", projectTree]);
    const changed = Buffer.from(body);
    changed[changed.indexOf(Buffer.from("index.html"))] = 73;
    corruptObject(root, projectTree, "tree", changed);
    expect(() => sourceTree(root, revision, project)).toThrow();
  });
});
