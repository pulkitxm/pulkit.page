import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";
import { implementationDigest } from "@pulkit/shared/experiment-publication";

const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

export function publicationRepository(revision: string, sources: readonly string[]): string {
  for (const source of new Set(sources)) {
    const result = spawnSync(
      "git",
      ["-C", source, "rev-parse", "--verify", "--quiet", `${revision}^{commit}`],
      {
        env: environment,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status === 0 && result.stdout.trim() === revision) {
      return source;
    }
  }
  throw new Error("The previous publication revision is unavailable in the supplied source stores");
}

export function sourceFile(source: string, revision: string, path: string): Buffer {
  return execFileSync("git", ["-C", source, "show", `${revision}:${path}`], {
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
  });
}

export function sourceTree(source: string, revision: string, path = ""): string {
  return execFileSync(
    "git",
    ["-C", source, "rev-parse", path ? `${revision}:${path}` : `${revision}^{tree}`],
    { env: environment, encoding: "utf8" },
  ).trim();
}

export function sourceEntries(source: string, revision: string, project: string) {
  return execFileSync("git", ["-C", source, "ls-tree", "-rz", `${revision}:${project}`], {
    env: environment,
    maxBuffer: 16 * 1024 * 1024,
  })
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const [metadata, path] = record.split("\t");
      if (!path || !/^100(?:644|755) blob [a-f0-9]{40}$/.test(metadata ?? "")) {
        throw new Error("Project source entries must be regular files");
      }
      return path;
    })
    .sort();
}

export function implementationFiles(source: string, revision: string, project: string) {
  return sourceEntries(source, revision, project)
    .filter((path) => !/\.md$/i.test(path) && path.split("/").at(-1) !== "THIRD_PARTY_NOTICES.txt")
    .map((path) => ({
      path,
      sha256: createHash("sha256")
        .update(sourceFile(source, revision, `${project}/${path}`))
        .digest("hex"),
    }));
}

export function sourcePublication(
  source: string,
  approval: { revision: string; tree: string },
  project: string,
  notices: { notices_sha256: string; source_notices_sha256: string; notices_normalization: string },
) {
  const files = implementationFiles(source, approval.revision, project);
  return {
    implementation_files: files,
    publication: {
      source_revision: approval.revision,
      source_tree: approval.tree,
      project_source_tree: sourceTree(source, approval.revision, project),
      implementation_sha256: implementationDigest(files),
      ...notices,
    },
  };
}
