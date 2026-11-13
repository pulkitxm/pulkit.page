import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  captureInputManifestSchema,
  manifestSchema,
} from "@pulkit/shared/experiment-capture-schema";
import { readExperimentCatalog, syncExperimentCatalog } from "@pulkit/shared/experiment-catalog";
import { normalizeCaptureNotices } from "./capture-input.ts";
import { replaceNoticeSections, sameImplementation } from "./notice-publication.ts";
import {
  implementationFiles,
  publicationRepository,
  sourceEntries,
  sourceFile,
  sourceTree,
} from "./source-publication.ts";

const values = process.argv.slice(2);
const options = new Map(
  values.flatMap((value, index) =>
    value.startsWith("--") ? [[value.slice(2), values[index + 1] ?? ""]] : [],
  ),
);
const revision = options.get("revision") ?? "";
if (!/^[a-f0-9]{40}$/.test(revision) || !options.get("source") || !options.get("capture-source")) {
  throw new Error(
    "Usage: gallery:notices --source <current-source-checkout> --revision <commit> --capture-source <capture-source-checkout> [--publication-source <previous-publication-store>]",
  );
}
const source = resolve(options.get("source") ?? "");
const capturedSource = resolve(options.get("capture-source") ?? "");
const publicationSource = options.get("publication-source");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const data = join(root, "apps/page/data/experiment-gallery");
const assets = join(root, "apps/page/assets/project-previews");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(readFileSync(join(assets, "provenance.json"), "utf8")) as ReturnType<
  typeof manifestSchema.parse
>;
const approval = JSON.parse(readFileSync(join(data, "approval.json"), "utf8"));
if (manifest.version === 2) {
  manifestSchema.parse(manifest);
} else {
  captureInputManifestSchema.parse(manifest);
}
if (
  manifest.recordings.length !== approval.paths.length ||
  new Set(manifest.recordings.map((record) => record.project)).size !== approval.paths.length ||
  manifest.recordings.some((record) => !approval.paths.includes(record.project))
) {
  throw new Error("Notice publication must include exactly the approved projects");
}
const tree = sourceTree(source, revision);
const plans = manifest.recordings.map((capture) => {
  const directory = join(assets, capture.project.replaceAll("/", "--"));
  for (const file of ["poster.webp", "demo.mp4"] as const) {
    const bytes = readFileSync(join(directory, file));
    if (
      hash(bytes) !== capture.assets[file].sha256 ||
      bytes.length !== capture.assets[file].bytes
    ) {
      throw new Error(`Recorded media changed: ${capture.project}`);
    }
  }
  if (
    sourceTree(capturedSource, capture.source_revision, capture.project) !==
    capture.project_source_tree
  ) {
    throw new Error(`Original capture source tree changed: ${capture.project}`);
  }
  const implementation = implementationFiles(
    capturedSource,
    capture.source_revision,
    capture.project,
  );
  const current = implementationFiles(source, revision, capture.project);
  const implementationHash = sameImplementation(implementation, current);
  if (
    capture.implementation_files &&
    JSON.stringify(capture.implementation_files) !== JSON.stringify(implementation)
  ) {
    throw new Error(`Original implementation binding changed: ${capture.project}`);
  }
  const existing = readFileSync(join(directory, "source-notices.txt"), "utf8");
  if (hash(existing) !== (capture.publication?.notices_sha256 ?? capture.notices_sha256)) {
    throw new Error(`Published source notices changed: ${capture.project}`);
  }
  const previousRevision = capture.publication?.source_revision ?? capture.source_revision;
  const previousSource = publicationRepository(previousRevision, [
    source,
    capturedSource,
    ...(publicationSource ? [resolve(publicationSource)] : []),
  ]);
  if (
    sourceTree(previousSource, previousRevision) !==
    (capture.publication?.source_tree ?? capture.source_tree)
  ) {
    throw new Error(
      `Previous publication tree differs from its source binding: ${capture.project}`,
    );
  }
  const sections = [
    {
      previous: sourceFile(previousSource, previousRevision, "LICENSE").toString(),
      current: sourceFile(source, revision, "LICENSE").toString(),
    },
  ];
  for (const path of sourceEntries(previousSource, previousRevision, capture.project).filter(
    (candidate) => candidate.split("/").at(-1) === "THIRD_PARTY_NOTICES.txt",
  )) {
    sections.push({
      previous: sourceFile(
        previousSource,
        previousRevision,
        `${capture.project}/${path}`,
      ).toString(),
      current: sourceFile(source, revision, `${capture.project}/${path}`).toString(),
    });
  }
  const { notices, ...noticeBinding } = normalizeCaptureNotices(
    replaceNoticeSections(existing, sections),
  );
  return {
    directory,
    notices,
    record: {
      ...capture,
      implementation_files: implementation,
      publication: {
        source_revision: revision,
        source_tree: tree,
        project_source_tree: sourceTree(source, revision, capture.project),
        implementation_sha256: implementationHash,
        ...noticeBinding,
      },
    },
  };
});
const renewed = {
  ...manifest,
  version: 2,
  source_revision: revision,
  source_tree: tree,
  recordings: plans.map((plan) => plan.record),
};
manifestSchema.parse(renewed);
writeFileSync(
  join(data, "approval.json"),
  `${JSON.stringify({ ...approval, revision, tree }, null, 2)}\n`,
);
syncExperimentCatalog(source, root);
for (const plan of plans) {
  writeFileSync(join(plan.directory, "source-notices.txt"), plan.notices);
}
writeFileSync(join(assets, "provenance.json"), `${JSON.stringify(renewed, null, 2)}\n`);
console.log(
  `Updated current source notices for ${readExperimentCatalog(root).projects.length} projects; original capture records and media bytes retained.`,
);
