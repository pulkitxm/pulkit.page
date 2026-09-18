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
import { buildDemoAssets } from "./demo-assets.mjs";
import { logDuration } from "./duration.mjs";
import { resolveSiteOrigin } from "./site-origin.mjs";

const tailwind = fileURLToPath(
  new URL("dist/index.mjs", import.meta.resolve("@tailwindcss/cli/package.json")),
);
const buildStartedAt = performance.now();
const origin = resolveSiteOrigin();

let stepStartedAt = performance.now();
execFileSync("sh", ["scripts/check-sync.sh"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", SITE_URL: "", SITE_OUTPUT_DIR: "pages" },
});
logDuration("Verified production pages", stepStartedAt);
stepStartedAt = performance.now();
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
if (production) {
  cpSync("pages", "dist", { recursive: true });
} else {
  execFileSync(process.execPath, ["scripts/generate.mjs"], {
    stdio: "inherit",
    env: { ...process.env, SITE_OUTPUT_DIR: "dist" },
  });
}
logDuration(production ? "Copied production pages" : "Rendered preview pages", stepStartedAt);
stepStartedAt = performance.now();
cpSync("assets", "dist/assets", { recursive: true });
for (const file of ["theme.js", ".nojekyll"]) {
  copyFileSync(file, `dist/${file}`);
}
if (production) {
  copyFileSync("CNAME", "dist/CNAME");
}
logDuration("Copied shared assets", stepStartedAt);
stepStartedAt = performance.now();
execFileSync(
  process.execPath,
  [tailwind, "--input", "styles.css", "--output", "dist/styles.css", "--minify"],
  { stdio: ["ignore", "ignore", "inherit"] },
);
logDuration("Compiled styles", stepStartedAt);
stepStartedAt = performance.now();
await buildDemoAssets("dist/assets/demos");
logDuration("Built demo assets", stepStartedAt);
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
