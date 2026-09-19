import { extname } from "node:path";
import { splitFrontmatter } from "@pulkit/shared/frontmatter";
import { markdownParser } from "@pulkit/shared/markdown";
import type { DefaultTreeAdapterTypes } from "parse5";
import { defaultTreeAdapter, parse, parseFragment } from "parse5";
import { grammarRanges } from "./grammar-ranges.ts";
import { grammarLanguage, isPlainLanguage, normalizeLanguage } from "./languages.ts";
import { lexicalRanges } from "./lexical-ranges.ts";
import type { CommentRange } from "./range.ts";
import { shiftRanges } from "./range.ts";

type HtmlNode = DefaultTreeAdapterTypes.Node;

interface MarkdownPoint {
  offset?: number | undefined;
}

interface MarkdownNode {
  type: string;
  value?: string;
  lang?: string | null | undefined;
  position?: { start: MarkdownPoint; end: MarkdownPoint } | undefined;
  children?: MarkdownNode[];
}

interface ScannedComment extends CommentRange {
  line: number;
  text: string;
}

function childNodes(node: HtmlNode): HtmlNode[] {
  return "childNodes" in node ? node.childNodes : [];
}

function nodeText(node: HtmlNode): string {
  if (defaultTreeAdapter.isTextNode(node)) {
    return node.value;
  }
  return childNodes(node).map(nodeText).join("");
}

function attribute(node: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

async function elementRanges(
  node: DefaultTreeAdapterTypes.Element,
  source: string,
  preserveExamples: boolean,
): Promise<CommentRange[]> {
  const location = node.sourceCodeLocation;
  const startTag = location?.startTag;
  const endTag = location?.endTag;
  if (!(location && startTag && endTag)) {
    return [];
  }
  if (["script", "style"].includes(node.tagName)) {
    const start = startTag.endOffset;
    const body = source.slice(start, endTag.startOffset);
    let language = attribute(node, "type")?.includes("json") ? "json" : "javascript";
    if (node.tagName === "style") {
      language = "css";
    }
    return shiftRanges(await commentRanges(language, body), start);
  }
  const language = attribute(node, "class")?.match(/\blanguage-([^ ]+)/)?.[1];
  if (node.tagName === "code" && !preserveExamples && language) {
    const raw = source.slice(startTag.endOffset, endTag.startOffset);
    const comments = await commentRanges(language, nodeText(parseFragment(raw)));
    if (comments.length > 0) {
      return [{ start: location.startOffset, end: location.endOffset }];
    }
  }
  return [];
}

async function htmlRanges(source: string, preserveExamples = false): Promise<CommentRange[]> {
  const ranges: CommentRange[] = [];
  async function walk(node: HtmlNode): Promise<void> {
    const location = node.sourceCodeLocation;
    if (defaultTreeAdapter.isCommentNode(node) && location) {
      ranges.push({ start: location.startOffset, end: location.endOffset });
    }
    if (defaultTreeAdapter.isElementNode(node)) {
      ranges.push(...(await elementRanges(node, source, preserveExamples)));
    }
    for (const child of childNodes(node)) {
      await walk(child);
    }
    if ("content" in node) {
      await walk(node.content);
    }
  }
  await walk(parse(source, { sourceCodeLocationInfo: true }));
  return ranges;
}

function fenceRanges(
  node: MarkdownNode,
  raw: string,
  bodyStart: number,
  comments: readonly CommentRange[],
): CommentRange[] {
  const value = node.value ?? "";
  return comments.map((comment) => {
    const lines = value.slice(0, comment.start).split("\n");
    const rawLines = raw.split("\n");
    const bodyLine = rawLines[lines.length] ?? "";
    const indent = bodyLine.length - (value.split("\n")[lines.length - 1]?.length ?? 0);
    const start =
      bodyStart +
      rawLines.slice(1, lines.length).reduce((sum, line) => sum + line.length + 1, 0) +
      Math.max(0, indent) +
      (lines.at(-1) ?? "").length;
    return { start, end: start + comment.end - comment.start };
  });
}

async function markdownRanges(source: string, preserveExamples = false): Promise<CommentRange[]> {
  const ranges: CommentRange[] = [];
  const front = splitFrontmatter(source, { closedByEndOfFile: true });
  if (front) {
    ranges.push(...shiftRanges(await grammarRanges("yaml", front.yaml), 4));
  }
  const offset = front?.length ?? 0;
  const tree: MarkdownNode = markdownParser.parse(source.slice(offset));
  async function walk(node: MarkdownNode): Promise<void> {
    if (node.type === "code" && preserveExamples) {
      return;
    }
    const start = offset + (node.position?.start.offset ?? 0);
    if (node.type === "code" && node.lang) {
      const raw = source.slice(start, offset + (node.position?.end.offset ?? 0));
      const comments = await commentRanges(node.lang, node.value ?? "");
      ranges.push(...fenceRanges(node, raw, start + raw.indexOf("\n") + 1, comments));
      return;
    }
    if (node.type === "html") {
      ranges.push(...shiftRanges(await htmlRanges(node.value ?? "", preserveExamples), start));
    }
    for (const child of node.children ?? []) {
      await walk(child);
    }
  }
  await walk(tree);
  return ranges;
}

export async function commentRanges(language: string, source: string): Promise<CommentRange[]> {
  const normalized = normalizeLanguage(language);
  if (isPlainLanguage(normalized)) {
    return [];
  }
  const grammar = grammarLanguage(normalized);
  if (grammar) {
    return await grammarRanges(grammar, source);
  }
  if (normalized === "markdown") {
    return await markdownRanges(source);
  }
  if (normalized === "html") {
    return await htmlRanges(source);
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

function languageOf(file: string, source: string): string {
  const name = file.split("/").at(-1) ?? "";
  const extension = extname(file).slice(1).toLowerCase();
  if (!extension && source.startsWith("#!")) {
    return /\b(node|bun|deno)\b/.test(source.split("\n")[0] ?? "") ? "javascript" : "bash";
  }
  if (["CNAME", ".nojekyll"].includes(name)) {
    return "text";
  }
  if ([".gitignore", ".npmrc", ".env"].includes(name)) {
    return "hash";
  }
  return name === "bun.lock" ? "json" : extension;
}

export async function scanText(file: string, source: string): Promise<ScannedComment[]> {
  const ranges =
    /^apps\/[a-z0-9-]+\/content\//.test(file) && extname(file).toLowerCase() === ".md"
      ? await markdownRanges(source, true)
      : await commentRanges(languageOf(file, source), source);
  return ranges.map((range) => ({
    ...range,
    line: source.slice(0, range.start).split("\n").length,
    text: (source.slice(range.start, range.end).split("\n")[0] ?? "").slice(0, 100),
  }));
}
