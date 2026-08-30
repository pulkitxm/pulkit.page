import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const failures = [];

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function references(file, text) {
  const values = [];
  if ([".htm", ".html"].includes(extname(file))) {
    for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) values.push(match[1]);
  }
  if (extname(file) === ".css") {
    for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) values.push(match[1]);
  }
  return values;
}

function localTarget(file, value) {
  if (value.startsWith("#")) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(value)) return null;
  if (/^(data|mailto|tel):/i.test(value)) return null;
  if (/^javascript:/i.test(value)) throw new Error(`${file}: unsafe URL ${value}`);
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) return null;
  const base = value.startsWith("/") ? root : dirname(file);
  const target = resolve(base, clean.replace(/^\//, ""));
  if (!target.startsWith(root)) throw new Error(`${file}: path escapes build root: ${value}`);
  return normalize(target);
}

const files = walk(root);
for (const file of files) {
  if (![".css", ".htm", ".html"].includes(extname(file))) continue;
  const text = readFileSync(file, "utf8");
  for (const value of references(file, text)) {
    let target;
    try {
      target = localTarget(file, value);
    } catch (error) {
      failures.push(error.message);
      continue;
    }
    if (!target) continue;
    const candidates = extname(target) ? [target] : [target, join(target, "index.html")];
    if (!candidates.some((candidate) => files.includes(candidate))) {
      failures.push(`${file}: unresolved local reference ${value}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`validated local references across ${files.length} build files`);
