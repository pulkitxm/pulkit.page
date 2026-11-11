import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import process from "node:process";
import { builtFiles } from "@pulkit/shared/built-site";
import { reportFailures } from "@pulkit/shared/failures";

const site = process.argv[2];
if (site !== "page" && site !== "blog") {
  throw new Error("Usage: check-gallery-withdrawal.ts page|blog");
}
const root = `apps/${site}/dist`;
if (!existsSync(root)) {
  throw new Error(`Missing built site: ${root}`);
}
const failures: string[] = [];
for (const file of builtFiles(root)) {
  const path = relative(root, file);
  if (
    /^claude-directory\/(?!index\.(?:html|md)$)/.test(path) ||
    /^assets\/embeds\/claude-directory\./.test(path) ||
    /^og\/claude-directory\/.+\//.test(path) ||
    /content\/events\/my-first-talk\/(?:8|9)(?:[.-]|$)/.test(path) ||
    /public\/blogs\/my-first-talk\/(?:0[2-5]|video-thumbnail)(?:[.-]|$)/.test(path)
  ) {
    failures.push(`${path}: withdrawn gallery output`);
  }
  if (!/\.(?:html|md|json)$/.test(file)) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  if (
    /claude-directory\.pulkitxm\.com/.test(text) ||
    /(?:raw\.githubusercontent\.com|download-directory\.github\.io)[^"<>\s]*claude-directory/.test(
      text,
    ) ||
    /(?:mc3AYQplnM8|fYsE_CJn_rY)/.test(text)
  ) {
    failures.push(`${path}: withdrawn gallery media, code, prompt, or download link`);
  }
}
reportFailures(failures, `Verified withdrawn gallery output for ${site}`);
