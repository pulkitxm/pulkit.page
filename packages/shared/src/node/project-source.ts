import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  projectSourceManifestSchema,
  projectSourceSchema,
  projectSourceUrl,
} from "../content/project-source.ts";
import { approvalSchema, manifestSchema } from "./experiment-capture-schema.ts";
import { readExperimentCatalog, verifyExperimentCatalogSource } from "./experiment-catalog.ts";
import { implementationDigest, verifyCapturePublication } from "./experiment-publication.ts";
import { sha256Hex } from "./hash.ts";
import {
  readProjectSource,
  sourceGit,
  sourceRepository,
  sourceTree,
  verifySourceCommit,
} from "./project-source-git.ts";

import { verifySourceAssets } from "./project-source-verify.ts";
export function verifyProjectSources(root: string, outputDirectory: string): void {
  readExperimentCatalog(root);
  const approval = approvalSchema.parse(
    JSON.parse(readFileSync(join(root, "apps/page/data/experiment-gallery/approval.json"), "utf8")),
  );
  const captures = manifestSchema.parse(
    JSON.parse(
      readFileSync(join(root, "apps/page/assets/project-previews/provenance.json"), "utf8"),
    ),
  );
  verifySourceAssets(outputDirectory, approval, captures.recordings);
}

export async function buildProjectSources(
  root: string,
  outputDirectory: string,
  sourceCheckout?: string,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  readExperimentCatalog(root);
  await verifyExperimentCatalogSource(root, request);
  const data = join(root, "apps/page/data/experiment-gallery");
  const approval = approvalSchema.parse(
    JSON.parse(readFileSync(join(data, "approval.json"), "utf8")),
  );
  const captures = manifestSchema.parse(
    JSON.parse(
      readFileSync(join(root, "apps/page/assets/project-previews/provenance.json"), "utf8"),
    ),
  );
  const repository = sourceCheckout ?? sourceRepository(root, approval.revision, approval.tree);
  verifySourceCommit(repository, approval.revision, approval.tree);
  if (
    sourceTree(repository, approval.revision) !== approval.tree ||
    sha256Hex(sourceGit(repository, ["show", `${approval.revision}:LICENSE`])) !==
      approval.license_sha256
  ) {
    throw new Error("Source tree or license differs from the approved publication");
  }
  const assets = approval.paths.map((project) => {
    const capture = captures.recordings.find((recording) => recording.project === project);
    if (!capture) {
      throw new Error("Project recording has no matching approved source binding");
    }
    verifyCapturePublication(capture, approval);
    const publication = capture.publication;
    const notices = {
      href: `/assets/project-previews/${project.replaceAll("/", "--")}/source-notices.txt`,
      sha256: publication.notices_sha256,
    };
    const bytes = readFileSync(join(root, "apps/page", notices.href));
    if (sha256Hex(bytes) !== notices.sha256) {
      throw new Error("Source bundle notices differ from their approved hash");
    }
    const files = readProjectSource(
      repository,
      approval.revision,
      project,
      publication.project_source_tree,
    );
    const fingerprints = files.map(({ path, sha256 }) => ({ path, sha256 }));
    if (
      JSON.stringify(fingerprints) !== JSON.stringify(capture.implementation_files) ||
      implementationDigest(fingerprints) !== publication.implementation_sha256
    ) {
      throw new Error("Current project source differs from its recorded implementation");
    }
    const bundle = projectSourceSchema.parse({
      version: 1,
      revision: approval.revision,
      project,
      files,
      notices,
    });
    const content = Buffer.from(`${JSON.stringify(bundle)}\n`);
    return {
      content,
      entry: {
        project,
        project_source_tree: publication.project_source_tree,
        href: projectSourceUrl(project),
        sha256: sha256Hex(content),
        bytes: content.length,
        files: fingerprints,
        notices,
        source_notices_sha256: publication.source_notices_sha256,
      },
    };
  });
  const manifest = projectSourceManifestSchema.parse({
    version: 1,
    revision: approval.revision,
    tree: approval.tree,
    registry_sha256: approval.registry_sha256,
    provenance_sha256: approval.provenance_sha256,
    inline_artwork_sha256: approval.inline_artwork_sha256,
    license_sha256: approval.license_sha256,
    projects: assets.map(({ entry }) => entry),
  });
  const output = join(resolve(outputDirectory), "assets/project-source");
  const rootRelative = relative(resolve(root), resolve(outputDirectory));
  if (!rootRelative) {
    throw new Error("Source bundles require a separate build output directory");
  }
  if (!rootRelative.startsWith(`..${sep}`) && rootRelative !== ".." && !isAbsolute(rootRelative)) {
    sourceGit(root, ["check-ignore", "--quiet", "--", resolve(outputDirectory)]);
  }
  for (const path of [resolve(outputDirectory), join(resolve(outputDirectory), "assets")]) {
    if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) {
      throw new Error("Source bundle output requires real build directories");
    }
  }
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const asset of assets) {
    const destination = join(resolve(outputDirectory), asset.entry.href);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, asset.content);
  }
  writeFileSync(join(output, "manifest.json"), `${JSON.stringify(manifest)}\n`);
}
