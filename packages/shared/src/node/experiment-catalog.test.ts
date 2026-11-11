import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { experimentIndexSchema, experimentRepository } from "../content/experiments.ts";
import {
  readExperimentCatalog,
  syncExperimentCatalog,
  verifyExperimentCatalogSource,
} from "./experiment-catalog.ts";

const project = "hero-sections/mock-alpha";
const visual = `${project}/original-visual.svg`;
const geometry =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>\n';
const license =
  "MIT License\n\nCopyright (c) 2026 Pulkit\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n";
const data = "apps/page/data/experiment-gallery";
const assets = "apps/page/assets/experiment-artwork";

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function fixture(run: (value: ReturnType<typeof setup>) => void | Promise<void>): Promise<void> {
  const value = setup();
  return Promise.resolve()
    .then(() => run(value))
    .finally(() => {
      rmSync(value.root, { recursive: true, force: true });
      rmSync(value.source, { recursive: true, force: true });
    });
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "reviewed-gallery-"));
  const source = mkdtempSync(join(tmpdir(), "reviewed-source-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const put = (base: string, path: string, content: unknown) => {
    mkdirSync(dirname(join(base, path)), { recursive: true });
    writeFileSync(
      join(base, path),
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    );
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: source, env, encoding: "utf8" }).trim();
  const registry = [project, "ui-design/mock-beta"].map((path) => ({
    path,
    status: "cleared",
    review:
      "Independent synthetic implementation and original artwork reviewed for this isolated fixture.",
  }));
  const provenance = {
    version: 1,
    assets: [
      {
        path: visual,
        sha256: hash(geometry),
        origin: "Original synthetic geometric composition created for this fixture",
        kind: "original",
        license: "MIT",
        redistribution_permission: "Original work created for this synthetic fixture",
      },
    ],
  };
  put(source, "compliance/projects.json", registry);
  put(source, "ASSET_PROVENANCE.json", provenance);
  put(source, "LICENSE", license);
  put(source, visual, geometry);
  git("init", "--quiet");
  const commit = () => {
    git("add", "--all");
    git(
      "-c",
      "user.name=Synthetic fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--message",
      "Synthetic fixture",
    );
    return git("rev-parse", "HEAD");
  };
  const approval = {
    version: 1,
    repository: experimentRepository,
    revision: commit(),
    paths: [project],
    registry_sha256: "0".repeat(64),
    provenance_sha256: "0".repeat(64),
    license_sha256: "0".repeat(64),
  };
  put(root, `${data}/approval.json`, approval);
  syncExperimentCatalog(source, root);
  return { root, source, put, git, commit, registry, provenance, approval };
}

test("imports only the explicit approved subset with unchanged licensed artwork", () =>
  fixture(({ root }) => {
    const catalog = readExperimentCatalog(root);
    expect(catalog.projects).toHaveLength(1);
    expect(catalog.projects[0]?.path).toBe(project);
    expect(catalog.projects[0]?.name).toBe("hero-sections--mock-alpha");
    expect(catalog.projects[0]?.source).toBe(
      `https://github.com/${experimentRepository}/tree/main/${project}`,
    );
    expect(catalog.projects[0]?.preview).toBe(`https://claude-directory.pulkitxm.com/${project}/`);
    expect(
      readFileSync(join(root, assets, "hero-sections--mock-alpha/original-visual.svg"), "utf8"),
    ).toBe(geometry);
    expect(readFileSync(join(root, assets, "license.txt"), "utf8")).toBe(license);
  }));

test("rejects premium, capture, traversal, duplicated and uncleared approvals", () =>
  fixture(({ root, source, put, approval }) => {
    for (const path of [
      "templates/premium/vendor/mock",
      "hero-sections/.reference/mock",
      "../mock",
      "hero-sections/mock/../other",
      "https://example.test/mock",
    ]) {
      put(root, `${data}/approval.json`, { ...approval, paths: [path] });
      expect(() => syncExperimentCatalog(source, root)).toThrow();
    }
    put(root, `${data}/approval.json`, { ...approval, paths: [project, project] });
    expect(() => syncExperimentCatalog(source, root)).toThrow("Duplicate approved");
    put(root, `${data}/approval.json`, { ...approval, paths: ["hero-sections/unreviewed"] });
    expect(() => syncExperimentCatalog(source, root)).toThrow("no completed primary rights review");
  }));

test("requires renewed review for changed artwork, source metadata and notices", () =>
  fixture(({ root, put }) => {
    put(root, `${assets}/hero-sections--mock-alpha/original-visual.svg`, `${geometry} `);
    expect(() => readExperimentCatalog(root)).toThrow("SHA-256");
    put(root, `${assets}/hero-sections--mock-alpha/original-visual.svg`, geometry);
    put(root, `${assets}/license.txt`, `${license} `);
    expect(() => readExperimentCatalog(root)).toThrow("notice is missing");
    put(root, `${assets}/license.txt`, license);
    put(root, `${data}/registry.json`, []);
    expect(() => readExperimentCatalog(root)).toThrow("snapshots changed");
  }));

test("does not overwrite unknown files or locally modified artwork during synchronization", () =>
  fixture(({ root, source, put }) => {
    put(root, `${assets}/unverified.svg`, geometry);
    expect(() => readExperimentCatalog(root)).toThrow("Unverified or stale");
    expect(() => syncExperimentCatalog(source, root)).toThrow("Unknown files");
    expect(readFileSync(join(root, assets, "unverified.svg"), "utf8")).toBe(geometry);
    rmSync(join(root, assets, "unverified.svg"));
    put(root, `${assets}/hero-sections--mock-alpha/original-visual.svg`, "Local independent work");
    expect(() => syncExperimentCatalog(source, root)).toThrow("Modified gallery artwork");
  }));

test("rejects embedded images and scripts even with matching provenance hashes", () =>
  fixture(({ root, source, put, approval, provenance, commit }) => {
    for (const body of [
      '<image href="data:image/png;base64,c3ludGhldGlj"/>',
      "<script>x</script>",
    ]) {
      const content = `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
      put(source, visual, content);
      put(source, "ASSET_PROVENANCE.json", {
        ...provenance,
        assets: [{ ...provenance.assets[0], sha256: hash(content) }],
      });
      put(root, `${data}/approval.json`, { ...approval, revision: commit() });
      expect(() => syncExperimentCatalog(source, root)).toThrow("self-contained SVG geometry");
      expect(
        readFileSync(join(root, assets, "hero-sections--mock-alpha/original-visual.svg"), "utf8"),
      ).toBe(geometry);
    }
  }));

test("checks pinned upstream bytes and fails when current primary clearance is revoked", () =>
  fixture(async ({ root, source, registry }) => {
    const pinned = (url: string): Response => {
      if (url.endsWith("/LICENSE")) {
        return new Response(license);
      }
      if (url.endsWith("/ASSET_PROVENANCE.json")) {
        return new Response(readFileSync(join(source, "ASSET_PROVENANCE.json")));
      }
      return new Response(readFileSync(join(source, "compliance/projects.json")));
    };
    await verifyExperimentCatalogSource(root, (url) => Promise.resolve(pinned(url)));
    await expect(
      verifyExperimentCatalogSource(root, (url) =>
        Promise.resolve(
          url.includes("/main/")
            ? Response.json(registry.map((record) => ({ ...record, status: "pending" })))
            : pinned(url),
        ),
      ),
    ).rejects.toThrow("clearance was withdrawn");
    await expect(
      verifyExperimentCatalogSource(root, () =>
        Promise.resolve(new Response("Denied", { status: 403 })),
      ),
    ).rejects.toThrow("do not match");
  }));

test("an approved project without a suitable image uses original CSS artwork", () =>
  fixture(({ root, source, put, approval }) => {
    put(root, `${data}/approval.json`, { ...approval, paths: [project, "ui-design/mock-beta"] });
    syncExperimentCatalog(source, root);
    const catalog = readExperimentCatalog(root);
    expect(catalog.projects).toHaveLength(2);
    expect(catalog.projects[1]?.thumbnail).toBe("");
    expect(catalog.projects[1]?.hue).toBeGreaterThanOrEqual(0);
    expect(catalog.projects[1]?.hue).toBeLessThan(360);
  }));

test("the browser index rejects legacy arrays, unverified media and historical source links", () =>
  fixture(({ root }) => {
    const catalog = readExperimentCatalog(root);
    expect(experimentIndexSchema.safeParse(catalog).success).toBe(true);
    expect(experimentIndexSchema.safeParse(catalog.projects).success).toBe(false);
    const entry = catalog.projects[0];
    expect(
      experimentIndexSchema.safeParse({
        ...catalog,
        projects: [{ ...entry, thumbnail: "https://example.test/poster.jpg" }],
      }).success,
    ).toBe(false);
    expect(
      experimentIndexSchema.safeParse({
        ...catalog,
        projects: [
          { ...entry, source: `https://github.com/${experimentRepository}/tree/old/${project}` },
        ],
      }).success,
    ).toBe(false);
  }));
