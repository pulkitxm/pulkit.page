import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { experimentIndexSchema, experimentRepository } from "../content/experiments.ts";
import {
  readExperimentCatalog,
  removeRetiredGalleryArtwork,
  verifyExperimentCatalogSource,
} from "./experiment-catalog.ts";

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
    licenses: [{ path: "compliance/licenses/mock.txt", sha256: hash("Synthetic grant\n") }],
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
    implementation_files: [{ path: "index.html", sha256: hash(source) }],
    publication: {
      source_revision: revision,
      source_tree: tree,
      project_source_tree: "c".repeat(40),
      implementation_sha256: hash(`index.html\0${hash(source)}\n`),
      notices_sha256: hash(license),
      source_notices_sha256: hash(license),
      notices_normalization: "CRLF to LF line endings only; license and attribution text unchanged",
    },
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
    version: 2,
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
async function fixture(run: (value: ReturnType<typeof setup>) => void | Promise<void>) {
  const value = setup();
  try {
    await run(value);
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
}

test("publishes only complete fresh captures with useful descriptions and current source links", () =>
  fixture(({ root }) => {
    const catalog = readExperimentCatalog(root);
    expect(catalog.projects).toHaveLength(1);
    expect(catalog.projects[0]?.title).toBe("Mock alpha");
    expect(catalog.projects[0]?.thumbnail).toBe(`/assets/project-previews/${name}/poster.webp`);
    expect(catalog.projects[0]?.video).toBe(`/assets/project-previews/${name}/demo.mp4`);
    expect(catalog.projects[0]?.source).toBe(
      `https://github.com/${experimentRepository}/tree/main/${project}`,
    );
    expect(experimentIndexSchema.safeParse(catalog).success).toBe(true);
  }));
test("rejects changed media, notices, recipe source and unrecorded files", () =>
  fixture(({ root, put }) => {
    for (const file of [`${name}/poster.webp`, `${name}/demo.mp4`, `${name}/source-notices.txt`]) {
      const original = readFileSync(join(root, assets, file));
      put(`${assets}/${file}`, Buffer.concat([original, Buffer.from("changed")]));
      expect(() => readExperimentCatalog(root)).toThrow();
      put(`${assets}/${file}`, original);
    }
    const manifest = JSON.parse(readFileSync(join(root, assets, "provenance.json"), "utf8"));
    const recipe = manifest.recipes[0].worker_source;
    const saved = readFileSync(join(root, assets, recipe));
    put(`${assets}/${recipe}`, "Changed synthetic recipe\n");
    expect(() => readExperimentCatalog(root)).toThrow("recipe source differs");
    put(`${assets}/${recipe}`, saved);
    put(`${assets}/unrecorded.webp`, Buffer.from(["RIFF", "1234", "WEBP", "mock"].join("")));
    expect(() => readExperimentCatalog(root)).toThrow("Unverified or stale");
  }));
test("requires explicit approval, source identity and complete responsive runtime checks", () =>
  fixture(({ root, put, approval, manifest, capture }) => {
    for (const path of [
      "templates/premium/mock/vendor",
      "../mock",
      "hero-sections/mock/../other",
    ]) {
      put(`${data}/approval.json`, { ...approval, paths: [path] });
      expect(() => readExperimentCatalog(root)).toThrow();
    }
    put(`${data}/approval.json`, { ...approval, paths: [project, project] });
    expect(() => readExperimentCatalog(root)).toThrow("Duplicate approved");
    put(`${data}/approval.json`, approval);
    for (const recordings of [
      [],
      [capture, capture],
      [{ ...capture, publication: { ...capture.publication, source_revision: "d".repeat(40) } }],
      [{ ...capture, implementation_files: [{ path: "index.html", sha256: "a".repeat(64) }] }],
      [{ ...capture, implementation_files: [{ path: "README.md", sha256: "a".repeat(64) }] }],
      [{ ...capture, implementation_files: [{ path: "../index.html", sha256: "a".repeat(64) }] }],
      [
        {
          ...capture,
          implementation_files: [...capture.implementation_files, ...capture.implementation_files],
        },
      ],
      [{ ...capture, built_files: [{ path: "../index.html", sha256: "a".repeat(64) }] }],
      [{ ...capture, runtime: { ...capture.runtime, page_errors: ["mock failure"] } }],
      [
        {
          ...capture,
          runtime: {
            ...capture.runtime,
            viewports: [capture.runtime.viewports[0], capture.runtime.viewports[0]],
          },
        },
      ],
    ]) {
      put(`${assets}/provenance.json`, { ...manifest, recordings });
      expect(() => readExperimentCatalog(root)).toThrow();
    }
  }));
test("retains original capture facts when current source notices are updated", () =>
  fixture(({ root, put, capture, manifest, license }) => {
    const notices = `${license}\nCurrent synthetic package notice\n`;
    const publication = {
      ...capture.publication,
      project_source_tree: "e".repeat(40),
      notices_sha256: hash(notices),
      source_notices_sha256: hash(notices),
    };
    const record = { ...capture, source_revision: "f".repeat(40), publication };
    put(`${assets}/${name}/source-notices.txt`, notices);
    put(`${assets}/provenance.json`, { ...manifest, recordings: [record] });
    expect(readExperimentCatalog(root).projects).toHaveLength(1);
    const saved = JSON.parse(readFileSync(join(root, assets, "provenance.json"), "utf8"))
      .recordings[0];
    expect(saved.captured_at).toBe(capture.captured_at);
    expect(saved.notices_sha256).toBe(capture.notices_sha256);
    expect(saved.source_notices_sha256).toBe(capture.source_notices_sha256);
    expect(saved.built_files).toEqual(capture.built_files);
    expect(saved.assets).toEqual(capture.assets);
    put(`${assets}/provenance.json`, {
      ...manifest,
      recordings: [
        { ...record, publication: { ...publication, notices_sha256: capture.notices_sha256 } },
      ],
    });
    expect(() => readExperimentCatalog(root)).toThrow("notices are missing or changed");
  }));
test("rejects old artwork, external media and incomplete descriptions", () =>
  fixture(({ root, put }) => {
    const catalog = readExperimentCatalog(root);
    const first = catalog.projects[0];
    for (const thumbnail of [
      "https://example.test/poster.webp",
      "/assets/experiment-artwork/mock/original-visual.svg",
      "/assets/project-previews/mock/poster.webp",
    ]) {
      expect(
        experimentIndexSchema.safeParse({ ...catalog, projects: [{ ...first, thumbnail }] })
          .success,
      ).toBe(false);
    }
    put(`${data}/descriptions.json`, {});
    expect(() => readExperimentCatalog(root)).toThrow("descriptions");
  }));
test("checks pinned source snapshots and current rights revocation without accepting network failures", () =>
  fixture(async ({ root, registry, inline, provenance, license }) => {
    const response = (url: string) => {
      if (url.startsWith("https://api.github.com/")) {
        return Response.json({ sha: currentRevision });
      }
      if (url.includes("/main/")) {
        throw new Error("Mutable raw branch aliases must not be trusted");
      }
      if (url.endsWith("/LICENSE")) {
        return new Response(license);
      }
      const choices: Record<string, string> = {
        "ASSET_PROVENANCE.json": "provenance.json",
        "inline-artwork.json": "inline-artwork.json",
      };
      const path = choices[url.split("/").at(-1) ?? ""] ?? "registry.json";
      return new Response(readFileSync(join(root, data, path)));
    };
    await verifyExperimentCatalogSource(root, (url) => Promise.resolve(response(url)));
    await expect(
      verifyExperimentCatalogSource(root, (url) =>
        Promise.resolve(
          url.startsWith("https://api.github.com/")
            ? new Response("Denied", { status: 403 })
            : response(url),
        ),
      ),
    ).rejects.toThrow("revision could not be verified");
    for (const [path, body] of [
      ["compliance/projects.json", registry.map((record) => ({ ...record, status: "pending" }))],
      ["ASSET_PROVENANCE.json", { ...provenance, assets: [{}] }],
      ["compliance/inline-artwork.json", { ...inline, files: [] }],
      ["compliance/inline-artwork.json", { ...inline, licenses: [] }],
      [
        "compliance/inline-artwork.json",
        {
          ...inline,
          licenses: inline.licenses.map((file) => ({ ...file, sha256: "d".repeat(64) })),
        },
      ],
      [
        "compliance/inline-artwork.json",
        { ...inline, files: inline.files.map((file) => ({ ...file, sha256: "d".repeat(64) })) },
      ],
      ["LICENSE", `${license}changed`],
    ] as const) {
      await expect(
        verifyExperimentCatalogSource(root, (url) => {
          if (!url.endsWith(`/${currentRevision}/${path}`)) {
            return Promise.resolve(response(url));
          }
          return Promise.resolve(
            typeof body === "string" ? new Response(body) : Response.json(body),
          );
        }),
      ).rejects.toThrow("source approval");
    }
    await expect(
      verifyExperimentCatalogSource(root, () =>
        Promise.resolve(new Response("Denied", { status: 403 })),
      ),
    ).rejects.toThrow("do not match");
  }));

test("preserves unknown or modified retired artwork until manual review", () =>
  fixture(({ root, put }) => {
    const directory = "apps/page/assets/experiment-artwork";
    const license = "Synthetic copyright notice\n";
    const content = "Synthetic original geometry\n";
    const path = "mock/original-visual.svg";
    put(`${directory}/license.txt`, license);
    put(`${directory}/${path}`, content);
    put(`${directory}/provenance.json`, {
      license_sha256: hash(license),
      assets: [{ path, sha256: hash(content) }],
    });
    put(`${directory}/unrelated.txt`, "Independent fixture material\n");
    expect(() => removeRetiredGalleryArtwork(root)).toThrow("require manual review");
    expect(existsSync(join(root, directory, "unrelated.txt"))).toBe(true);
    rmSync(join(root, directory, "unrelated.txt"));
    put(`${directory}/${path}`, `${content}changed`);
    expect(() => removeRetiredGalleryArtwork(root)).toThrow("artwork changed");
    put(`${directory}/${path}`, content);
    removeRetiredGalleryArtwork(root);
    expect(existsSync(join(root, directory))).toBe(false);
  }));
