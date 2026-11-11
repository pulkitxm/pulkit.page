import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { z } from "zod";
import {
  type ExperimentProject,
  experimentCategories,
  experimentIndexSchema,
  experimentPathSchema,
  experimentPreview,
  experimentRepository,
  experimentSource,
} from "../content/experiments.ts";

const dataPath = "apps/page/data/experiment-gallery";
const assetPath = "apps/page/assets/experiment-artwork";
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const approvalSchema = z.object({
  version: z.literal(1),
  repository: z.literal(experimentRepository),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  paths: z.array(experimentPathSchema).min(1),
  registry_sha256: hashSchema,
  provenance_sha256: hashSchema,
  license_sha256: hashSchema,
});
const registrySchema = z.array(
  z.object({ path: experimentPathSchema, status: z.string(), review: z.string() }),
);
const assetSchema = z.object({
  path: z.string(),
  sha256: hashSchema,
  origin: z.string(),
  license: z.string(),
  kind: z.string(),
  redistribution_permission: z.union([z.string(), z.boolean()]),
});
const provenanceSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema) });
const svgTags = new Set([
  "svg",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "g",
]);

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function completedReview(value: string): boolean {
  return (
    value.trim().length >= 40 &&
    !/\b(?:pending|unknown|unverified|uncertain|unclear|tbd|todo)\b/i.test(value)
  );
}

function records(
  approval: z.infer<typeof approvalSchema>,
  registryBytes: Buffer,
  provenanceBytes: Buffer,
) {
  if (new Set(approval.paths).size !== approval.paths.length) {
    throw new Error("Duplicate approved gallery path");
  }
  if (
    new Set(approval.paths.map((path) => path.replaceAll("/", "--"))).size !== approval.paths.length
  ) {
    throw new Error("Approved gallery paths must have unique route identifiers");
  }
  const registry = registrySchema.parse(JSON.parse(registryBytes.toString()));
  const provenance = provenanceSchema.parse(JSON.parse(provenanceBytes.toString()));
  if (new Set(registry.map((record) => record.path)).size !== registry.length) {
    throw new Error("Duplicate primary registry path");
  }
  if (new Set(provenance.assets.map((record) => record.path)).size !== provenance.assets.length) {
    throw new Error("Duplicate primary asset provenance path");
  }
  return approval.paths.map((path) => {
    const reviewed = registry.find((record) => record.path === path);
    if (reviewed?.status !== "cleared" || !completedReview(reviewed.review)) {
      throw new Error(`Project has no completed primary rights review: ${path}`);
    }
    const visuals = provenance.assets.filter(
      (asset) => asset.path.startsWith(`${path}/`) && asset.path.endsWith("/original-visual.svg"),
    );
    if (new Set(visuals.map((candidate) => candidate.sha256)).size > 1) {
      throw new Error(`Multiple artwork candidates require manual selection: ${path}`);
    }
    const visual = visuals.sort(
      (left, right) => left.path.length - right.path.length || left.path.localeCompare(right.path),
    )[0];
    if (
      visuals.some(
        (record) =>
          record.kind !== "original" ||
          record.license !== "MIT" ||
          record.origin.trim().length < 20 ||
          typeof record.redistribution_permission !== "string" ||
          !/\boriginal\b/i.test(record.redistribution_permission) ||
          /\b(?:pending|unknown|uncertain|unverified)\b/i.test(record.redistribution_permission),
      )
    ) {
      throw new Error(
        `Artwork requires verified original authorship and MIT redistribution rights: ${path}`,
      );
    }
    if (
      visual &&
      (!/^[a-z0-9./-]+$/.test(visual.path) ||
        visual.path
          .split("/")
          .some((part) => !part || part === "." || part === ".." || part.startsWith(".")))
    ) {
      throw new Error(`Unsafe artwork source path: ${path}`);
    }
    return { path, review: reviewed.review, visual };
  });
}

function checkedSvg(bytes: Buffer, expected: string): void {
  if (sha256(bytes) !== expected) {
    throw new Error("Gallery artwork SHA-256 differs from its reviewed source record");
  }
  const text = bytes.toString();
  const tags = [...text.matchAll(/<\/?([a-z][\w:-]*)\b/gi)].map((match) =>
    (match[1] ?? "").toLowerCase(),
  );
  if (
    !text.trim().startsWith("<svg ") ||
    tags.some((tag) => !svgTags.has(tag)) ||
    /<!|\s(?:on[a-z]+|(?:xlink:)?href|src)\s*=|data:|url\(\s*["']?(?!#)[a-z/]/i.test(text) ||
    /https?:|\/\//i.test(text.replaceAll("http://www.w3.org/2000/svg", ""))
  ) {
    throw new Error("Gallery artwork must contain only reviewed self-contained SVG geometry");
  }
}

function catalogApproval(root: string) {
  return approvalSchema.parse(
    JSON.parse(readFileSync(join(root, dataPath, "approval.json"), "utf8")),
  );
}

function artworkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Gallery artwork cannot contain symlinks");
    }
    return entry.isDirectory() ? artworkFiles(path) : [path];
  });
}

export function readExperimentCatalog(root: string): z.infer<typeof experimentIndexSchema> {
  const approval = catalogApproval(root);
  const registryBytes = readFileSync(join(root, dataPath, "registry.json"));
  const provenanceBytes = readFileSync(join(root, dataPath, "provenance.json"));
  if (
    sha256(registryBytes) !== approval.registry_sha256 ||
    sha256(provenanceBytes) !== approval.provenance_sha256
  ) {
    throw new Error("Gallery rights snapshots changed without renewed review");
  }
  const reviewed = records(approval, registryBytes, provenanceBytes);
  const expected = new Set(["license.txt", "provenance.json"]);
  const projects = reviewed.map(({ path, visual }): ExperimentProject => {
    const name = path.replaceAll("/", "--");
    const group = path.split("/")[0] ?? "";
    const category = experimentCategories[group] ?? "UI experiments";
    const title = (path.split("/").at(-1) ?? "")
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    if (visual) {
      const file = `${name}/original-visual.svg`;
      expected.add(file);
      checkedSvg(readFileSync(join(root, assetPath, file)), visual.sha256);
    }
    return {
      path,
      name,
      title,
      category,
      group,
      summary: `A reviewed ${category.toLowerCase()} experiment.`,
      description: `${title}: a reviewed ${category.toLowerCase()} experiment with source and asset provenance. Open its current preview or source folder to explore the implementation.`,
      thumbnail: visual ? `/assets/experiment-artwork/${name}/original-visual.svg` : "",
      hue: Number.parseInt(sha256(path).slice(0, 8), 16) % 360,
      source: experimentSource(path),
      preview: experimentPreview(path),
    };
  });
  const actual = artworkFiles(join(root, assetPath)).map((path) =>
    relative(join(root, assetPath), path),
  );
  if (actual.length !== expected.size || actual.some((path) => !expected.has(path))) {
    throw new Error("Unverified or stale files exist in the gallery artwork directory");
  }
  const published = JSON.parse(readFileSync(join(root, assetPath, "provenance.json"), "utf8"));
  if (JSON.stringify(published) !== JSON.stringify(artworkManifest(approval, reviewed))) {
    throw new Error("Published gallery asset provenance differs from the reviewed records");
  }
  const license = readFileSync(join(root, assetPath, "license.txt"), "utf8");
  if (
    sha256(license) !== approval.license_sha256 ||
    !license.startsWith("MIT License\n") ||
    !license.includes("Copyright (c) 2026 Pulkit") ||
    !license.includes("The above copyright notice and this permission notice shall be included")
  ) {
    throw new Error("The gallery artwork MIT copyright and permission notice is missing");
  }
  return experimentIndexSchema.parse({ version: 1, revision: approval.revision, projects });
}

function artworkManifest(
  approval: z.infer<typeof approvalSchema>,
  reviewed: ReturnType<typeof records>,
) {
  return {
    version: 1,
    source_repository: approval.repository,
    source_revision: approval.revision,
    license_sha256: approval.license_sha256,
    assets: reviewed.flatMap(({ path, visual }) =>
      visual
        ? [
            {
              path: `${path.replaceAll("/", "--")}/original-visual.svg`,
              sha256: visual.sha256,
              origin: visual.origin,
              source_path: visual.path,
              source_url: `https://github.com/${approval.repository}/blob/${approval.revision}/${visual.path}`,
              license: "MIT",
              redistribution_permission:
                "MIT permits redistribution with the included copyright and permission notice",
            },
          ]
        : [],
    ),
  };
}

export function syncExperimentCatalog(source: string, root: string): void {
  const approval = catalogApproval(root);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const read = (path: string): Buffer =>
    execFileSync("git", ["-C", source, "show", `${approval.revision}:${path}`], {
      env,
      maxBuffer: 8 * 1024 * 1024,
    });
  const registryBytes = read("compliance/projects.json");
  const provenanceBytes = read("ASSET_PROVENANCE.json");
  const reviewed = records(approval, registryBytes, provenanceBytes);
  const files = new Map<string, Buffer>();
  for (const { path, visual } of reviewed) {
    if (visual) {
      const bytes = read(visual.path);
      checkedSvg(bytes, visual.sha256);
      files.set(`${path.replaceAll("/", "--")}/original-visual.svg`, bytes);
    }
  }
  const license = read("LICENSE");
  const next = {
    ...approval,
    registry_sha256: sha256(registryBytes),
    provenance_sha256: sha256(provenanceBytes),
    license_sha256: sha256(license),
  };
  files.set("license.txt", license);
  files.set(
    "provenance.json",
    Buffer.from(`${JSON.stringify(artworkManifest(next, reviewed), null, 2)}\n`),
  );
  if (existsSync(join(root, assetPath))) {
    const previous = z
      .object({
        assets: z.array(
          z.object({
            path: z.string().regex(/^[a-z0-9-]+\/original-visual\.svg$/),
            sha256: hashSchema,
          }),
        ),
      })
      .parse(JSON.parse(readFileSync(join(root, assetPath, "provenance.json"), "utf8")));
    const previousPaths = new Set([
      "license.txt",
      "provenance.json",
      ...previous.assets.map((asset) => asset.path),
    ]);
    const actual = artworkFiles(join(root, assetPath)).map((path) =>
      relative(join(root, assetPath), path),
    );
    if (actual.some((path) => !previousPaths.has(path))) {
      throw new Error(
        "Unknown files in the managed gallery artwork directory require manual review",
      );
    }
    for (const asset of previous.assets) {
      if (sha256(readFileSync(join(root, assetPath, asset.path))) !== asset.sha256) {
        throw new Error("Modified gallery artwork requires manual review before replacement");
      }
    }
    rmSync(join(root, assetPath), { recursive: true });
  }
  for (const [path, bytes] of files) {
    mkdirSync(dirname(join(root, assetPath, path)), { recursive: true });
    writeFileSync(join(root, assetPath, path), bytes);
  }
  writeFileSync(join(root, dataPath, "registry.json"), registryBytes);
  writeFileSync(join(root, dataPath, "provenance.json"), provenanceBytes);
  writeFileSync(join(root, dataPath, "approval.json"), `${JSON.stringify(next, null, 2)}\n`);
  readExperimentCatalog(root);
}

export async function verifyExperimentCatalogSource(
  root: string,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const approval = catalogApproval(root);
  readExperimentCatalog(root);
  const raw = `https://raw.githubusercontent.com/${approval.repository}/`;
  const requests = [
    [`${approval.revision}/compliance/projects.json`, approval.registry_sha256],
    [`${approval.revision}/ASSET_PROVENANCE.json`, approval.provenance_sha256],
    [`${approval.revision}/LICENSE`, approval.license_sha256],
  ];
  for (const [path, expected] of requests) {
    const response = await request(`${raw}${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok || sha256(new Uint8Array(await response.arrayBuffer())) !== expected) {
      throw new Error("The approved gallery snapshots do not match their primary source revision");
    }
  }
  const current = await Promise.all(
    ["compliance/projects.json", "ASSET_PROVENANCE.json"].map((path) =>
      request(`${raw}main/${path}`, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    ),
  );
  const [registry, provenance] = current;
  if (!registry?.ok || !provenance?.ok) {
    throw new Error("Current primary clearance could not be verified; stop for manual review");
  }
  try {
    const reviewed = records(
      approval,
      readFileSync(join(root, dataPath, "registry.json")),
      readFileSync(join(root, dataPath, "provenance.json")),
    );
    const latest = records(
      approval,
      Buffer.from(await registry.arrayBuffer()),
      Buffer.from(await provenance.arrayBuffer()),
    );
    for (const entry of reviewed) {
      const asset = latest.find((record) => record.path === entry.path)?.visual;
      if (
        entry.visual &&
        (asset?.path !== entry.visual.path || asset.sha256 !== entry.visual.sha256)
      ) {
        throw new Error("Previously approved artwork was removed or changed");
      }
    }
  } catch (cause) {
    throw new Error(
      "Primary clearance was withdrawn or artwork permission changed; stop for manual review",
      { cause },
    );
  }
}
