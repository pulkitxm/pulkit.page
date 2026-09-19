import type { DefaultTreeAdapterTypes } from "parse5";
import { defaultTreeAdapter } from "parse5";

export type HtmlNode = DefaultTreeAdapterTypes.ChildNode;
export type HtmlElement = DefaultTreeAdapterTypes.Element;

export const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
export const rawTextElements = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes"]);
export const escapableRawTextElements = new Set(["textarea", "title"]);
const blockElements = new Set([
  "address",
  "article",
  "aside",
  "base",
  "blockquote",
  "body",
  "caption",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "li",
  "link",
  "main",
  "menu",
  "meta",
  "nav",
  "noscript",
  "ol",
  "p",
  "pre",
  "script",
  "search",
  "section",
  "style",
  "summary",
  "table",
  "tbody",
  "td",
  "template",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "ul",
]);
const layoutDisplays = new Set(["flex", "grid"]);
const inlineDisplay = /^(?:[\w-]+:)*(?:inline|inline-block|inline-flex|inline-grid|contents)$/;
const verbatimWhitespace = /^(?:[\w-]+:)*whitespace-(?:pre|pre-wrap|pre-line|break-spaces)$/;

export function isElement(node: HtmlNode): node is HtmlElement {
  return defaultTreeAdapter.isElementNode(node);
}

export function isText(node: HtmlNode): node is DefaultTreeAdapterTypes.TextNode {
  return defaultTreeAdapter.isTextNode(node);
}

function classes(node: HtmlNode): string[] {
  if (!isElement(node)) {
    return [];
  }
  return node.attrs.find((attribute) => attribute.name === "class")?.value.split(/\s+/) ?? [];
}

export function attributeValue(node: HtmlElement, name: string): string | undefined {
  return node.attrs.find((attribute) => attribute.name === name)?.value;
}

export function keepsWhitespace(node: HtmlNode): boolean {
  const names = classes(node);
  if (isElement(node) && node.tagName === "pre") {
    return !names.includes("whitespace-normal");
  }
  return names.some((name) => verbatimWhitespace.test(name));
}

export function isLayoutContainer(node: HtmlNode): boolean {
  const names = classes(node);
  return (
    names.some((name) => layoutDisplays.has(name)) &&
    !names.some((name) => /:(?:block|inline|inline-block|contents|table|flow-root)$/.test(name))
  );
}

export function childrenOf(node: HtmlNode): HtmlNode[] {
  if (!isElement(node)) {
    return [];
  }
  return "content" in node ? node.content.childNodes : node.childNodes;
}

export function isOwnBlock(node: HtmlNode): boolean {
  return (
    isElement(node) &&
    !classes(node).some((name) => inlineDisplay.test(name)) &&
    (blockElements.has(node.tagName) ||
      node.tagName.includes("-") ||
      classes(node).includes("block"))
  );
}

function touchesInline(node: HtmlNode | undefined): boolean {
  return node !== undefined && !isOwnBlock(node) && !(isText(node) && node.value.trim() === "");
}

export function isIsolated(node: HtmlNode, siblings: readonly HtmlNode[]): boolean {
  const index = siblings.indexOf(node);
  return !(touchesInline(siblings[index - 1]) || touchesInline(siblings[index + 1]));
}

export function isBlock(node: HtmlNode): boolean {
  if (!isElement(node)) {
    return false;
  }
  if (classes(node).some((name) => inlineDisplay.test(name))) {
    return false;
  }
  if (isOwnBlock(node)) {
    return true;
  }
  return childrenOf(node).some(isBlock);
}
