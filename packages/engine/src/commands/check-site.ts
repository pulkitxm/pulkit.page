import { readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import process from "node:process";
import { builtFiles } from "@pulkit/shared/built-site";
import { errorMessage, reportFailures } from "@pulkit/shared/failures";

const root = resolve(process.argv[2] ?? "dist");
const failures: string[] = [];

function references(file: string, text: string): string[] {
  const values: string[] = [];
  if ([".htm", ".html"].includes(extname(file))) {
    for (const [, value = ""] of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      values.push(value);
    }
  }
  if (extname(file) === ".css") {
    for (const [, value = ""] of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      values.push(value);
    }
  }
  return values;
}

function localTarget(file: string, value: string): string | null {
  if (value.startsWith("#")) {
    return null;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(value)) {
    return null;
  }
  if (/^(data|mailto|tel):/i.test(value)) {
    return null;
  }
  if (/^javascript:/i.test(value)) {
    throw new Error(`${file}: unsafe URL ${value}`);
  }
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) {
    return null;
  }
  const base = value.startsWith("/") ? root : dirname(file);
  const target = resolve(base, clean.replace(/^\//, ""));
  if (target !== root && !target.startsWith(`${root}/`)) {
    throw new Error(`${file}: path escapes build root: ${value}`);
  }
  return normalize(target);
}

const files = builtFiles(root);
for (const file of files) {
  if (![".css", ".htm", ".html"].includes(extname(file))) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const value of references(file, text)) {
    let target: string | null;
    try {
      target = localTarget(file, value);
    } catch (error) {
      failures.push(errorMessage(error));
      continue;
    }
    if (!target) {
      continue;
    }
    const candidates = extname(target) ? [target] : [target, join(target, "index.html")];
    if (!candidates.some((candidate) => files.includes(candidate))) {
      failures.push(`${file}: unresolved local reference ${value}`);
    }
  }
}

reportFailures(failures, `validated local references across ${files.length} build files`);
