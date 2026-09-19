import type { Token } from "parse5";
import { defaultTreeAdapter, parse } from "parse5";
import type { HtmlElement, HtmlNode } from "./html-nodes.ts";
import {
  attributeValue,
  childrenOf,
  escapableRawTextElements,
  isBlock,
  isElement,
  isIsolated,
  isLayoutContainer,
  isOwnBlock,
  isText,
  keepsWhitespace,
  rawTextElements,
  voidElements,
} from "./html-nodes.ts";

interface Run {
  nodes: HtmlNode[];
  standalone: boolean;
}

const indentUnit = "  ";
const meaningfulEmptyAttributes = new Set(["alt", "value"]);

function isReindentable(node: HtmlElement): boolean {
  const type = attributeValue(node, "type") ?? "";
  return node.tagName === "style" || (node.tagName === "script" && type.includes("json"));
}

function reindent(text: string, indent: string): string {
  const lines = text.split("\n").filter((line, index, all) => {
    const edge = index === 0 || index === all.length - 1;
    return !(edge && line.trim() === "");
  });
  const margin = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)?.[0].length ?? 0),
  );
  return lines.map((line) => (line.trim() ? `${indent}${line.slice(margin)}` : "")).join("\n");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\u00a0", "&nbsp;")
    .replaceAll("\u2714", "&#10004;");
}

function escapeAttributeValue(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\u00a0", "&nbsp;");
}

function attributeName(attribute: Token.Attribute): string {
  return attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
}

function startTag(node: HtmlElement): string {
  const attributes = node.attrs
    .map((attribute) =>
      attribute.value === "" && !meaningfulEmptyAttributes.has(attribute.name)
        ? ` ${attributeName(attribute)}`
        : ` ${attributeName(attribute)}="${escapeAttributeValue(attribute.value)}"`,
    )
    .join("");
  const selfClosing =
    voidElements.has(node.tagName) ||
    (node.namespaceURI !== "http://www.w3.org/1999/xhtml" && childrenOf(node).length === 0);
  return `<${node.tagName}${attributes}${selfClosing ? " />" : ">"}`;
}

function isSelfClosing(node: HtmlElement): boolean {
  return startTag(node).endsWith(" />");
}

function parentTag(node: HtmlNode): string {
  const parent = node.parentNode;
  return parent !== null && defaultTreeAdapter.isElementNode(parent) ? parent.tagName : "";
}

function inline(node: HtmlNode, preserve: boolean): string {
  if (isText(node)) {
    const text = rawTextElements.has(parentTag(node)) ? node.value : escapeText(node.value);
    return preserve ? text : text.replace(/[ \t\n\r\f]+/g, " ");
  }
  if (defaultTreeAdapter.isCommentNode(node)) {
    return `<!--${node.data}-->`;
  }
  if (!isElement(node)) {
    return "";
  }
  if (isSelfClosing(node)) {
    return startTag(node);
  }
  const keep = preserve || keepsWhitespace(node);
  const content = childrenOf(node)
    .map((child) =>
      escapableRawTextElements.has(node.tagName) && isText(child)
        ? escapeText(child.value)
        : inline(child, keep),
    )
    .join("");
  const leading = ["pre", "textarea"].includes(node.tagName) && content.includes("\n") ? "\n" : "";
  return `${startTag(node)}${leading}${content}</${node.tagName}>`;
}

function runs(nodes: readonly HtmlNode[], blockified: boolean): Run[] {
  const groups: Run[] = [];
  for (const node of nodes) {
    const standalone =
      isOwnBlock(node) ||
      (isBlock(node) && isIsolated(node, nodes)) ||
      (blockified && (isElement(node) || defaultTreeAdapter.isCommentNode(node)));
    const last = groups.at(-1);
    if (standalone || (blockified && isText(node))) {
      groups.push({ nodes: [node], standalone });
    } else if (last && !last.standalone) {
      last.nodes.push(node);
    } else {
      groups.push({ nodes: [node], standalone });
    }
  }
  return groups;
}

function inlineContent(nodes: readonly HtmlNode[]): string {
  return nodes
    .map((child) => inline(child, false))
    .join("")
    .trim();
}

function block(node: HtmlNode, depth: number, lines: string[]): void {
  const indent = indentUnit.repeat(depth);
  if (defaultTreeAdapter.isDocumentTypeNode(node)) {
    lines.push(`${indent}<!doctype ${node.name}>`);
    return;
  }
  if (!isElement(node) || isSelfClosing(node) || keepsWhitespace(node)) {
    const text = inline(node, false).trim();
    if (text) {
      lines.push(`${indent}${text}`);
    }
    return;
  }
  const children = childrenOf(node);
  const text = children.map((child) => (isText(child) ? child.value : "")).join("");
  if (isReindentable(node) && text.trim()) {
    lines.push(
      `${indent}${startTag(node)}`,
      reindent(text, indent + indentUnit),
      `${indent}</${node.tagName}>`,
    );
    return;
  }
  if (rawTextElements.has(node.tagName) || escapableRawTextElements.has(node.tagName)) {
    lines.push(`${indent}${inline(node, true)}`);
    return;
  }
  const groups = runs(children, isLayoutContainer(node));
  if (!groups.some((group) => group.standalone)) {
    lines.push(`${indent}${startTag(node)}${inlineContent(children)}</${node.tagName}>`);
    return;
  }
  lines.push(`${indent}${startTag(node)}`);
  for (const group of groups) {
    const [first] = group.nodes;
    if (group.standalone && first) {
      block(first, depth + 1, lines);
    } else {
      const content = inlineContent(group.nodes);
      if (content) {
        lines.push(`${indentUnit.repeat(depth + 1)}${content}`);
      }
    }
  }
  lines.push(`${indent}</${node.tagName}>`);
}

export function formatHtml(html: string): string {
  const lines: string[] = [];
  for (const node of parse(html).childNodes) {
    block(node, 0, lines);
  }
  return `${lines.join("\n")}\n`;
}
