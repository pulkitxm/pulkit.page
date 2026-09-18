import { extname } from "node:path";
import process from "node:process";
import { parse, parseFragment } from "parse5";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { getWasmPath } from "tree-sitter-wasm";
import { unified } from "unified";
import { Language, Parser } from "web-tree-sitter";
import { Parser as YamlParser } from "yaml";
import { readRepositoryText, repositoryFiles } from "./repository-files.mjs";

await Parser.init();
const parsers = new Map();
const markdown = unified().use(remarkParse).use(remarkGfm);
const aliases = {
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
const languages = new Set([
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
]);
const plain = new Set(["text", "plaintext", "txt", "math", "http"]);

async function grammarRanges(language, source) {
  if (language === "yaml") {
    const ranges = [];
    function visit(value) {
      if (!value || typeof value !== "object") {
        return;
      }
      if (value.type === "comment") {
        ranges.push({ start: value.offset, end: value.offset + value.source.length });
        return;
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) {
          child.forEach(visit);
        } else {
          visit(child);
        }
      }
    }
    for (const token of new YamlParser().parse(source)) {
      visit(token);
    }
    return ranges;
  }
  if (!parsers.has(language)) {
    const parser = new Parser();
    parser.setLanguage(await Language.load(getWasmPath(language)));
    parsers.set(language, parser);
  }
  const tree = parsers.get(language).parse(source);
  const ranges = [];
  function walk(node) {
    const comment = /comment/.test(node.type);
    const docstring =
      language === "python" &&
      node.type === "expression_statement" &&
      node.firstNamedChild?.type === "string" &&
      !/^[rubf]*[bf]/i.test(node.firstNamedChild.text) &&
      (node.parent?.type === "module" ||
        ["function_definition", "class_definition"].includes(node.parent?.parent?.type)) &&
      node.parent?.namedChildren.find((child) => !/comment/.test(child.type))?.id === node.id;
    if (comment || docstring) {
      if (!(node.startIndex === 0 && node.text.startsWith("#!"))) {
        ranges.push({ start: node.startIndex, end: node.endIndex });
      }
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(tree.rootNode);
  tree.delete();
  return ranges;
}

function lexicalRanges(source, sql = false, marker = "#") {
  const ranges = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const dollar = sql && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest)?.[0];
    const triple =
      !sql && (rest.startsWith('"""') || rest.startsWith("'''")) ? rest.slice(0, 3) : null;
    const quote = dollar || triple || (/^["'`]/.test(rest) ? rest[0] : null);
    if (quote) {
      index += quote.length;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source.startsWith(quote, index)) {
          index += quote.length;
          if (sql && quote.length === 1 && source.startsWith(quote, index)) {
            index += quote.length;
            continue;
          }
          break;
        }
        index++;
      }
      continue;
    }
    const block = sql && rest.startsWith("/*");
    const line = sql ? rest.startsWith("--") : rest.startsWith(marker);
    if (block || line) {
      const start = index;
      if (block) {
        index += 2;
        let depth = 1;
        while (index < source.length && depth) {
          if (source.startsWith("/*", index)) {
            depth++;
            index += 2;
          } else if (source.startsWith("*/", index)) {
            depth--;
            index += 2;
          } else {
            index++;
          }
        }
      } else {
        const end = source.indexOf("\n", index);
        index = end < 0 ? source.length : end;
      }
      if (!(start === 0 && source.startsWith("#!"))) {
        ranges.push({ start, end: index });
      }
      continue;
    }
    index++;
  }
  return ranges;
}

function nodeText(node) {
  if (node.nodeName === "#text") {
    return node.value ?? "";
  }
  return (node.childNodes ?? []).map(nodeText).join("");
}

async function htmlRanges(source, preserveExamples = false) {
  const document = parse(source, { sourceCodeLocationInfo: true });
  const ranges = [];
  async function walk(node) {
    const location = node.sourceCodeLocation;
    if (node.nodeName === "#comment" && location) {
      ranges.push({ start: location.startOffset, end: location.endOffset });
    }
    if (["script", "style"].includes(node.tagName) && location?.startTag && location.endTag) {
      const start = location.startTag.endOffset;
      const body = source.slice(start, location.endTag.startOffset);
      const type = node.attrs.find((attr) => attr.name === "type")?.value;
      const language =
        node.tagName === "style" ? "css" : type?.includes("json") ? "json" : "javascript";
      ranges.push(
        ...(await commentRanges(language, body)).map((range) => ({
          start: start + range.start,
          end: start + range.end,
        })),
      );
    }
    if (node.tagName === "code" && !preserveExamples) {
      const language = node.attrs
        .find((attr) => attr.name === "class")
        ?.value.match(/\blanguage-([^ ]+)/)?.[1];
      if (language && location?.startTag && location.endTag) {
        const raw = source.slice(location.startTag.endOffset, location.endTag.startOffset);
        const decoded = nodeText(parseFragment(raw));
        const comments = await commentRanges(language, decoded);
        if (comments.length) {
          ranges.push({ start: location.startOffset, end: location.endOffset });
        }
      }
    }
    for (const child of node.childNodes ?? []) {
      await walk(child);
    }
    if (node.content) {
      await walk(node.content);
    }
  }
  await walk(document);
  return ranges;
}

async function markdownRanges(source, preserveExamples = false) {
  const ranges = [];
  const front = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  if (front) {
    ranges.push(
      ...(await grammarRanges("yaml", front[1])).map((range) => ({
        start: 4 + range.start,
        end: 4 + range.end,
      })),
    );
  }
  const offset = front?.[0].length ?? 0;
  const tree = markdown.parse(source.slice(offset));
  async function walk(node) {
    if (node.type === "code" && preserveExamples) {
      return;
    }
    if (node.type === "code" && node.lang) {
      const raw = source.slice(
        offset + node.position.start.offset,
        offset + node.position.end.offset,
      );
      const start = offset + node.position.start.offset + raw.indexOf("\n") + 1;
      const comments = await commentRanges(node.lang, node.value);
      for (const comment of comments) {
        const preceding = node.value.slice(0, comment.start);
        const lines = preceding.split("\n");
        const rawLines = raw.split("\n");
        const bodyLine = rawLines[lines.length] ?? "";
        const indent = bodyLine.length - (node.value.split("\n")[lines.length - 1]?.length ?? 0);
        const mappedStart =
          start +
          rawLines.slice(1, lines.length).reduce((sum, line) => sum + line.length + 1, 0) +
          Math.max(0, indent) +
          lines.at(-1).length;
        ranges.push({ start: mappedStart, end: mappedStart + comment.end - comment.start });
      }
      return;
    }
    if (node.type === "html") {
      const start = offset + node.position.start.offset;
      ranges.push(
        ...(await htmlRanges(node.value, preserveExamples)).map((range) => ({
          start: start + range.start,
          end: start + range.end,
        })),
      );
    }
    for (const child of node.children ?? []) {
      await walk(child);
    }
  }
  await walk(tree);
  return ranges;
}

export async function commentRanges(language, source) {
  const normalized = aliases[language] ?? language;
  if (plain.has(normalized)) {
    return [];
  }
  if (languages.has(normalized)) {
    return grammarRanges(normalized, source);
  }
  if (normalized === "markdown") {
    return markdownRanges(source);
  }
  if (normalized === "html") {
    return htmlRanges(source);
  }
  if (normalized === "mermaid") {
    return lexicalRanges(source, false, "%%");
  }
  if (normalized === "hash" || normalized === "sql") {
    return lexicalRanges(source, normalized === "sql");
  }
  throw new Error(
    `Unsupported comment syntax: ${language}; register a parser before adding this file or fence`,
  );
}

export async function scanText(file, source) {
  const name = file.split("/").at(-1);
  const extension = extname(file).slice(1).toLowerCase();
  let language = extension;
  if (name === "bun.lock") {
    language = "json";
  }
  if ([".gitignore", ".npmrc", ".env"].includes(name)) {
    language = "hash";
  }
  if (["CNAME", ".nojekyll"].includes(name)) {
    language = "text";
  }
  if (!extension && source.startsWith("#!")) {
    language = /\b(node|bun|deno)\b/.test(source.split("\n")[0]) ? "javascript" : "bash";
  }
  const ranges =
    file.startsWith("content/blogs/") && extension === "md"
      ? await markdownRanges(source, true)
      : file.startsWith("pages/blogs/") && extension === "html"
        ? await htmlRanges(source, true)
        : await commentRanges(language, source);
  return ranges.map((range) => ({
    ...range,
    line: source.slice(0, range.start).split("\n").length,
    text: source.slice(range.start, range.end).split("\n")[0].slice(0, 100),
  }));
}

if (import.meta.main) {
  const errors = [];
  let total = 0;
  for (const file of repositoryFiles()) {
    try {
      const source = readRepositoryText(file);
      if (source === null) {
        continue;
      }
      total++;
      for (const comment of await scanText(file, source)) {
        if (
          /^<!-- \[html-validate-(?:disable|enable)(?:-next|-block)? [a-z-]+\] -->$/.test(
            comment.text,
          )
        ) {
          continue;
        }
        errors.push(`${file}:${comment.line}: forbidden comment: ${comment.text}`);
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`No comments in ${total} repository text files`);
}
