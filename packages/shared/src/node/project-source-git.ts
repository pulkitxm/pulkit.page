import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { experimentPathSchema } from "../content/experiments.ts";
import { projectSourceLanguage, projectSourceLimits } from "../content/project-source.ts";
import { sha256Hex } from "./hash.ts";

const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !name.startsWith("GIT_") && !["GITHUB_TOKEN", "GH_TOKEN"].includes(name),
  ),
);
const revisionPattern = /^[a-f0-9]{40}$/;

function verifyObject(oid: string, type: string, bytes: Buffer): void {
  if (createHash("sha1").update(`${type} ${bytes.length}\0`).update(bytes).digest("hex") !== oid) {
    throw new Error("Git source object differs from its content identifier");
  }
}

export function sourceGit(
  repository: string,
  arguments_: readonly string[],
  input?: string,
  timeout = 60_000,
): Buffer {
  return execFileSync(
    "git",
    [
      "--no-replace-objects",
      "--no-optional-locks",
      "-c",
      "credential.helper=",
      "-c",
      "core.askPass=",
      "-c",
      "core.hooksPath=/dev/null",
      "-C",
      repository,
      ...arguments_,
    ],
    {
      env: { ...environment, GIT_TERMINAL_PROMPT: "0" },
      input,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

export function sourceTree(repository: string, revision: string, project?: string): string {
  if (!revisionPattern.test(revision)) {
    throw new Error("Source revision must be an exact commit identifier");
  }
  if (project) {
    experimentPathSchema.parse(project);
  }
  const tree = sourceGit(repository, [
    "rev-parse",
    "--verify",
    project ? `${revision}:${project}` : `${revision}^{tree}`,
  ])
    .toString()
    .trim();
  if (!revisionPattern.test(tree)) {
    throw new Error("Approved source tree is unavailable");
  }
  verifyObject(tree, "tree", sourceGit(repository, ["cat-file", "tree", tree]));
  return tree;
}

export function verifySourceCommit(repository: string, revision: string, tree: string): void {
  if (!revisionPattern.test(revision) || !revisionPattern.test(tree)) {
    throw new Error("Approved source identity is invalid");
  }
  const bytes = sourceGit(repository, ["cat-file", "commit", revision]);
  verifyObject(revision, "commit", bytes);
  if (bytes.subarray(0, bytes.indexOf(10)).toString() !== `tree ${tree}`) {
    throw new Error("Approved commit differs from its expected source tree");
  }
}

export function sourceRepository(root: string, revision: string, tree: string): string {
  if (!revisionPattern.test(revision) || !revisionPattern.test(tree)) {
    throw new Error("Approved source identity is invalid");
  }
  const directory = join(root, ".cache", "project-source", revision);
  for (const path of [join(root, ".cache"), join(root, ".cache", "project-source"), directory]) {
    if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) {
      throw new Error("Source cache must contain real directories");
    }
  }
  const cached = existsSync(directory);
  if (!cached) {
    mkdirSync(directory, { recursive: true });
    try {
      sourceGit(directory, ["init", "--bare", "."]);
      sourceGit(
        directory,
        [
          "fetch",
          "--depth=1",
          "--no-tags",
          "--no-write-fetch-head",
          "https://github.com/pulkitxm/claude-directory.git",
          revision,
        ],
        undefined,
        120_000,
      );
    } catch (error) {
      rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }
  if (
    sourceTree(directory, revision) !== tree ||
    sourceGit(directory, ["rev-parse", "--is-bare-repository"]).toString().trim() !== "true" ||
    sourceGit(directory, ["rev-list", "--count", revision]).toString().trim() !== "1"
  ) {
    throw new Error("Cached source differs from the approved Git tree");
  }
  return directory;
}

export function readProjectSource(
  repository: string,
  revision: string,
  project: string,
  expectedTree: string,
) {
  if (sourceTree(repository, revision, project) !== expectedTree) {
    throw new Error("Project source differs from its recorded Git tree");
  }
  const trees: string[] = [];
  const entries = sourceGit(repository, ["ls-tree", "-rltz", `${revision}:${project}`])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .flatMap((record) => {
      const separator = record.indexOf("\t");
      const metadata = record.slice(0, separator).trim().split(/\s+/);
      const path = record.slice(separator + 1);
      const [mode, type, oid, sizeText] = metadata;
      if (mode === "040000" && type === "tree" && revisionPattern.test(oid ?? "")) {
        trees.push(oid as string);
        return [];
      }
      if (
        separator < 0 ||
        mode !== "100644" ||
        type !== "blob" ||
        !revisionPattern.test(oid ?? "") ||
        !/^\d+$/.test(sizeText ?? "")
      ) {
        throw new Error("Project source must contain regular nonexecutable Git blobs");
      }
      const language = projectSourceLanguage(path);
      if (!language) {
        if (/\.md$/i.test(path) || path.split("/").at(-1) === "THIRD_PARTY_NOTICES.txt") {
          return [];
        }
        throw new Error("Unsupported source path cannot enter a project bundle");
      }
      const size = Number(sizeText);
      if (size > projectSourceLimits.fileBytes) {
        throw new Error("Project source file exceeds its byte limit");
      }
      return [{ path, language, oid: oid as string, size }];
    })
    .sort((left, right) => {
      if (left.path === right.path) {
        return 0;
      }
      return left.path < right.path ? -1 : 1;
    });
  if (
    entries.length === 0 ||
    entries.length > projectSourceLimits.files ||
    entries.reduce((total, entry) => total + entry.size, 0) > projectSourceLimits.totalBytes ||
    new Set(entries.map((entry) => entry.path)).size !== entries.length
  ) {
    throw new Error("Project source file inventory exceeds its limits");
  }
  const objects = [
    ...trees.map((oid) => ({ oid, type: "tree" })),
    ...entries.map(({ oid }) => ({ oid, type: "blob" })),
  ];
  const batch = sourceGit(
    repository,
    ["cat-file", "--batch"],
    `${objects.map((entry) => entry.oid).join("\n")}\n`,
  );
  let offset = 0;
  const blobs = objects.map((entry) => {
    const end = batch.indexOf(10, offset);
    const header = batch.subarray(offset, end).toString().split(" ");
    const size = Number(header[2]);
    if (
      end < 0 ||
      header[0] !== entry.oid ||
      header[1] !== entry.type ||
      !/^\d+$/.test(header[2] ?? "") ||
      size > projectSourceLimits.totalBytes
    ) {
      throw new Error("Git source blob metadata differs from its tree entry");
    }
    const bytes = batch.subarray(end + 1, end + 1 + size);
    offset = end + 2 + size;
    if (bytes.length !== size || batch[offset - 1] !== 10) {
      throw new Error("Git source blob is truncated");
    }
    verifyObject(entry.oid, entry.type, bytes);
    return bytes;
  });
  const files = entries.map((entry, index) => {
    const bytes = blobs[trees.length + index];
    if (!bytes || bytes.length !== entry.size || bytes.includes(0)) {
      throw new Error("Git source blob identity or text encoding is invalid");
    }
    const content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!Buffer.from(content).equals(bytes)) {
      throw new Error("Source text must preserve its exact UTF-8 bytes");
    }
    return { path: entry.path, language: entry.language, content, sha256: sha256Hex(bytes) };
  });
  if (offset !== batch.length) {
    throw new Error("Unexpected trailing Git source data");
  }
  return files;
}
