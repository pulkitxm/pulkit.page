import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const output = "dist";
const excludedRoots = new Set([".github", "content", "dist", "node_modules", "scripts", "tests"]);
const excludedNames = new Set([
  ".gitignore",
  ".htmlvalidate.json",
  ".prettierignore",
  "biome.json",
  "bun.lock",
  "package.json",
]);
const sourceExtensions = new Set([".md", ".mdx"]);
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const copied = new Map();

function destinationFor(file) {
  const parts = file.split("/");
  if (excludedRoots.has(parts[0])) return null;
  if (excludedNames.has(file)) return null;
  if (sourceExtensions.has(extname(file).toLowerCase())) return null;
  const relative = parts[0] === "public" ? parts.slice(1).join("/") : file;
  if (!relative || relative.startsWith(".")) return null;
  return join(output, relative);
}

rmSync(output, { force: true, recursive: true });

for (const file of files) {
  const destination = destinationFor(file);
  if (!destination) continue;
  if (copied.has(destination)) {
    throw new Error(`${file} and ${copied.get(destination)} resolve to ${destination}`);
  }
  copied.set(destination, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}

if (!copied.has(join(output, "index.html")))
  throw new Error("build did not produce dist/index.html");
console.log(`built ${copied.size} files in ${output}`);
