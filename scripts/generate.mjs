import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { logDuration } from "./duration.mjs";
import { generationCache, generationVersion } from "./generation-cache.mjs";
import { seoOutputs } from "./og-images.mjs";
import { renderDependencies, renderPage } from "./render-page.mjs";

import { readSite } from "./site-inventory.mjs";
import { generationDirectory, resolveSiteOrigin } from "./site-origin.mjs";

const generationStartedAt = performance.now();
let stepStartedAt = generationStartedAt;
const outputDirectory = generationDirectory();
const excluded = new Set([
  ".git",
  "node_modules",
  "extras",
  "dist",
  "layouts",
  ".cache",
  "reports",
]);

function filesUnder(directory, excludeTools = false) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (
      (excludeTools && excluded.has(path)) ||
      (directory === "dist" && /^dev-[0-9]+$/.test(entry.name))
    ) {
      return [];
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlinks are not supported in page trees: ${path}`);
    }
    return entry.isDirectory() ? filesUnder(path, excludeTools) : [path];
  });
}

function outputFor(source) {
  const name = relative("content", source).replace(/\.md$/i, "");
  if (name === "home") {
    return join(outputDirectory, "index.html");
  }
  if (name === "index") {
    return join(outputDirectory, "index.html");
  }
  return join(outputDirectory, name.endsWith("/index") ? `${name}.html` : `${name}/index.html`);
}

const args = process.argv.slice(2);
if (
  args.length > 1 ||
  (args.length === 1 && !["--check", "--clean", "--incremental"].includes(args[0]))
) {
  throw new Error("Usage: scripts/generate.sh [--check | --clean | --incremental]");
}
const check = args[0] === "--check";
const incremental = !check && args[0] !== "--clean";
const clean = args[0] === "--clean" || args[0] === "--incremental";
const version = generationVersion();
const cache = generationCache(outputDirectory, version, !check);
const { pages, layouts, site } = readSite(resolveSiteOrigin());
const expected = new Map();
logDuration("Discovered source pages", stepStartedAt);
stepStartedAt = performance.now();
for (const page of pages) {
  const { source } = page;
  const output = outputFor(source);
  const render = () => renderPage(page.text, { layouts, site, pages, route: page.route, cache });
  expected.set(output, {
    source,
    html: await (incremental
      ? cache.get(
          "html",
          [page.route, page.text, [...layouts], site, renderDependencies(page, pages, site)],
          () => render(),
        )
      : render()),
  });
}
if (!expected.has(join(outputDirectory, "index.html"))) {
  throw new Error("Missing homepage source: content/home.md");
}
logDuration(`Rendered ${expected.size} pages`, stepStartedAt);
stepStartedAt = performance.now();

const generatedAssets = new Map(
  [...seoOutputs(pages, site, cache)].map(([path, bytes]) => [
    join(outputDirectory, relative("pages", path)),
    bytes,
  ]),
);
logDuration("Rendered generated assets", stepStartedAt);
stepStartedAt = performance.now();
const failures = [];
for (const file of filesUnder(outputDirectory).filter((file) => !/\.html?$/i.test(file))) {
  if (!generatedAssets.has(file)) {
    if (clean) {
      rmSync(file);
    } else {
      failures.push(`Extra generated asset: ${file}`);
    }
  }
}
for (const [file, buffer] of generatedAssets) {
  if (check) {
    if (!existsSync(file) || !readFileSync(file).equals(buffer)) {
      failures.push(`Missing or stale generated asset: ${file}`);
    }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file) || !readFileSync(file).equals(buffer)) {
      writeFileSync(file, buffer);
    }
  }
}
for (const file of (outputDirectory === "pages"
  ? filesUnder(".", true)
  : filesUnder(outputDirectory)
).filter((file) => /\.html?$/i.test(file))) {
  if (!expected.has(file)) {
    if (clean && file.startsWith(`${outputDirectory}/`)) {
      rmSync(file);
      let parent = dirname(file);
      while (parent !== outputDirectory && readdirSync(parent).length === 0) {
        rmdirSync(parent);
        parent = dirname(parent);
      }
      console.log(`Removed orphan output: ${file}`);
    } else {
      failures.push(`Extra HTML without a Markdown source: ${file}`);
    }
  }
}
for (const [output, { source, html }] of expected) {
  if (check) {
    if (!existsSync(output)) {
      failures.push(`Missing HTML: ${output} (source: ${source})`);
    } else if (readFileSync(output, "utf8") !== html) {
      failures.push(`Stale HTML: ${output} (source: ${source})`);
    }
  } else {
    mkdirSync(dirname(output), { recursive: true });
    if (!existsSync(output) || readFileSync(output, "utf8") !== html) {
      writeFileSync(output, html);
      console.log(`Generated ${output} from ${source}`);
    }
  }
}
logDuration(check ? "Checked generated output" : "Synchronized generated output", stepStartedAt);
if (failures.length) {
  console.error(`Pages are out of sync:\n${failures.map((failure) => `  ${failure}`).join("\n")}`);
  console.error(
    "Run `bun run generate` for missing/stale output. Remove extra HTML or migrate it into content/. Use `bun run generate --clean` to remove orphan HTML inside pages/. HTML outside pages/ must be removed manually.",
  );
  process.exit(1);
}
console.log(`${expected.size} Markdown page(s) and HTML output(s) are in sync`);

stepStartedAt = performance.now();
cache.save();
logDuration("Saved generation cache", stepStartedAt);
console.log(`Computed ${JSON.stringify(cache.counts)}`);
logDuration("Generation complete", generationStartedAt);
