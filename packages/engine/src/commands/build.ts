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
import process from "node:process";
import { buildDemoAssets } from "@pulkit/demos/assets";
import { buildEmbedAssets } from "@pulkit/embeds/bundle";
import { builtFiles, developmentOutput } from "@pulkit/shared/built-site";
import { logDuration, timed, timedAsync } from "@pulkit/shared/duration";
import { sha256Hex } from "@pulkit/shared/hash";
import { compileTailwind } from "@pulkit/shared/tailwind";
import { themeFile } from "@pulkit/theme/files";
import { mangleClasses } from "../lib/mangle-classes.ts";
import { generateSite } from "../site/generate.ts";
import { resolveSiteOrigin } from "../site/site-origin.ts";

const buildStartedAt = performance.now();
const origin = resolveSiteOrigin();

timed("Cleared previous build", () => {
  if (existsSync("dist")) {
    for (const entry of readdirSync("dist")) {
      if (!developmentOutput.test(entry)) {
        rmSync(`dist/${entry}`, { force: true, recursive: true });
      }
    }
  }
});
const production =
  (!process.env.NODE_ENV || process.env.NODE_ENV === "production") &&
  origin === resolveSiteOrigin({ NODE_ENV: "production" });
const pages = await timedAsync("Rendered pages", () => generateSite("dist", origin));
timed("Copied shared assets", () => {
  cpSync(themeFile("assets"), "dist/assets", { recursive: true });
  if (existsSync("assets")) {
    cpSync("assets", "dist/assets", { recursive: true });
  }
  copyFileSync(themeFile("assets/favicon-32.png"), "dist/favicon.ico");
  if (production) {
    copyFileSync("CNAME", "dist/CNAME");
  }
});
timed("Compiled styles", () =>
  compileTailwind({ input: "styles.css", output: "dist/styles.css", minify: true }),
);
await timedAsync("Built demo assets", async () => {
  if (pages.some((page) => page.body.includes(":::demo "))) {
    await buildDemoAssets("dist/assets/demos");
  }
  await buildEmbedAssets("dist/assets");
});
timed(
  ({ renamed, kept }) =>
    `Renamed ${renamed} classes, kept ${kept} referenced by scripts or other styles`,
  () => mangleClasses("dist", "styles.css"),
);
timed("Fingerprinted styles", () => {
  const fingerprinted = new Map<string, string>();
  for (const file of ["styles.css"]) {
    const hash = sha256Hex(readFileSync(`dist/${file}`)).slice(0, 12);
    const name = file.replace(/\.(\w+)$/, `.${hash}.$1`);
    renameSync(`dist/${file}`, `dist/${name}`);
    fingerprinted.set(`/${file}"`, `/${name}"`);
  }
  for (const file of builtFiles("dist").filter((path) => path.endsWith(".html"))) {
    let html = readFileSync(file, "utf8");
    for (const [from, to] of fingerprinted) {
      html = html.replaceAll(`="${from}`, `="${to}`);
    }
    writeFileSync(file, html);
  }
});
logDuration(`Built dist for ${origin}`, buildStartedAt);
