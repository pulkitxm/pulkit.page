import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { z } from "zod";
import {
  type ExperimentProject,
  experimentCategories,
  experimentIndexSchema,
  experimentPreview,
  experimentSource,
} from "../content/experiments.ts";
import {
  approvalSchema,
  descriptionsSchema,
  inlineSchema,
  manifestSchema,
  provenanceSchema,
  registrySchema,
} from "./experiment-capture-schema.ts";

import { currentExperimentRevision } from "./experiment-source-revision.ts";

const dataPath = "apps/page/data/experiment-gallery";
const assetPath = "apps/page/assets/project-previews";
function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function catalogApproval(root: string) {
  return approvalSchema.parse(
    JSON.parse(readFileSync(join(root, dataPath, "approval.json"), "utf8")),
  );
}
function records(
  approval: z.infer<typeof approvalSchema>,
  registryBytes: Uint8Array,
  provenanceBytes: Uint8Array,
) {
  if (
    new Set(approval.paths).size !== approval.paths.length ||
    new Set(approval.paths.map((path) => path.replaceAll("/", "--"))).size !== approval.paths.length
  ) {
    throw new Error("Duplicate approved gallery path");
  }
  const registry = registrySchema.parse(JSON.parse(Buffer.from(registryBytes).toString()));
  provenanceSchema.parse(JSON.parse(Buffer.from(provenanceBytes).toString()));
  if (new Set(registry.map((record) => record.path)).size !== registry.length) {
    throw new Error("Duplicate primary registry path");
  }
  for (const path of approval.paths) {
    const reviewed = registry.find((record) => record.path === path);
    if (
      reviewed?.status !== "cleared" ||
      reviewed.review.trim().length < 40 ||
      /\b(?:pending|unknown|unverified|uncertain|unclear|tbd|todo)\b/i.test(reviewed.review)
    ) {
      throw new Error(`Project has no completed primary rights review: ${path}`);
    }
  }
}
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Gallery preview files cannot contain symlinks");
    }
    return entry.isDirectory() ? files(path) : [path];
  });
}
function sourceSnapshots(root: string, approval: z.infer<typeof approvalSchema>) {
  const registry = readFileSync(join(root, dataPath, "registry.json"));
  const provenance = readFileSync(join(root, dataPath, "provenance.json"));
  const inline = readFileSync(join(root, dataPath, "inline-artwork.json"));
  const license = readFileSync(join(root, dataPath, "source-license.txt"));
  if (
    sha256(registry) !== approval.registry_sha256 ||
    sha256(provenance) !== approval.provenance_sha256 ||
    sha256(inline) !== approval.inline_artwork_sha256 ||
    sha256(license) !== approval.license_sha256
  ) {
    throw new Error("Gallery rights snapshots changed without renewed review");
  }
  records(approval, registry, provenance);
  inlineSchema.parse(JSON.parse(inline.toString()));
  return { registry, provenance, inline, license };
}

export function readExperimentCatalog(root: string): z.infer<typeof experimentIndexSchema> {
  const approval = catalogApproval(root);
  const snapshots = sourceSnapshots(root, approval);
  const descriptions = descriptionsSchema.parse(
    JSON.parse(readFileSync(join(root, dataPath, "descriptions.json"), "utf8")),
  );
  if (
    Object.keys(descriptions).length !== approval.paths.length ||
    Object.keys(descriptions).some((path) => !approval.paths.includes(path))
  ) {
    throw new Error("Project descriptions must match the explicit gallery allowlist");
  }
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(join(root, assetPath, "provenance.json"), "utf8")),
  );
  if (
    manifest.source_revision !== approval.revision ||
    manifest.source_tree !== approval.tree ||
    manifest.recordings.length !== approval.paths.length ||
    new Set(manifest.recordings.map((record) => record.project)).size !== approval.paths.length
  ) {
    throw new Error(
      "Capture provenance must match every approved project and exact source revision",
    );
  }
  const expected = new Set(["provenance.json"]);
  if (
    manifest.finalizer_source !== `recipes/${manifest.finalizer_sha256}.txt` ||
    sha256(readFileSync(join(root, assetPath, manifest.finalizer_source))) !==
      manifest.finalizer_sha256
  ) {
    throw new Error("Capture finalizer source differs from its recorded SHA-256");
  }
  expected.add(manifest.finalizer_source);
  if (
    manifest.input_verifier_source !== `recipes/${manifest.input_verifier_sha256}.txt` ||
    sha256(readFileSync(join(root, assetPath, manifest.input_verifier_source))) !==
      manifest.input_verifier_sha256
  ) {
    throw new Error("Capture input verifier source differs from its recorded SHA-256");
  }
  expected.add(manifest.input_verifier_source);
  const usedRecipes = new Set(
    manifest.recordings.map(
      (record) => `${record.capture_tool_sha256}:${record.capture_producer_sha256}`,
    ),
  );
  if (
    usedRecipes.size !== manifest.recipes.length ||
    new Set(manifest.recipes.map((recipe) => `${recipe.worker_sha256}:${recipe.producer_sha256}`))
      .size !== manifest.recipes.length
  ) {
    throw new Error("Capture recipe records are duplicated or stale");
  }
  for (const recipe of manifest.recipes) {
    if (!usedRecipes.has(`${recipe.worker_sha256}:${recipe.producer_sha256}`)) {
      throw new Error("Capture recipe was not used by an approved recording");
    }
    for (const [path, expectedHash] of [
      [recipe.worker_source, recipe.worker_sha256],
      [recipe.producer_source, recipe.producer_sha256],
    ] as const) {
      if (
        path !== `recipes/${expectedHash}.txt` ||
        sha256(readFileSync(join(root, assetPath, path))) !== expectedHash
      ) {
        throw new Error("Capture recipe source differs from its recorded SHA-256");
      }
      expected.add(path);
    }
  }
  let totalBytes = 0;
  const projects = approval.paths.map((path): ExperimentProject => {
    const capture = manifest.recordings.find((record) => record.project === path);
    if (
      !capture ||
      capture.source_revision !== approval.revision ||
      capture.source_tree !== approval.tree
    ) {
      throw new Error(`Fresh project capture is missing or stale: ${path}`);
    }
    if (
      capture.normalization
        ? capture.normalization.input_sha256 !== capture.input_video_sha256
        : capture.input_video_sha256 !== capture.assets["demo.mp4"].sha256
    ) {
      throw new Error("Fresh recording input hash differs from its recorded processing step");
    }
    const built = capture.built_files;
    if (
      new Set(built.map((file) => file.path)).size !== built.length ||
      !built.some((file) => file.path === "index.html") ||
      sha256(built.map((file) => `${file.path}\0${file.sha256}\n`).join("")) !==
        capture.project_build_sha256 ||
      new Set(capture.runtime.viewports.map((viewport) => viewport.width)).size !== 2 ||
      !capture.runtime.viewports.some((viewport) => viewport.width === 1280) ||
      !capture.runtime.viewports.some((viewport) => viewport.width === 390)
    ) {
      throw new Error(`Captured build or responsive verification is invalid: ${path}`);
    }
    const name = path.replaceAll("/", "--");
    for (const file of ["poster.webp", "demo.mp4"] as const) {
      const asset = capture.assets[file];
      const bytes = readFileSync(join(root, assetPath, name, file));
      if (
        sha256(bytes) !== asset.sha256 ||
        bytes.byteLength !== asset.bytes ||
        bytes.byteLength > (file === "poster.webp" ? 512 * 1024 : 6 * 1024 * 1024) ||
        (file === "poster.webp"
          ? bytes.subarray(0, 4).toString() !== "RIFF" ||
            bytes.subarray(8, 12).toString() !== "WEBP"
          : bytes.subarray(4, 8).toString() !== "ftyp")
      ) {
        throw new Error(
          `Fresh preview SHA-256, format or budget differs from its capture record: ${path}`,
        );
      }
      expected.add(`${name}/${file}`);
      totalBytes += bytes.byteLength;
    }
    const notice = readFileSync(join(root, assetPath, name, "source-notices.txt"));
    if (
      sha256(notice) !== capture.notices_sha256 ||
      !notice.subarray(0, snapshots.license.length).equals(snapshots.license)
    ) {
      throw new Error(`Source license notices are missing or changed: ${path}`);
    }
    expected.add(`${name}/source-notices.txt`);
    const copy = descriptions[path];
    if (!copy) {
      throw new Error(`Project description missing: ${path}`);
    }
    const group = path.split("/")[0] ?? "";
    return {
      path,
      name,
      ...copy,
      group,
      category: experimentCategories[group] ?? "UI experiments",
      thumbnail: `/assets/project-previews/${name}/poster.webp`,
      video: `/assets/project-previews/${name}/demo.mp4`,
      source: experimentSource(path),
      preview: experimentPreview(path),
    };
  });
  if (totalBytes > 550 * 1024 * 1024) {
    throw new Error("Gallery preview assets exceed their total media budget");
  }
  const actual = files(join(root, assetPath)).map((file) => relative(join(root, assetPath), file));
  if (actual.length !== expected.size || actual.some((file) => !expected.has(file))) {
    throw new Error("Unverified or stale files exist in the project preview directory");
  }
  if (existsSync(join(root, "apps/page/assets/experiment-artwork"))) {
    throw new Error("Retired abstract artwork must not be distributed with fresh project previews");
  }
  return experimentIndexSchema.parse({ version: 1, revision: approval.revision, projects });
}

export function syncExperimentCatalog(source: string, root: string): void {
  const approval = catalogApproval(root);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const read = (path: string): Buffer =>
    execFileSync("git", ["-C", source, "show", `${approval.revision}:${path}`], {
      env,
      maxBuffer: 16 * 1024 * 1024,
    });
  const registry = read("compliance/projects.json");
  const provenance = read("ASSET_PROVENANCE.json");
  const inline = read("compliance/inline-artwork.json");
  const license = read("LICENSE");
  records(approval, registry, provenance);
  inlineSchema.parse(JSON.parse(inline.toString()));
  const tree = execFileSync("git", ["-C", source, "rev-parse", `${approval.revision}^{tree}`], {
    env,
    encoding: "utf8",
  }).trim();
  if (tree !== approval.tree) {
    throw new Error("Approved source Git tree differs from the reviewed tree");
  }
  mkdirSync(join(root, dataPath), { recursive: true });
  for (const [name, bytes] of [
    ["registry.json", registry],
    ["provenance.json", provenance],
    ["inline-artwork.json", inline],
    ["source-license.txt", license],
  ] as const) {
    writeFileSync(join(root, dataPath, name), bytes);
  }
  writeFileSync(
    join(root, dataPath, "approval.json"),
    `${JSON.stringify({ ...approval, registry_sha256: sha256(registry), provenance_sha256: sha256(provenance), inline_artwork_sha256: sha256(inline), license_sha256: sha256(license) }, null, 2)}\n`,
  );
}

export async function verifyExperimentCatalogSource(
  root: string,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const approval = catalogApproval(root);
  readExperimentCatalog(root);
  const raw = `https://raw.githubusercontent.com/${approval.repository}/`;
  const snapshots = [
    ["compliance/projects.json", approval.registry_sha256],
    ["ASSET_PROVENANCE.json", approval.provenance_sha256],
    ["compliance/inline-artwork.json", approval.inline_artwork_sha256],
    ["LICENSE", approval.license_sha256],
  ] as const;
  for (const [path, expected] of snapshots) {
    const response = await request(`${raw}${approval.revision}/${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok || sha256(new Uint8Array(await response.arrayBuffer())) !== expected) {
      throw new Error("The approved gallery snapshots do not match their primary source revision");
    }
  }
  const currentRevision = await currentExperimentRevision(request);
  const current = await Promise.all(
    snapshots.map(([path]) =>
      request(`${raw}${currentRevision}/${path}`, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    ),
  );
  if (current.some((response) => !response.ok)) {
    throw new Error("Current primary clearance could not be verified; stop for manual review");
  }
  try {
    const bytes = await Promise.all(
      current.map(async (response) => Buffer.from(await response.arrayBuffer())),
    );
    const [registry, provenance, inline, license] = bytes;
    if (!registry || !provenance || !inline || !license) {
      throw new Error("Current source metadata missing");
    }
    records(approval, registry, provenance);
    const reviewed = inlineSchema.parse(
      JSON.parse(readFileSync(join(root, dataPath, "inline-artwork.json"), "utf8")),
    );
    const latest = inlineSchema.parse(JSON.parse(inline.toString()));
    for (const kind of ["files", "licenses", "notices"] as const) {
      for (const entry of reviewed[kind].filter((file) =>
        approval.paths.some((path) => file.path.startsWith(`${path}/`)),
      )) {
        const now = latest[kind].find((candidate) => candidate.path === entry.path);
        if (
          now?.sha256 !== entry.sha256 ||
          ("review" in entry && (!now || !("review" in now) || now.review !== entry.review))
        ) {
          throw new Error("Reviewed source artwork or notices were removed or changed");
        }
      }
    }
    if (sha256(license) !== approval.license_sha256) {
      throw new Error("Primary license changed");
    }
  } catch (cause) {
    throw new Error(
      "Primary clearance was withdrawn or source artwork permission changed; stop for manual review",
      { cause },
    );
  }
}

export function removeRetiredGalleryArtwork(root: string): void {
  const directory = join(root, "apps/page/assets/experiment-artwork");
  if (!existsSync(directory)) {
    return;
  }
  const manifest = z
    .object({
      license_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      assets: z.array(
        z.object({
          path: z.string().regex(/^[a-z0-9-]+\/original-visual\.svg$/),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      ),
    })
    .parse(JSON.parse(readFileSync(join(directory, "provenance.json"), "utf8")));
  const expected = new Set([
    "license.txt",
    "provenance.json",
    ...manifest.assets.map((asset) => asset.path),
  ]);
  const actual = files(directory).map((file) => relative(directory, file));
  if (
    actual.length !== expected.size ||
    actual.some((file) => !expected.has(file)) ||
    sha256(readFileSync(join(directory, "license.txt"))) !== manifest.license_sha256
  ) {
    throw new Error("Retired gallery files changed and require manual review");
  }
  for (const asset of manifest.assets) {
    if (sha256(readFileSync(join(directory, asset.path))) !== asset.sha256) {
      throw new Error("Retired original artwork changed and requires manual review");
    }
  }
  rmSync(directory, { recursive: true });
}
