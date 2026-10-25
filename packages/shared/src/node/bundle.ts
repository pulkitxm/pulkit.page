interface BrowserBundle {
  entrypoints: string[];
  outdir: string;
  minify: boolean;
  label: string;
  plugins?: Bun.BunPlugin[];
}

export async function bundleBrowserScripts({
  entrypoints,
  outdir,
  minify,
  label,
  plugins,
}: BrowserBundle): Promise<void> {
  const result = await Bun.build({
    entrypoints,
    outdir,
    splitting: true,
    minify,
    format: "esm",
    target: "browser",
    plugins,
    naming: { entry: "[name].[ext]", chunk: "[name]-[hash].[ext]" },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, `Failed to bundle ${label}`);
  }
}
