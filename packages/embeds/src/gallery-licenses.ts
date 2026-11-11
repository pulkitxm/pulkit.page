import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function galleryLicenses(): string {
  const dependencies = fileURLToPath(new URL("../node_modules/", import.meta.url));
  const engine = fileURLToPath(new URL("../../engine/node_modules/", import.meta.url));
  const shared = fileURLToPath(new URL("../../shared/node_modules/", import.meta.url));
  const packages = [
    ["fuse.js", dependencies, "LICENSE", "Apache-2.0"],
    ["zod", shared, "LICENSE", "MIT"],
    ["lucide", engine, "LICENSE", "ISC"],
    ["@fortawesome/free-brands-svg-icons", dependencies, "LICENSE.txt", "(CC-BY-4.0 AND MIT)"],
    ["@fortawesome/free-solid-svg-icons", dependencies, "LICENSE.txt", "(CC-BY-4.0 AND MIT)"],
  ];
  const notices = packages.map(([name = "", base = "", file = "", expected = ""]) => {
    const directory = join(base, name);
    const metadata: { name?: unknown; version?: unknown; license?: unknown } = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
    if (
      metadata.name !== name ||
      typeof metadata.version !== "string" ||
      metadata.license !== expected
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
