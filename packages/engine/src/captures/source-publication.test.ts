import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { sameImplementation } from "./notice-publication.ts";
import {
  implementationFiles,
  publicationRepository,
  sourceFile,
  sourceTree,
} from "./source-publication.ts";

test("source fingerprints permit notice and Markdown changes while rejecting runtime changes", () => {
  const root = mkdtempSync(join(tmpdir(), "project-source-fixture-"));
  const project = "hero-sections/mock-alpha";
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const tree = () => {
    git("add", ".");
    return git("write-tree");
  };
  const put = (path: string, content: string) => writeFileSync(join(root, project, path), content);
  try {
    git("init", "--quiet");
    mkdirSync(join(root, project), { recursive: true });
    put("index.html", "Synthetic markup\n");
    put("main.js", "export const value = 1;\n");
    put("README.md", "Synthetic guide\n");
    put("THIRD_PARTY_NOTICES.txt", "Synthetic package notice\n");
    const captured = tree();
    const files = implementationFiles(root, captured, project);
    expect(files.map((file) => file.path)).toEqual(["index.html", "main.js"]);
    put("README.md", "Current guide\n");
    put("THIRD_PARTY_NOTICES.txt", "Current package notice\n");
    const current = tree();
    expect(sourceTree(root, captured, project)).not.toBe(sourceTree(root, current, project));
    expect(implementationFiles(root, current, project)).toEqual(files);
    expect(sameImplementation(files, implementationFiles(root, current, project))).toMatch(
      /^[a-f0-9]{64}$/,
    );
    put("main.js", "export const value = 2;\n");
    expect(() => sameImplementation(files, implementationFiles(root, tree(), project))).toThrow(
      "differs",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("publication renewal resolves its previous revision across independent source stores", () => {
  const root = mkdtempSync(join(tmpdir(), "publication-stores-fixture-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const stores = [join(root, "captured"), join(root, "published")];
  const git = (source: string, ...args: string[]) =>
    execFileSync("git", ["-C", source, ...args], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    const revisions = stores.map((source, index) => {
      mkdirSync(source);
      git(source, "init", "--quiet");
      writeFileSync(join(source, "LICENSE"), `Synthetic license scope ${index}\n`);
      git(source, "add", ".");
      return git(
        source,
        "-c",
        "user.name=Synthetic Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit-tree",
        git(source, "write-tree"),
        "-m",
        "Synthetic source store fixture",
      );
    });
    const captured = revisions[0] ?? "";
    const published = revisions[1] ?? "";
    expect(publicationRepository(published, stores)).toBe(stores[1] ?? "");
    expect(publicationRepository(captured, [...stores].reverse())).toBe(stores[0] ?? "");
    expect(
      sourceFile(publicationRepository(published, stores), published, "LICENSE").toString(),
    ).toBe("Synthetic license scope 1\n");
    expect(() => publicationRepository("f".repeat(40), stores)).toThrow("unavailable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
