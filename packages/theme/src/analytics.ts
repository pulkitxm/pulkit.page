import { fileURLToPath } from "node:url";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";

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
}
