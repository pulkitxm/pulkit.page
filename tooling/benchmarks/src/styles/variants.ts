import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { compileSiteStyles } from "@pulkit/engine/src/lib/compile-site-styles.ts";
import { CompiledStyles } from "@pulkit/engine/src/lib/compiled-styles.ts";
import { compileMarkup } from "@pulkit/engine/src/lib/style-markup.ts";
import { compileScript, scriptClasses } from "@pulkit/engine/src/lib/style-scripts.ts";
import { bundleBrowserScripts } from "@pulkit/shared/bundle";
import { compileTailwind } from "@pulkit/shared/tailwind";
import { themeFile } from "@pulkit/theme/files";
import type { Artifact, Variant } from "./config.ts";
import { cssRuleCount, pruneCss, renameCss, utilityNames } from "./css.ts";
import { classTokens, scriptEntries } from "./markup.ts";

class AliasStyles extends CompiledStyles {
  override classes(value: string): string {
    return super.classes(value, false);
  }
}

function browserSources(entries: string[]): Map<string, string> {
  const sources = new Map<string, string>();
  const queue = [...entries];
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  for (let file = queue.shift(); file; file = queue.shift()) {
    if (sources.has(file)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    sources.set(file, source);
    for (const item of transpiler.scan(source).imports) {
      const target = Bun.resolveSync(item.path, dirname(file));
      if (target.endsWith(".ts") && !target.includes("/node_modules/")) {
        queue.push(target);
      }
    }
  }
  return sources;
}

export async function buildVariant(
  variant: Variant,
  input: string,
  directory: string,
): Promise<Artifact> {
  const pipelineStarted = performance.now();
  mkdirSync(directory, { recursive: true });
  const seed = readFileSync(join(input, "home.html"), "utf8");
  const catalog: string[] = JSON.parse(readFileSync(join(input, "catalog.json"), "utf8"));
  const sourceCss = readFileSync(join(input, "home.css"), "utf8");
  const stageMs: Record<string, number> = {};
  const time = async <T>(name: string, work: () => T | Promise<T>): Promise<T> => {
    const start = performance.now();
    const result = await work();
    stageMs[name] = performance.now() - start;
    return result;
  };
  let css = "";
  let html = seed;
  const entries = scriptEntries(seed);
  const sources = browserSources(entries);
  let plugins: Bun.BunPlugin[] = [];
  const cssPath = join(directory, "styles.css");
  const utilities = utilityNames(sourceCss);
  if (variant === "composed") {
    await time("tailwind", () =>
      compileTailwind({ input: themeFile("styles.css"), output: cssPath, minify: true }),
    );
    writeFileSync(join(directory, "index.html"), seed);
    const vendor = join(directory, "assets/embeds");
    mkdirSync(vendor, { recursive: true });
    writeFileSync(join(vendor, "vendor.css"), ".plyr{display:block}");
    const compiled = await time("transform", () => compileSiteStyles(directory));
    plugins = compiled.plugins;
    await time("bundle", () =>
      bundleBrowserScripts({
        entrypoints: entries,
        outdir: join(directory, "assets/embeds"),
        minify: true,
        label: "home benchmark",
        plugins,
      }),
    );
    compiled.finish();
    css = compiled.pageStyles(join(directory, "index.html"));
    html = readFileSync(join(directory, "index.html"), "utf8");
  } else {
    const direct = variant === "direct" || variant === "external";
    const generated = variant === "aliases" || direct;
    const Styles = direct ? CompiledStyles : AliasStyles;
    const styles = new Styles(
      catalog,
      new Set([...catalog, ...classTokens(seed)]),
      sourceCss.match(/--[\w-]+/g) ?? [],
    );
    for (const name of catalog) {
      if (/^(?:group|peer)(?:\/|$)/.test(name)) {
        styles.mutable.add(name);
      }
    }
    for (const [filename, source] of sources) {
      for (const name of scriptClasses(source, filename)) {
        styles.mutable.add(name);
      }
    }
    await time("transform", () => {
      if (generated) {
        html = compileMarkup(seed, styles, {
          script: (script) => compileScript(script, "inline.js", styles),
        });
        for (const [filename, source] of sources) {
          sources.set(filename, compileScript(source, filename, styles));
        }
        plugins = [
          {
            name: "home-style-variant",
            setup(build) {
              build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
                const contents = sources.get(path);
                return contents === undefined ? undefined : { contents, loader: "ts" };
              });
            },
          },
        ];
      }
    });
    let inputCss = themeFile("styles.css");
    if (direct) {
      const original = new Map([...styles.names].map(([name, alias]) => [alias, name]));
      const rules = [...styles.combinations].flatMap(([name, aliases]) => {
        const tokens = aliases.flatMap((alias) => {
          const token = original.get(alias);
          return token && utilities.has(token) && !/^(?:group|peer)(?:\/|$)/.test(token)
            ? [token]
            : [];
        });
        return tokens.length > 0 ? [`.${name}{@apply ${tokens.join(" ")};}`] : [];
      });
      inputCss = join(directory, "apply.css");
      writeFileSync(
        inputCss,
        `@import ${JSON.stringify(themeFile("styles.css"))};\n@layer utilities{${rules.join("\n")}}\n`,
      );
    }
    await time("tailwind", () =>
      compileTailwind({ input: inputCss, output: cssPath, minify: true }),
    );
    css = readFileSync(cssPath, "utf8");
    await time("bundle", () =>
      bundleBrowserScripts({
        entrypoints: entries,
        outdir: join(directory, "assets/embeds"),
        minify: true,
        label: "home benchmark",
        plugins,
      }),
    );
    await time("optimize", () => {
      if (variant !== "utilities") {
        const used = new Set(classTokens(generated ? html : seed));
        const originalUsed = generated
          ? new Set([...styles.names].filter(([, alias]) => used.has(alias)).map(([name]) => name))
          : used;
        css = pruneCss(css, utilities, originalUsed);
      }
      if (generated) {
        css = renameCss(css, styles.names, (name) => styles.variable(name));
      }
    });
  }
  if (variant === "external") {
    writeFileSync(join(directory, "home.css"), css);
  }
  html = html.replace(/<link rel="stylesheet" href="\/styles\.css"\s*\/?>/, () =>
    variant === "external" ? '<link rel="stylesheet" href="/home.css" />' : `<style>${css}</style>`,
  );
  writeFileSync(join(directory, "index.html"), html);
  stageMs.pipeline = performance.now() - pipelineStarted;
  const analysisStarted = performance.now();
  const artifact: Artifact = {
    variant,
    directory,
    htmlBytes: Buffer.byteLength(html),
    htmlGzip: gzipSync(html).length,
    htmlBrotli: brotliCompressSync(html).length,
    cssBytes: Buffer.byteLength(css),
    cssGzip: gzipSync(css).length,
    cssRules: cssRuleCount(css),
    classTokens: classTokens(html).length,
    stageMs,
  };
  stageMs.analysis = performance.now() - analysisStarted;
  writeFileSync(join(directory, "artifact.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}
