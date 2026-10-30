import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDemoStyles, compiledClassMerge } from "@pulkit/demos/assets";
import { builtFiles } from "@pulkit/shared/built-site";
import { walkFiles } from "@pulkit/shared/files";
import { CompiledStyles, stylesheetClasses } from "./compiled-styles.ts";
import { compileMarkup } from "./style-markup.ts";
import { compileScript, scriptClasses } from "./style-scripts.ts";

const packages = fileURLToPath(new URL("../../../", import.meta.url));
const browserSources = ["demos/client", "embeds/client", "theme/src/client", "shared/src/browser"];

export function compileSiteStyles(directory: string): {
  plugins: Bun.BunPlugin[];
  finish(): void;
  combinations: number;
  pageStyles(filename: string): string;
} {
  const files = builtFiles(directory);
  const mainStyles = readFileSync(join(directory, "styles.css"), "utf8");
  const stylesheets = files.filter((file) => file.endsWith(".css"));
  const ownStyles = [
    join(directory, "styles.css"),
    join(directory, "assets/demos/demos.css"),
  ].filter(existsSync);
  const vendorClasses = new Set(
    stylesheets
      .filter((file) => !ownStyles.includes(file))
      .flatMap((file) => [...stylesheetClasses(readFileSync(file, "utf8"), file)]),
  );
  const classes = new Set(
    ownStyles.flatMap((file) => [...stylesheetClasses(readFileSync(file, "utf8"), file)]),
  );
  if (!existsSync(join(directory, "assets/demos/demos.css"))) {
    for (const name of stylesheetClasses(compileDemoStyles().shadow, "demos.css")) {
      classes.add(name);
    }
  }
  const pages = new Map(
    files
      .filter((file) => file.endsWith(".html"))
      .map((file) => [file, readFileSync(file, "utf8")]),
  );
  const reserved = new Set([...classes, ...vendorClasses]);
  for (const html of pages.values()) {
    for (const [, value = ""] of html.matchAll(/\bclass="([^"]*)"/g)) {
      for (const name of value.split(/\s+/)) {
        reserved.add(name);
      }
    }
  }
  const variables = stylesheets.flatMap(
    (file) => readFileSync(file, "utf8").match(/--[\w-]+/g) ?? [],
  );
  const styles = new CompiledStyles(
    [...classes].filter((name) => !vendorClasses.has(name)),
    reserved,
    variables,
  );
  const sourceFiles = [
    ...browserSources.flatMap((path) => walkFiles(join(packages, path))),
    join(packages, "code/src/highlight/token-role.ts"),
  ].filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  const sources = new Map(sourceFiles.map((file) => [file, readFileSync(file, "utf8")]));
  for (const [filename, source] of sources) {
    for (const name of scriptClasses(source, filename)) {
      styles.mutable.add(name);
    }
  }
  for (const [filename, source] of pages) {
    compileMarkup(source, styles, {
      script: (script) => {
        for (const name of scriptClasses(script, filename)) {
          styles.mutable.add(name);
        }
        return script;
      },
    });
  }
  for (const [filename, source] of sources) {
    styles.collectRuntime = !filename.startsWith(join(packages, "demos/client"));
    sources.set(filename, compileScript(source, filename, styles));
  }
  styles.collectRuntime = false;
  for (const [filename, source] of pages) {
    pages.set(
      filename,
      compileMarkup(source, styles, {
        script: (script) => compileScript(script, filename, styles),
      }),
    );
  }
  let mergeSource: string | undefined;
  const pageStylesCache = new Map<string, string>();
  const plugin: Bun.BunPlugin = {
    name: "compiled-styles",
    setup(build) {
      build.onResolve({ filter: /^tailwind-merge$/ }, () => ({
        path: "class-merge",
        namespace: "compiled-styles",
      }));
      build.onLoad({ filter: /.*/, namespace: "compiled-styles" }, () => {
        mergeSource ??= compiledClassMerge(styles.names, styles.combinations);
        return { contents: mergeSource, loader: "js" };
      });
      build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
        const contents = sources.get(path);
        return contents === undefined ? undefined : { contents, loader: "ts" };
      });
    },
  };
  return {
    plugins: [plugin],
    combinations: styles.combinations.size,
    pageStyles(filename) {
      const source = pages.get(filename);
      if (source === undefined) {
        throw new Error(`Unknown page ${filename}`);
      }
      const used = new Set([
        ...styles.runtime,
        ...(source.match(/\bs[a-z0-9]+\b/g) ?? []).filter((name) => styles.combinations.has(name)),
      ]);
      const key = [...used].sort().join(" ");
      let css = pageStylesCache.get(key);
      if (css === undefined) {
        css = styles.css(mainStyles, "styles.css", used);
        pageStylesCache.set(key, css);
      }
      return css;
    },
    finish() {
      for (const filename of builtFiles(directory).filter((file) => file.endsWith(".css"))) {
        writeFileSync(filename, styles.css(readFileSync(filename, "utf8"), filename));
      }
      for (const [filename, source] of pages) {
        writeFileSync(
          filename,
          compileMarkup(source, styles, { stylesheet: (css) => styles.css(css, filename) }),
        );
      }
    },
  };
}
