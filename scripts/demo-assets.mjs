import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const tailwind = fileURLToPath(
  new URL("dist/index.mjs", import.meta.resolve("@tailwindcss/cli/package.json")),
);
const fonts = fileURLToPath(
  new URL("files/", import.meta.resolve("@fontsource/poppins/package.json")),
);
const weights = [400, 500, 600, 700];

const placeholders = `demo-showcase{display:block;margin-block:1.5rem}
:root{--site-bg:var(--color-bg);--site-fg:var(--color-fg);--site-surface:var(--color-surface);--site-line:var(--color-line);--site-muted:var(--color-muted);--site-font-mono:var(--font-mono);--site-syn-k:var(--color-syn-k);--site-syn-s:var(--color-syn-s);--site-syn-c:var(--color-syn-c);--site-syn-n:var(--color-syn-n);--site-syn-f:var(--color-syn-f);--site-syn-t:var(--color-syn-t);--site-syn-p:var(--color-syn-p);--site-syn-o:var(--color-syn-o);--site-syn-u:var(--color-syn-u);--site-syn-g:var(--color-syn-g)}
demo-showcase:not([data-ready]){height:calc(20rem + 2px)}
demo-showcase:not([data-ready])[data-files]{height:calc(23.5rem + 3px)}
@media (min-width:640px){demo-showcase:not([data-ready]){height:calc(24rem + 2px)}demo-showcase:not([data-ready])[data-height=bigger]{height:calc(25.5rem + 2px)}demo-showcase:not([data-ready])[data-files]{height:calc(27.5rem + 3px)}}
@media (min-width:1024px){demo-showcase:not([data-ready]),demo-showcase:not([data-ready])[data-files]{height:calc(28rem + 2px)}demo-showcase:not([data-ready])[data-height=bigger]{height:calc(32rem + 2px)}}
demo-showcase:not([data-ready])[data-height=full]{height:calc(min(92svh,52rem) + 2px)}`;

function fontFaces() {
  return weights
    .map(
      (weight) =>
        `@font-face{font-family:"Poppins";font-style:normal;font-display:swap;font-weight:${weight};src:url(poppins-${weight}.woff2) format("woff2")}`,
    )
    .join("\n");
}

export function compileDemoStyles({ minify = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "demo-styles-"));
  try {
    const output = join(directory, "demos.css");
    execFileSync(
      process.execPath,
      [
        tailwind,
        "--input",
        "demos/styles.css",
        "--output",
        output,
        ...(minify ? ["--minify"] : []),
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    const css = readFileSync(output, "utf8");
    const properties = css.match(/@property\s+[^{]+\{[^}]*\}/g) ?? [];
    return {
      shadow: properties.reduce((result, rule) => result.replace(rule, ""), css),
      document: `${properties.join("\n")}\n${fontFaces()}\n${placeholders}\n`,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

export async function bundleDemoScripts(outdir, { minify = true } = {}) {
  const result = await Bun.build({
    entrypoints: ["demos/index.js"],
    outdir,
    splitting: true,
    minify,
    format: "esm",
    target: "browser",
    naming: { entry: "[name].[ext]", chunk: "[name]-[hash].[ext]" },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Failed to bundle demo scripts");
  }
}

export function fontFile(name) {
  const match = /^poppins-(\d{3})\.woff2$/.exec(name);
  return match && weights.includes(Number(match[1]))
    ? join(fonts, `poppins-latin-${match[1]}-normal.woff2`)
    : undefined;
}

export async function buildDemoAssets(outdir) {
  mkdirSync(outdir, { recursive: true });
  const styles = compileDemoStyles();
  writeFileSync(join(outdir, "demos.css"), styles.shadow);
  writeFileSync(join(outdir, "document.css"), styles.document);
  for (const weight of weights) {
    copyFileSync(fontFile(`poppins-${weight}.woff2`), join(outdir, `poppins-${weight}.woff2`));
  }
  await bundleDemoScripts(outdir);
}
