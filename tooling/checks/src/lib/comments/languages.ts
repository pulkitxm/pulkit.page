import type { SupportedLanguage } from "tree-sitter-wasm";

const aliases: Readonly<Record<string, string>> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "tsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  yml: "yaml",
  jsonc: "json",
  py: "python",
  rb: "ruby",
  rs: "rust",
  h: "c",
  cc: "cpp",
  hpp: "cpp",
  cs: "c_sharp",
  kt: "kotlin",
  proto: "cpp",
  protobuf: "cpp",
  cypher: "java",
  md: "markdown",
  htm: "html",
  svg: "html",
  xml: "html",
  scss: "css",
  less: "css",
  graphql: "hash",
  nginx: "hash",
  conf: "hash",
  ini: "hash",
  gitignore: "hash",
  npmrc: "hash",
};

const grammarLanguages: readonly SupportedLanguage[] = [
  "javascript",
  "typescript",
  "tsx",
  "bash",
  "yaml",
  "json",
  "python",
  "ruby",
  "rust",
  "c",
  "cpp",
  "c_sharp",
  "java",
  "kotlin",
  "swift",
  "css",
  "lua",
  "toml",
  "go",
  "php",
  "dart",
  "scala",
  "elixir",
  "elm",
  "ocaml",
  "solidity",
  "zig",
];

const plainLanguages = new Set(["text", "plaintext", "txt", "math", "http"]);

export function normalizeLanguage(language: string): string {
  return aliases[language] ?? language;
}

export function grammarLanguage(language: string): SupportedLanguage | undefined {
  return grammarLanguages.find((candidate) => candidate === language);
}

export function isPlainLanguage(language: string): boolean {
  return plainLanguages.has(language);
}
