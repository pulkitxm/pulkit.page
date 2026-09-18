import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
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
logDuration(`Built dist for ${origin}`, buildStartedAt);
