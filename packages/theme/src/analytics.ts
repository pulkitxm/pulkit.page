import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";
import { minify as compress } from "terser";

interface BundleOptions {
  minify?: boolean;
}

export async function bundleAnalyticsScript(
  outdir: string,
  { minify = true }: BundleOptions = {},
): Promise<void> {
  await bundleBrowserScripts({
    entrypoints: [fileURLToPath(new URL("client/analytics.ts", import.meta.url))],
    outdir,
    minify,
    label: "analytics script",
  });
  if (minify) {
    const file = join(outdir, "analytics.js");
    const result = await compress(await readFile(file, "utf8"), {
      module: true,
      compress: { passes: 3 },
      mangle: true,
      format: { comments: "some" },
    });
    if (!result.code) {
      throw new Error("Failed to compress analytics script");
    }
    await writeFile(file, result.code);
  }
}
