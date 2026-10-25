import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";
import { compileTailwind } from "@pulkit/shared/tailwind";
import { twMerge } from "tailwind-merge";

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

function fontFaces(): string {
  return weights
    .map(
      (weight) =>
        `@font-face{font-family:"Poppins";font-style:normal;font-display:swap;font-weight:${weight};src:url(/assets/demos/poppins-${weight}.woff2) format("woff2")}`,
    )
    .join("\n");
}

interface DemoStyles {
  shadow: string;
  document: string;
}

interface BuildOptions {
  minify?: boolean;
  plugins?: Bun.BunPlugin[];
}

export function compileDemoStyles({ minify = true }: BuildOptions = {}): DemoStyles {
  const directory = mkdtempSync(join(tmpdir(), "demo-styles-"));
  try {
    const output = join(directory, "demos.css");
    compileTailwind({
      input: fileURLToPath(new URL("../styles.css", import.meta.url)),
      output,
      minify,
    });
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

export async function bundleDemoScripts(
  outdir: string,
  { minify = true, plugins }: BuildOptions = {},
): Promise<void> {
  await bundleBrowserScripts({
    entrypoints: [fileURLToPath(new URL("../client/index.ts", import.meta.url))],
    outdir,
    minify,
    label: "demo scripts",
    plugins,
  });
}

export function fontFile(name: string): string | undefined {
  const weight = /^poppins-(\d{3})\.woff2$/.exec(name)?.[1];
  return weight !== undefined && weights.includes(Number(weight))
    ? join(fonts, `poppins-latin-${weight}-normal.woff2`)
    : undefined;
}

export function buildDemoStyles(outdir: string): void {
  mkdirSync(outdir, { recursive: true });
  const styles = compileDemoStyles();
  writeFileSync(join(outdir, "demos.css"), styles.shadow);
  writeFileSync(join(outdir, "document.css"), styles.document);
  for (const weight of weights) {
    const source = fontFile(`poppins-${weight}.woff2`);
    if (source !== undefined) {
      copyFileSync(source, join(outdir, `poppins-${weight}.woff2`));
    }
  }
}

export function compiledClassMerge(
  names: ReadonlyMap<string, string>,
  combinations: ReadonlyMap<string, readonly string[]>,
): string {
  const entries = [...names].filter(([name]) => twMerge(`${name} ${name}`) === name);
  const groups: Record<string, number> = {};
  const conflicts: string[][] = [];
  const indexes = new Map<string, number>();
  for (const [later, alias] of entries) {
    const removed = entries
      .filter(([earlier]) => twMerge(`${earlier} ${later}`) === later)
      .map(([, earlierAlias]) => earlierAlias);
    const key = removed.join(" ");
    let index = indexes.get(key);
    if (index === undefined) {
      index = conflicts.length;
      indexes.set(key, index);
      conflicts.push(removed);
    }
    groups[alias] = index;
  }
  return `const groups=${JSON.stringify(groups)};
const conflicts=${JSON.stringify(conflicts)};
const combinations=${JSON.stringify(Object.fromEntries(combinations))};
export function twMerge(value) {
  const tokens = value.trim().split(/\\s+/).flatMap(token => combinations[token] || [token]);
  const blocked = new Set();
  const result = [];
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    const group = groups[token];
    if (group === undefined) {
      result.push(token);
    } else if (!blocked.has(token)) {
      result.push(token);
      for (const removed of conflicts[group]) blocked.add(removed);
    }
  }
  return result.reverse().join(" ");
}`;
}
