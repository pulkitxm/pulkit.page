import type { SupportedLanguage } from "tree-sitter-wasm";
import { getWasmPath } from "tree-sitter-wasm";
import type { Node } from "web-tree-sitter";
import { Language, Parser } from "web-tree-sitter";
import { Parser as YamlParser } from "yaml";
import type { CommentRange } from "./range.ts";

await Parser.init();
const parsers = new Map<SupportedLanguage, Parser>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function yamlRanges(source: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  function visit(value: unknown): void {
    if (!isRecord(value)) {
      return;
    }
    if (
      value.type === "comment" &&
      typeof value.offset === "number" &&
      typeof value.source === "string"
    ) {
      ranges.push({ start: value.offset, end: value.offset + value.source.length });
      return;
    }
    for (const child of Object.values(value)) {
      const items: unknown[] = Array.isArray(child) ? child : [child];
      items.forEach(visit);
    }
  }
  for (const token of new YamlParser().parse(source)) {
    visit(token);
  }
  return ranges;
}

async function parserFor(language: SupportedLanguage): Promise<Parser> {
  const existing = parsers.get(language);
  if (existing) {
    return existing;
  }
  const parser = new Parser();
  parser.setLanguage(await Language.load(getWasmPath(language)));
  parsers.set(language, parser);
  return parser;
}

function isComment(node: Node): boolean {
  return /comment/.test(node.type);
}

function isDocstring(node: Node, language: SupportedLanguage): boolean {
  const first = node.firstNamedChild;
  const parent = node.parent;
  return (
    language === "python" &&
    node.type === "expression_statement" &&
    first?.type === "string" &&
    !/^[rubf]*[bf]/i.test(first.text) &&
    (parent?.type === "module" ||
      ["function_definition", "class_definition"].includes(parent?.parent?.type ?? "")) &&
    parent?.namedChildren.find((child) => !isComment(child))?.id === node.id
  );
}

export async function grammarRanges(
  language: SupportedLanguage,
  source: string,
): Promise<CommentRange[]> {
  if (language === "yaml") {
    return yamlRanges(source);
  }
  const tree = (await parserFor(language)).parse(source);
  if (!tree) {
    throw new Error(`Could not parse ${language} source`);
  }
  const ranges: CommentRange[] = [];
  function walk(node: Node): void {
    if (isComment(node) || isDocstring(node, language)) {
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
