import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface LicensePackage {
  name: string;
  directory: string;
  file: string;
  expected: string;
  version?: string;
}

const highlightingPackages = [
  ["@shikijs/core", "shiki", "LICENSE", "4.4.3"],
  ["@shikijs/primitive", "@shikijs/core", "LICENSE", "4.4.3"],
  ["@shikijs/types", "@shikijs/core", "LICENSE", "4.4.3"],
  ["@shikijs/vscode-textmate", "@shikijs/core", "LICENSE.md", "10.0.2"],
  ["@shikijs/langs", "shiki", "LICENSE", "4.4.3"],
  ["@shikijs/engine-javascript", "shiki", "LICENSE", "4.4.3"],
  ["oniguruma-to-es", "@shikijs/engine-javascript", "LICENSE", "4.3.6"],
  ["oniguruma-parser", "oniguruma-to-es", "LICENSE", "0.12.2"],
  ["regex", "oniguruma-to-es", "LICENSE", "6.1.0"],
  ["regex-recursion", "oniguruma-to-es", "LICENSE", "6.0.2"],
  ["regex-utilities", "regex", "LICENSE", "2.3.0"],
  ["hast-util-to-html", "@shikijs/core", "license", "9.0.5"],
  ["html-void-elements", "hast-util-to-html", "license", "3.0.0"],
  ["property-information", "hast-util-to-html", "license", "7.2.0"],
  ["zwitch", "hast-util-to-html", "license", "2.0.4"],
  ["stringify-entities", "hast-util-to-html", "license", "4.0.4"],
  ["character-entities-legacy", "stringify-entities", "license", "3.0.0"],
  ["character-entities-html4", "stringify-entities", "license", "2.1.0"],
  ["ccount", "hast-util-to-html", "license", "2.0.1"],
  ["comma-separated-tokens", "hast-util-to-html", "license", "2.0.3"],
  ["space-separated-tokens", "hast-util-to-html", "license", "2.0.2"],
  ["hast-util-whitespace", "hast-util-to-html", "license", "3.0.0"],
] as const;

function packageDirectory(name: string, parent: string): string {
  let directory = realpathSync(parent);
  for (;;) {
    const candidate = join(directory, "node_modules", name);
    const metadata = join(candidate, "package.json");
    if (existsSync(metadata) && JSON.parse(readFileSync(metadata, "utf8")).name === name) {
      return candidate;
    }
    const ancestor = dirname(directory);
    if (ancestor === directory) {
      throw new Error(`Gallery dependency package is missing: ${name}`);
    }
    directory = ancestor;
  }
}

export function galleryLicenses(): string {
  const dependencies = fileURLToPath(new URL("../node_modules/", import.meta.url));
  const engine = fileURLToPath(new URL("../../engine/node_modules/", import.meta.url));
  const shared = fileURLToPath(new URL("../../shared/node_modules/", import.meta.url));
  const packages: LicensePackage[] = [
    ["fuse.js", dependencies, "LICENSE", "Apache-2.0"],
    ["zod", shared, "LICENSE", "MIT"],
    ["lucide", engine, "LICENSE", "ISC"],
    ["@fortawesome/free-brands-svg-icons", dependencies, "LICENSE.txt", "(CC-BY-4.0 AND MIT)"],
    ["@fortawesome/free-solid-svg-icons", dependencies, "LICENSE.txt", "(CC-BY-4.0 AND MIT)"],
  ].map(([name = "", base = "", file = "", expected = ""]) => ({
    name,
    directory: join(base, name),
    file,
    expected,
  }));
  const shiki = join(dependencies, "shiki");
  const directories = new Map([["shiki", shiki]]);
  packages.push({
    name: "shiki",
    directory: shiki,
    file: "LICENSE",
    expected: "MIT",
    version: "4.4.3",
  });
  for (const [name, parent, file, version] of highlightingPackages) {
    const parentDirectory = directories.get(parent);
    if (!parentDirectory) {
      throw new Error(`Gallery dependency parent is missing: ${parent}`);
    }
    const directory = packageDirectory(name, parentDirectory);
    directories.set(name, directory);
    packages.push({ name, directory, file, expected: "MIT", version });
  }
  const notices = packages.map(({ name, directory, file, expected, version }) => {
    const metadata: { name?: unknown; version?: unknown; license?: unknown } = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
    if (
      metadata.name !== name ||
      typeof metadata.version !== "string" ||
      metadata.license !== expected ||
      (version && metadata.version !== version)
    ) {
      throw new Error(`Gallery dependency rights require renewed manual review: ${name}`);
    }
    const fullLicense = readFileSync(join(directory, file), "utf8");
    let license = fullLicense;
    if (name.startsWith("@fortawesome/")) {
      const fontSection = fullLicense.indexOf("# Fonts: SIL OFL 1.1 License");
      const codeSection = fullLicense.indexOf("# Code: MIT License", fontSection);
      if (fontSection < 0 || codeSection <= fontSection) {
        throw new Error("Font Awesome license sections require renewed manual review");
      }
      license = `${fullLicense.slice(0, fontSection)}Font-only OFL text omitted because no Font Awesome font files are distributed.\n\n${fullLicense.slice(codeSection)}`;
    }
    const header =
      name === "fuse.js"
        ? (readFileSync(join(directory, "dist/fuse.mjs"), "utf8")
            .split("*/", 1)[0]
            ?.replace(/^\/\*\*\s*|^\s*\* ?/gm, "")
            .trim() ?? "")
        : "";
    const digest = createHash("sha256").update(fullLicense).digest("hex");
    return `${name} ${metadata.version}\nSource: https://www.npmjs.com/package/${name}/v/${metadata.version}\nLicense: ${expected}\nUpstream license file SHA-256: ${digest}\n\n${header}\n\n${license}`;
  });
  return `${notices.join("\n\n================\n\n")}\n`;
}

export function writeGalleryLicenses(outdir: string): void {
  writeFileSync(join(outdir, "experiment-gallery-notices.txt"), galleryLicenses());
}
