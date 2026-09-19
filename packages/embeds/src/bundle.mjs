import { cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
  const result = await Bun.build({
    entrypoints,
    outdir,
    splitting: true,
    minify,
    format: "esm",
    target: "browser",
    naming: { entry: "[name].[ext]", chunk: "[name]-[hash].[ext]" },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Failed to bundle embed scripts");
  }
}

export async function buildEmbedAssets(outdir) {
  await bundleEmbedScripts(join(outdir, "embeds"));
  cpSync(photoswipeStyles, join(outdir, "embeds/photoswipe.css"));
  cpSync(join(katexDirectory, "katex.min.css"), join(outdir, "katex/katex.min.css"));
  cpSync(join(katexDirectory, "fonts"), join(outdir, "katex/fonts"), { recursive: true });
}
