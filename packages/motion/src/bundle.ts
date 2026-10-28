import { fileURLToPath } from "node:url";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";

interface BundleOptions {
  minify?: boolean;
}

export async function bundleMotionScripts(
  outdir: string,
  { minify = true }: BundleOptions = {},
): Promise<void> {
  await bundleBrowserScripts({
    entrypoints: [fileURLToPath(new URL("../client/index.ts", import.meta.url))],
    outdir,
    minify,
    label: "motion scripts",
  });
}
