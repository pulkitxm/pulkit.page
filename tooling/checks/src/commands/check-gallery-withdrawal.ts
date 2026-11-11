import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { galleryLicenses } from "@pulkit/embeds/gallery-licenses";
import { builtFiles } from "@pulkit/shared/built-site";
import { readExperimentCatalog } from "@pulkit/shared/experiment-catalog";
import { experimentIndexSchema } from "@pulkit/shared/experiments";
import { reportFailures } from "@pulkit/shared/failures";
import { repositoryRoot } from "@pulkit/shared/repository";
import { approvedGalleryPaths } from "../lib/gallery-routes.ts";

const site = process.argv[2];
if (site !== "page" && site !== "blog") {
  throw new Error("Usage: check-gallery-withdrawal.ts page|blog");
}
const root = `apps/${site}/dist`;
if (!existsSync(root)) {
  throw new Error(`Missing built site: ${root}`);
}
const catalog = readExperimentCatalog(repositoryRoot);
const { pages, socialCards } = approvedGalleryPaths(
  catalog.projects.map((project) => project.name),
);
const previews = new Set(catalog.projects.map((project) => project.preview));
const artwork = new Map(
  builtFiles(join(repositoryRoot, "apps/page/assets/project-previews")).map((file) => [
    relative(join(repositoryRoot, "apps/page"), file),
    readFileSync(file),
  ]),
);
const failures: string[] = [];
const noticeFile = join(root, "assets/embeds/experiment-gallery-notices.txt");
if (!existsSync(noticeFile) || readFileSync(noticeFile, "utf8") !== galleryLicenses()) {
  failures.push("Gallery software license notices are missing or stale");
}
let publishedBytes = 0;
for (const file of builtFiles(root)) {
  publishedBytes += statSync(file).size;
  const path = relative(root, file);
  if (
    path.startsWith("claude-directory/") &&
    (site !== "page" || !pages.has(path.slice("claude-directory/".length)))
  ) {
    failures.push(`${path}: unapproved gallery route`);
  }
  if (path.startsWith("og/claude-directory/")) {
    const child = path.slice("og/claude-directory/".length);
    if (site !== "page" || !socialCards.has(child)) {
      failures.push(`${path}: retired gallery card`);
    }
  }
  if (
    /^assets\/embeds\/claude-directory(?:[.-])/.test(path) ||
    /content\/events\/my-first-talk\/(?:8|9)(?:[.-]|$)/.test(path) ||
    /public\/blogs\/my-first-talk\/(?:0[2-5]|video-thumbnail)(?:[.-]|$)/.test(path)
  ) {
    failures.push(`${path}: withdrawn media or legacy gallery script`);
  }
  if (path.startsWith("assets/experiment-artwork/")) {
    failures.push(`${path}: retired abstract artwork`);
  }
  if (path.startsWith("assets/project-previews/")) {
    const expected = artwork.get(path);
    if (
      site !== "page" ||
      !expected ||
      createHash("sha256").update(readFileSync(file)).digest("hex") !==
        createHash("sha256").update(expected).digest("hex")
    ) {
      failures.push(`${path}: unverified fresh project preview`);
    }
  }
  if (!/\.(?:html|md|json|js)$/.test(path)) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  if (
    /(?:raw\.githubusercontent\.com|download-directory\.github\.io)[^"<>\s]*claude-directory/.test(
      text,
    ) ||
    /(?:mc3AYQplnM8|fYsE_CJn_rY)/.test(text)
  ) {
    failures.push(`${path}: retired raw source, archive or recording`);
  }
  for (const match of text.matchAll(
    /https?:\/\/claude-directory\.pulkitxm\.com\/[^\s"'`<>\\)]*/g,
  )) {
    if (
      !previews.has(match[0]) &&
      !(path.endsWith(".js") && match[0] === "https://claude-directory.pulkitxm.com/")
    ) {
      failures.push(`${path}: unapproved primary preview reference`);
    }
  }
}
if (site === "page") {
  const index = join(root, "claude-directory/reviewed-projects.json");
  if (!existsSync(index)) {
    failures.push("Reviewed gallery index is missing");
  } else if (
    JSON.stringify(experimentIndexSchema.parse(JSON.parse(readFileSync(index, "utf8")))) !==
    JSON.stringify(catalog)
  ) {
    failures.push("Published gallery index differs from the approved source catalog");
  }
  for (const path of artwork.keys()) {
    if (!existsSync(join(root, path))) {
      failures.push(`${path}: missing verified fresh recording or notice`);
    }
  }
}
if (site === "page" && publishedBytes > 900 * 1024 * 1024) {
  failures.push("Portfolio artifact exceeds its 900 MiB publication budget");
}
reportFailures(failures, `Verified approved gallery routes and retired media for ${site}`);
