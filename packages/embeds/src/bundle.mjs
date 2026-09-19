import { cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";

export const photoswipeStyles = fileURLToPath(
  new URL("dist/photoswipe.css", import.meta.resolve("photoswipe/package.json")),
);
export const katexDirectory = fileURLToPath(
  new URL("dist", import.meta.resolve("katex/package.json")),
);

export async function bundleEmbedScripts(outdir, { minify = true } = {}) {
  const client = fileURLToPath(new URL("../client/", import.meta.url));
  const entrypoints = readdirSync(client)
    .filter((file) => file.endsWith(".js"))
    .map((file) => join(client, file));
  await bundleBrowserScripts({ entrypoints, outdir, minify, label: "embed scripts" });
}

export async function buildEmbedAssets(outdir) {
  await bundleEmbedScripts(join(outdir, "embeds"));
  cpSync(photoswipeStyles, join(outdir, "embeds/photoswipe.css"));
  cpSync(join(katexDirectory, "katex.min.css"), join(outdir, "katex/katex.min.css"));
  cpSync(join(katexDirectory, "fonts"), join(outdir, "katex/fonts"), { recursive: true });
}
