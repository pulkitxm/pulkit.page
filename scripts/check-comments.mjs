import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parse } from "@babel/parser";

const babelExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const slashExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".kt",
  ".kts",
  ".m",
  ".mm",
  ".rs",
  ".swift",
]);
const hashExtensions = new Set([
  ".bash",
  ".conf",
  ".ini",
  ".pl",
  ".py",
  ".rb",
  ".sh",
  ".toml",
  ".zsh",
]);
const cssExtensions = new Set([".css", ".less", ".sass", ".scss"]);
const htmlExtensions = new Set([".htm", ".html", ".md", ".mdx"]);
const jsonExtensions = new Set([".json", ".jsonc"]);
const yamlExtensions = new Set([".yaml", ".yml"]);
const hashNames = new Set([".env", ".gitignore", ".npmrc", ".prettierignore", "bun.lock"]);

function isDirective(raw) {
  const normalized = raw
    .replace(/^\/\/+/, "")
    .replace(/^\/\*+/, "")
    .replace(/\*\/$/, "")
    .replace(/^#+/, "")
    .trim()
    .replace(/^\*+\s*/, "");
  if (raw.startsWith("/*!")) return true;
  if (/^<(reference|amd-)/.test(normalized)) return true;
  if (/^@(ts-ignore|ts-expect-error|ts-nocheck|ts-check)\b/.test(normalized)) return true;
  if (/^(eslint|biome|prettier)-(disable|enable|ignore)/.test(normalized)) return true;
  if (/^(swift-tools-version|swiftlint:|swift-format\b)/.test(normalized)) return true;
  if (/^(yaml-language-server|yamllint)\b/.test(normalized)) return true;
  if (/^@(license|preserve)\b/.test(normalized)) return true;
  if (/^[#@]__(PURE|NO_SIDE_EFFECTS)__/.test(normalized)) return true;
  if (/^(istanbul|c8|v8)\s+ignore\b/.test(normalized)) return true;
  return false;
}

function lineAt(text, position) {
  let line = 1;
  for (let index = 0; index < position; index += 1) {
    if (text[index] === "\n") line += 1;
  }
  return line;
}

function excerpt(text, start, end) {
  const value = text.slice(start, end).split("\n")[0].trim();
  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

function finding(text, start, end) {
  return {
    line: lineAt(text, start),
    text: excerpt(text, start, end),
  };
}

function babelComments(file, text) {
  const extension = extname(file).toLowerCase();
  const plugins = [];
  if ([".cts", ".mts", ".ts", ".tsx"].includes(extension)) plugins.push("typescript");
  if ([".jsx", ".tsx"].includes(extension)) plugins.push("jsx");
  const tree = parse(text, {
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    plugins,
    sourceType: "unambiguous",
  });
  return (tree.comments ?? [])
    .filter((comment) => !isDirective(text.slice(comment.start, comment.end)))
    .map((comment) => finding(text, comment.start, comment.end));
}

function slashComments(text, lineComments = true) {
  const ranges = [];
  let index = 0;
  let quote = null;
  while (index < text.length) {
    const character = text[index];
    if (quote) {
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      index += 1;
      continue;
    }
    if (character === "/" && text[index + 1] === "*") {
      const start = index;
      let depth = 1;
      index += 2;
      while (index < text.length && depth > 0) {
        if (text[index] === "/" && text[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (text[index] === "*" && text[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      ranges.push({ end: index, start });
      continue;
    }
    if (lineComments && character === "/" && text[index + 1] === "/") {
      const start = index;
      index += 2;
      while (index < text.length && text[index] !== "\n") index += 1;
      ranges.push({ end: index, start });
      continue;
    }
    index += 1;
  }
  return ranges
    .filter((range) => !isDirective(text.slice(range.start, range.end)))
    .map((range) => finding(text, range.start, range.end));
}

function hashComments(text) {
  const ranges = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    let quote = null;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (quote) {
        if (character === "\\" && quote !== "'") {
          index += 1;
          continue;
        }
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character !== "#") continue;
      if (lineStart === 0 && index === 0 && line[index + 1] === "!") break;
      if (line.slice(Math.max(0, index - 2), index + 1) === "${#") continue;
      const start = lineStart + index;
      ranges.push({ end: lineStart + line.length, start });
      break;
    }
    lineStart += line.length + 1;
  }
  return ranges
    .filter((range) => !isDirective(text.slice(range.start, range.end)))
    .map((range) => finding(text, range.start, range.end));
}

function htmlComments(text) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf("<!--", index);
    if (start === -1) break;
    const close = text.indexOf("-->", start + 4);
    const end = close === -1 ? text.length : close + 3;
    ranges.push({ end, start });
    index = end;
  }
  return ranges.map((range) => finding(text, range.start, range.end));
}

function jsonComments(text) {
  return slashComments(text, true);
}

export function kindForFile(file, text = "") {
  const extension = extname(file).toLowerCase();
  const name = file.split("/").at(-1) ?? file;
  if (babelExtensions.has(extension)) return "babel";
  if (slashExtensions.has(extension)) return "slash";
  if (hashExtensions.has(extension) || hashNames.has(name)) return "hash";
  if (cssExtensions.has(extension)) return "css";
  if (htmlExtensions.has(extension)) return "html";
  if (jsonExtensions.has(extension)) return "json";
  if (yamlExtensions.has(extension)) return "yaml";
  if (text.startsWith("#!") && /\b(node|bun|deno)\b/.test(text.split("\n", 1)[0])) return "babel";
  if (text.startsWith("#!")) return "hash";
  return "data";
}

export function scanText(file, text) {
  const kind = kindForFile(file, text);
  if (kind === "babel") return babelComments(file, text);
  if (kind === "slash") return slashComments(text, true);
  if (kind === "hash" || kind === "yaml") return hashComments(text);
  if (kind === "css") return slashComments(text, false);
  if (kind === "json") return jsonComments(text);
  if (kind === "html") {
    const findings = htmlComments(text);
    if (extname(file).toLowerCase() === ".mdx") findings.push(...slashComments(text, false));
    return findings;
  }
  return [];
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
}

export function checkFiles(files = trackedFiles()) {
  const failures = [];
  let binary = 0;
  for (const file of files) {
    const buffer = readFileSync(file);
    if (buffer.includes(0)) {
      binary += 1;
      continue;
    }
    const text = buffer.toString("utf8");
    for (const item of scanText(file, text)) failures.push({ file, ...item });
  }
  return { binary, failures, total: files.length };
}

function main() {
  const result = checkFiles();
  for (const item of result.failures) {
    console.error(`${item.file}:${item.line}: disallowed comment: ${item.text}`);
  }
  if (result.failures.length > 0) {
    console.error(`found ${result.failures.length} disallowed comment(s)`);
    process.exit(1);
  }
  console.log(`checked ${result.total} tracked files, including ${result.binary} binary files`);
}

if (import.meta.main) main();
