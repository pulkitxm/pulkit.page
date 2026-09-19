import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(import.meta.resolve("@biomejs/biome/bin/biome"));
const config = fileURLToPath(new URL("../../../biome.json", import.meta.url));
const literal = new Set(["", "text", "plaintext", "txt", "math", "mermaid"]);
const biomeFiles = new Map([
  ["js", "snippet.js"],
  ["javascript", "snippet.js"],
  ["mjs", "snippet.mjs"],
  ["cjs", "snippet.cjs"],
  ["jsx", "snippet.jsx"],
  ["ts", "snippet.ts"],
  ["typescript", "snippet.ts"],
  ["mts", "snippet.mts"],
  ["cts", "snippet.cts"],
  ["tsx", "snippet.tsx"],
  ["json", "snippet.json"],
  ["jsonc", "snippet.jsonc"],
  ["css", "snippet.css"],
  ["html", "snippet.html"],
  ["graphql", "snippet.graphql"],
  ["gql", "snippet.graphql"],
]);

function linesOf(code) {
  return String(code)
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""));
}

function trimTrailingBlanks(lines) {
  const next = [...lines];
  while (next.length > 0 && next.at(-1) === "") {
    next.pop();
  }
  return next;
}

function expandLeadingTabs(line) {
  const indent = /^(?:\t| )*/.exec(line)?.[0] ?? "";
  let spaces = "";
  for (const character of indent) {
    spaces += character === "\t" ? "  " : " ";
  }
  return `${spaces}${line.slice(indent.length)}`;
}

function hygiene(code, structural) {
  const lines = trimTrailingBlanks(linesOf(code));
  if (!structural) {
    return lines.join("\n");
  }
  while (lines.length > 0 && lines[0] === "") {
    lines.shift();
  }
  const collapsed = [];
  for (const line of lines) {
    if (line === "" && collapsed.at(-1) === "") {
      continue;
    }
    collapsed.push(line);
  }
  const expanded = collapsed.map(expandLeadingTabs);
  const indents = expanded
    .filter((line) => line !== "")
    .map((line) => /^( *)/.exec(line)?.[1].length ?? 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return expanded.map((line) => (line === "" ? "" : line.slice(indent))).join("\n");
}

function biomeFormat(code, fileName) {
  try {
    return execFileSync(
      process.execPath,
      [
        cli,
        "format",
        "--write",
        "--vcs-enabled=false",
        `--stdin-file-path=${fileName}`,
        `--config-path=${config}`,
      ],
      {
        input: code,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch {}
}

export function formatFence(language, code) {
  const id = (language ?? "").trim().toLowerCase();
  const text = hygiene(code, !literal.has(id));
  const fileName = biomeFiles.get(id);
  if (!fileName) {
    return text;
  }
  const formatted = biomeFormat(text, fileName);
  return formatted === undefined ? text : hygiene(formatted, false);
}
