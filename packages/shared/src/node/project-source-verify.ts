import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { z } from "zod";
import {
  projectSourceManifestSchema,
  projectSourceSchema,
  projectSourceUrl,
} from "../content/project-source.ts";
import type { approvalSchema, manifestSchema } from "./experiment-capture-schema.ts";
import { verifyCapturePublication } from "./experiment-publication.ts";
import { sha256Hex } from "./hash.ts";

type Approval = z.infer<typeof approvalSchema>;
type Capture = Pick<
  z.infer<typeof manifestSchema>["recordings"][number],
  "project" | "implementation_files" | "publication"
>;
const bindings = [
  "revision",
  "tree",
  "registry_sha256",
  "provenance_sha256",
  "inline_artwork_sha256",
  "license_sha256",
] as const;

function readAsset(path: string, limit = 8 * 1024 * 1024): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) {
    throw new Error("Project source assets must be bounded regular files");
  }
  return readFileSync(path);
}

export function verifySourceAssets(
  outputDirectory: string,
  approval: Approval,
  captures: readonly Capture[],
): void {
  const directory = join(resolve(outputDirectory), "assets/project-source");
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Project source output must be a real directory");
  }
  const expected = new Set([
    "manifest.json",
    ...approval.paths.map((project) => projectSourceUrl(project).split("/").at(-1)),
  ]);
  const entries = readdirSync(directory, { withFileTypes: true });
  if (
    entries.length !== expected.size ||
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !expected.has(entry.name))
  ) {
    throw new Error("Project source output contains missing or unapproved files");
  }
  const manifest = projectSourceManifestSchema.parse(
    JSON.parse(readAsset(join(directory, "manifest.json"), 16 * 1024 * 1024).toString("utf8")),
  );
  if (
    bindings.some((key) => manifest[key] !== approval[key]) ||
    JSON.stringify(manifest.projects.map((entry) => entry.project)) !==
      JSON.stringify(approval.paths)
  ) {
    throw new Error("Project source manifest differs from the approved catalog");
  }
  for (const entry of manifest.projects) {
    const capture = captures.find((recording) => recording.project === entry.project);
    if (capture) {
      verifyCapturePublication(capture, approval);
    }
    if (
      !capture ||
      entry.project_source_tree !== capture.publication.project_source_tree ||
      entry.notices.sha256 !== capture.publication.notices_sha256 ||
      entry.source_notices_sha256 !== capture.publication.source_notices_sha256 ||
      JSON.stringify(entry.files) !== JSON.stringify(capture.implementation_files)
    ) {
      throw new Error("Project source manifest differs from its recorded source or notices");
    }
    const bytes = readAsset(join(resolve(outputDirectory), entry.href));
    if (bytes.length !== entry.bytes || sha256Hex(bytes) !== entry.sha256) {
      throw new Error("Project source bundle bytes differ from their manifest");
    }
    const bundle = projectSourceSchema.parse(JSON.parse(bytes.toString("utf8")));
    if (
      bundle.project !== entry.project ||
      bundle.revision !== approval.revision ||
      JSON.stringify(bundle.files.map(({ path, sha256 }) => ({ path, sha256 }))) !==
        JSON.stringify(entry.files) ||
      JSON.stringify(bundle.notices) !== JSON.stringify(entry.notices) ||
      bundle.files.some((file) => sha256Hex(file.content) !== file.sha256)
    ) {
      throw new Error("Project source content or file inventory differs from its binding");
    }
    if (
      sha256Hex(readAsset(join(resolve(outputDirectory), entry.notices.href))) !==
      capture.publication.notices_sha256
    ) {
      throw new Error("Project source legal notices are missing or changed");
    }
  }
}
