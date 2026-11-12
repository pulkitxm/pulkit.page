import { basename, extname } from "node:path";

interface BrowserBundle {
  entrypoints: string[];
  outdir: string;
  minify: boolean;
  label: string;
  fingerprint?: boolean;
}

export async function bundleBrowserScripts({
  entrypoints,
  outdir,
  minify,
  label,
  fingerprint = false,
}: BrowserBundle): Promise<Map<string, string>> {
  if (fingerprint && entrypoints.length !== 1) {
    throw new Error("Fingerprinted browser bundles require one entry point");
  }
  const result = await Bun.build({
    entrypoints,
    outdir,
    splitting: true,
    minify,
    format: "esm",
    target: "browser",
    naming: {
      entry: fingerprint ? "[name]-[hash].[ext]" : "[name].[ext]",
      chunk: "[name]-[hash].[ext]",
    },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, `Failed to bundle ${label}`);
  }
  const entries = new Map<string, string>();
  if (fingerprint) {
    const source = entrypoints[0];
    const output = result.outputs.find((artifact) => artifact.kind === "entry-point");
    if (!source || !output) {
      throw new Error("Fingerprinted browser entry is missing from its build");
    }
    entries.set(`${basename(source, extname(source))}.js`, basename(output.path));
  }
  return entries;
}
