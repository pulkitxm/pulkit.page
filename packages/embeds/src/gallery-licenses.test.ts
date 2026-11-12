import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { galleryLicenses } from "./gallery-licenses.ts";

test("gallery notices retain applicable license and attribution terms without unused font text", () => {
  const notices = galleryLicenses();
  for (const required of [
    "fuse.js 7.5.0",
    "Apache License",
    "zod 4.6.7",
    "lucide 1.49.0",
    "Feather",
    "# Icons: CC BY 4.0 License",
    "# Code: MIT License",
    "Copyright 2026 Fonticons, Inc.",
    "# Attribution",
    "# Brand Icons",
    "Font-only OFL text omitted because no Font Awesome font files are distributed.",
    "Upstream license file SHA-256:",
  ]) {
    expect(notices).toContain(required);
  }
  expect(notices).not.toContain("# Fonts: SIL OFL 1.1 License");
  expect([...notices].some((character) => character.codePointAt(0) === 8212)).toBe(false);
});

test("retains every actual syntax-highlighter runtime dependency license in full", async () => {
  const result = await Bun.build({
    entrypoints: [
      fileURLToPath(new URL("../client/components/project-code-workspace.ts", import.meta.url)),
    ],
    target: "browser",
    splitting: true,
    minify: true,
    metafile: true,
  });
  if (!result.success || !result.metafile) {
    throw new AggregateError(result.logs, "Source workspace dependency inspection failed");
  }
  const packages = new Map<string, string>();
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [path, input] of Object.entries(output.inputs)) {
      if (input.bytesInOutput === 0) {
        continue;
      }
      const match = path.match(
        /^(.*?node_modules\/\.bun\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+))(?:\/|$)/,
      );
      const [, directory, name] = match ?? [];
      if (directory && name) {
        packages.set(name, directory);
      }
    }
  }
  const notices = galleryLicenses();
  expect(packages.size).toBeGreaterThan(20);
  for (const [name, directory] of packages) {
    const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    expect(notices).toContain(`${name} ${metadata.version}\n`);
    if (!name.startsWith("@fortawesome/")) {
      const path = ["LICENSE", "LICENSE.md", "license"]
        .map((filename) => join(directory, filename))
        .find((filename) => existsSync(filename));
      if (!path) {
        throw new Error(`Bundled gallery license file is missing: ${name}`);
      }
      const license = readFileSync(path, "utf8");
      expect(notices).toContain(license);
    }
  }
  expect(notices).toContain("shiki 4.4.3\n");
  expect(notices).toContain("Copyright (c) Microsoft Corporation");
  expect(packages.has("@shikijs/engine-oniguruma")).toBe(false);
  expect(packages.has("@shikijs/themes")).toBe(false);
});
