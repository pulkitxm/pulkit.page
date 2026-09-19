import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildDemoAssets } from "@pulkit/demos/assets";
import { buildEmbedAssets } from "@pulkit/embeds/bundle";
import { themeFile } from "@pulkit/theme/files";
import { logDuration } from "./duration.mjs";
import { generateSite } from "./generate.mjs";
import { mangleClasses } from "./mangle-classes.mjs";
import { resolveSiteOrigin } from "./site-origin.mjs";

const tailwind = fileURLToPath(
  new URL("dist/index.mjs", import.meta.resolve("@tailwindcss/cli/package.json")),
);
const buildStartedAt = performance.now();
const origin = resolveSiteOrigin();

let stepStartedAt = performance.now();
if (existsSync("dist")) {
  for (const entry of readdirSync("dist")) {
    if (!/^dev-[0-9]+$/.test(entry)) {
      rmSync(`dist/${entry}`, { force: true, recursive: true });
    }
  }
}
logDuration("Cleared previous build", stepStartedAt);
const production =
  (!process.env.NODE_ENV || process.env.NODE_ENV === "production") &&
  origin === resolveSiteOrigin({ NODE_ENV: "production" });
stepStartedAt = performance.now();
const pages = await generateSite("dist", origin);
logDuration("Rendered pages", stepStartedAt);
stepStartedAt = performance.now();
cpSync(themeFile("assets"), "dist/assets", { recursive: true });
if (existsSync("assets")) {
  cpSync("assets", "dist/assets", { recursive: true });
}
copyFileSync(themeFile("assets/favicon-32.png"), "dist/favicon.ico");
copyFileSync(themeFile("theme.js"), "dist/theme.js");
if (production) {
  copyFileSync("CNAME", "dist/CNAME");
}
logDuration("Copied shared assets", stepStartedAt);
stepStartedAt = performance.now();
execFileSync(
  process.execPath,
  [tailwind, "--input", "styles.css", "--output", "dist/styles.css", "--minify"],
  { stdio: ["ignore", "ignore", "pipe"] },
);
logDuration("Compiled styles", stepStartedAt);
stepStartedAt = performance.now();
if (pages.some((page) => page.body.includes(":::demo "))) {
  await buildDemoAssets("dist/assets/demos");
}
await buildEmbedAssets("dist/assets");
logDuration("Built demo assets", stepStartedAt);
stepStartedAt = performance.now();
const { renamed, kept } = mangleClasses("dist", "styles.css");
logDuration(
  `Renamed ${renamed} classes, kept ${kept} referenced by scripts or other styles`,
  stepStartedAt,
);
stepStartedAt = performance.now();
const fingerprinted = new Map();
for (const file of ["styles.css", "theme.js"]) {
  const hash = createHash("sha256")
    .update(readFileSync(`dist/${file}`))
    .digest("hex")
    .slice(0, 12);
  const name = file.replace(/\.(\w+)$/, `.${hash}.$1`);
  renameSync(`dist/${file}`, `dist/${name}`);
  fingerprinted.set(`/${file}"`, `/${name}"`);
}
function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return directory === "dist" && /^dev-[0-9]+$/.test(entry.name) ? [] : htmlFiles(path);
    }
    return entry.name.endsWith(".html") ? [path] : [];
  });
}
for (const file of htmlFiles("dist")) {
  let html = readFileSync(file, "utf8");
  for (const [from, to] of fingerprinted) {
    html = html.replaceAll(`="${from}`, `="${to}`);
  }
  writeFileSync(file, html);
}
logDuration("Fingerprinted styles and theme script", stepStartedAt);
logDuration(`Built dist for ${origin}`, buildStartedAt);
