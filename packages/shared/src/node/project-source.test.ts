import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { experimentRepository } from "../content/experiments.ts";
import { buildProjectSources } from "./project-source.ts";

const project = "hero-sections/mock-alpha";
const data = "apps/page/data/experiment-gallery";
const assets = "apps/page/assets/project-previews";
const name = "hero-sections--mock-alpha";
const revision = "a".repeat(40);
const tree = "b".repeat(40);
const currentRevision = "d".repeat(40);
function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), "fresh-gallery-"));
  const put = (path: string, content: unknown) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      Buffer.isBuffer(content) || typeof content === "string"
        ? content
        : `${JSON.stringify(content, null, 2)}\n`,
    );
  };
  const license = "MIT License\n\nCopyright (c) 2026 Synthetic Fixture\n";
  const source = ["<html><body>", "Synthetic fixture only", "</body></html>\n"].join("");
  const registry = [
    {
      path: project,
      status: "cleared",
      review:
        "Independent synthetic implementation with original markup reviewed for this isolated fixture.",
    },
  ];
  const provenance = { version: 1, assets: [], remote_dependencies: [] };
  const inline = {
    version: 1,
    files: [
      {
        path: `${project}/index.html`,
        sha256: hash(source),
        review:
          "Original isolated fixture source with self-contained markup was manually reviewed.",
      },
    ],
    licenses: [],
    notices: [],
  };
  for (const [path, value] of [
    ["registry.json", registry],
    ["provenance.json", provenance],
    ["inline-artwork.json", inline],
    ["source-license.txt", license],
  ] as const) {
    put(`${data}/${path}`, value);
  }
  const fileHash = (path: string) => hash(readFileSync(join(root, path)));
  const approval = {
    version: 1,
    repository: experimentRepository,
    revision,
    tree,
    paths: [project],
    registry_sha256: fileHash(`${data}/registry.json`),
    provenance_sha256: fileHash(`${data}/provenance.json`),
    inline_artwork_sha256: fileHash(`${data}/inline-artwork.json`),
    license_sha256: hash(license),
  };
  put(`${data}/approval.json`, approval);
  put(`${data}/descriptions.json`, {
    [project]: {
      title: "Mock alpha",
      summary: "A synthetic layout.",
      description: "Explore a synthetic layout with responsive controls.",
    },
  });
  const poster = Buffer.from(["RIFF", "1234", "WEBP", "fixture"].join(""));
  const video = Buffer.from(["1234", "ftyp", "fixture"].join(""));
  put(`${assets}/${name}/poster.webp`, poster);
  put(`${assets}/${name}/demo.mp4`, video);
  put(`${assets}/${name}/source-notices.txt`, license);
  const worker = "Synthetic recording worker recipe\n";
  const producer = "Synthetic source validator recipe\n";
  put(`${assets}/recipes/${hash(worker)}.txt`, worker);
  put(`${assets}/recipes/${hash(producer)}.txt`, producer);
  const capture = {
    version: 1,
    project,
    captured_at: "2026-11-11T00:00:00.000Z",
    source_mode: "pinned-local-build",
    source_repository: experimentRepository,
    source_revision: revision,
    reviewed_source_revision: revision,
    source_tree: tree,
    project_source_tree: "c".repeat(40),
    input_video_sha256: hash(video),
    observations_sha256: hash("Synthetic observations\n"),
    project_build_sha256: hash(`index.html\0${hash(source)}\n`),
    built_files: [{ path: "index.html", sha256: hash(source) }],
    capture_tool_sha256: hash(worker),
    capture_producer_sha256: hash(producer),
    command:
      "bun run gallery:record --site <verified-media-free-build> --out <fresh-staging-directory> --workers 3",
    viewport: { width: 1280, height: 800 },
    fps: 30,
    duration_seconds: 17.4,
    mode: "scroll-sequence",
    assets: {
      "poster.webp": { sha256: hash(poster), bytes: poster.length },
      "demo.mp4": { sha256: hash(video), bytes: video.length },
    },
    notices_sha256: hash(license),
    source_notices_sha256: hash(license),
    notices_normalization: "CRLF to LF line endings only; license and attribution text unchanged",
    software: {
      playwright: { version: "1.63.0", license: "Apache-2.0" },
      browser: {
        version: "fixture",
        terms: "https://www.google.com/chrome/terms/",
        redistributed: false,
      },
      sharp: {
        version: "fixture",
        license: "Apache-2.0",
        libvips: "fixture",
        webp: "fixture",
        redistributed: false,
      },
      ffmpeg: {
        version: "fixture",
        license: "GPL-3.0-or-later",
        license_url: "https://www.gnu.org/licenses/gpl-3.0.html",
        redistributed: false,
      },
    },
    runtime: {
      page_errors: [],
      failed_requests: [],
      blocked_external_requests: [],
      bad_responses: [],
      viewports: [
        { width: 1280, overflow: 0, nonzero_graphics: true },
        { width: 390, overflow: 0, nonzero_graphics: true },
      ],
    },
  };
  const manifest = {
    version: 1,
    source_repository: experimentRepository,
    source_revision: revision,
    source_tree: tree,
    input_verifier_sha256: hash(producer),
    input_verifier_source: `recipes/${hash(producer)}.txt`,
    finalizer_sha256: hash(producer),
    finalizer_source: `recipes/${hash(producer)}.txt`,
    recipes: [
      {
        worker_sha256: hash(worker),
        producer_sha256: hash(producer),
        worker_source: `recipes/${hash(worker)}.txt`,
        producer_source: `recipes/${hash(producer)}.txt`,
      },
    ],
    recordings: [capture],
  };
  put(`${assets}/provenance.json`, manifest);
  return { root, put, approval, manifest, capture, registry, inline, provenance, license };
}

test("checks current permissions before reading Git or writing any source output", async () => {
  const fixture = setup();
  const output = join(fixture.root, "build-output");
  const paths = new Map([
    ["compliance/projects.json", "registry.json"],
    ["ASSET_PROVENANCE.json", "provenance.json"],
    ["compliance/inline-artwork.json", "inline-artwork.json"],
    ["LICENSE", "source-license.txt"],
  ]);
  const requests: string[] = [];
  const request = (url: string): Promise<Response> => {
    requests.push(url);
    if (url === `https://api.github.com/repos/${experimentRepository}/commits/main`) {
      return Promise.resolve(Response.json({ sha: currentRevision }));
    }
    for (const [source, local] of paths) {
      if (url.endsWith(`/${source}`)) {
        if (source === "compliance/projects.json" && url.includes(`/${currentRevision}/`)) {
          return Promise.resolve(
            Response.json(fixture.registry.map((record) => ({ ...record, status: "pending" }))),
          );
        }
        return Promise.resolve(new Response(readFileSync(join(fixture.root, data, local))));
      }
    }
    throw new Error("Unexpected source request");
  };
  try {
    await expect(
      buildProjectSources(fixture.root, output, join(fixture.root, "missing-repository"), request),
    ).rejects.toThrow("Primary clearance was withdrawn");
    expect(requests).toHaveLength(9);
    expect(existsSync(output)).toBe(false);
    expect(existsSync(join(fixture.root, ".cache"))).toBe(false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
