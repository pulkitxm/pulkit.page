import { parse } from "parse5";

const indentUnit = "  ";
const voidElements = new Set([
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
const rawTextElements = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes"]);
const escapableRawTextElements = new Set(["textarea", "title"]);
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
const meaningfulEmptyAttributes = new Set(["alt", "value"]);
const layoutDisplays = new Set(["flex", "grid"]);
const inlineDisplay = /^(?:[\w-]+:)*(?:inline|inline-block|inline-flex|inline-grid|contents)$/;
const verbatimWhitespace = /^(?:[\w-]+:)*whitespace-(?:pre|pre-wrap|pre-line|break-spaces)$/;

function classes(node) {
  return node.attrs?.find((attribute) => attribute.name === "class")?.value.split(/\s+/) ?? [];
}

function isElement(node) {
  return Boolean(node.tagName);
}

function keepsWhitespace(node) {
  const names = classes(node);
  if (node.tagName === "pre") {
    return !names.includes("whitespace-normal");
  }
  return names.some((name) => verbatimWhitespace.test(name));
}

function isLayoutContainer(node) {
  const names = classes(node);
  return (
    names.some((name) => layoutDisplays.has(name)) &&
    !names.some((name) => /:(?:block|inline|inline-block|contents|table|flow-root)$/.test(name))
  );
}

function childrenOf(node) {
  return node.content?.childNodes ?? node.childNodes ?? [];
}

function isOwnBlock(node) {
  return (
    isElement(node) &&
    !classes(node).some((name) => inlineDisplay.test(name)) &&
    (blockElements.has(node.tagName) ||
      node.tagName.includes("-") ||
      classes(node).includes("block"))
  );
}

function touchesInline(node) {
  return (
    node !== undefined &&
    !isOwnBlock(node) &&
    !(node.nodeName === "#text" && node.value.trim() === "")
  );
}

function isIsolated(node, siblings) {
  const index = siblings.indexOf(node);
  return !(touchesInline(siblings[index - 1]) || touchesInline(siblings[index + 1]));
}

function isBlock(node) {
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

function isReindentable(node) {
  const type = node.attrs.find((attribute) => attribute.name === "type")?.value ?? "";
  return node.tagName === "style" || (node.tagName === "script" && type.includes("json"));
}

function reindent(text, indent) {
  const lines = text.split("\n").filter((line, index, all) => {
    const edge = index === 0 || index === all.length - 1;
    return !(edge && line.trim() === "");
  });
  const margin = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)[0].length),
  );
  return lines.map((line) => (line.trim() ? `${indent}${line.slice(margin)}` : "")).join("\n");
}

function escapeText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\u00a0", "&nbsp;")
    .replaceAll("\u2714", "&#10004;");
}

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\u00a0", "&nbsp;");
}

function attributeName(attribute) {
  return attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
}

function startTag(node) {
  const attributes = node.attrs
    .map((attribute) =>
      attribute.value === "" && !meaningfulEmptyAttributes.has(attribute.name)
        ? ` ${attributeName(attribute)}`
        : ` ${attributeName(attribute)}="${escapeAttribute(attribute.value)}"`,
    )
    .join("");
  const selfClosing =
    voidElements.has(node.tagName) ||
    (node.namespaceURI !== "http://www.w3.org/1999/xhtml" && childrenOf(node).length === 0);
  return `<${node.tagName}${attributes}${selfClosing ? " />" : ">"}`;
}

function isSelfClosing(node) {
  return startTag(node).endsWith(" />");
}

function inline(node, preserve) {
  if (node.nodeName === "#text") {
    const text = rawTextElements.has(node.parentNode?.tagName)
      ? node.value
      : escapeText(node.value);
    return preserve ? text : text.replace(/[ \t\n\r\f]+/g, " ");
  }
  if (node.nodeName === "#comment") {
    return `<!--${node.data}-->`;
  }
  if (isSelfClosing(node)) {
    return startTag(node);
  }
  const keep = preserve || keepsWhitespace(node);
  const content = childrenOf(node)
    .map((child) =>
      escapableRawTextElements.has(node.tagName) && child.nodeName === "#text"
        ? escapeText(child.value)
        : inline(child, keep),
    )
    .join("");
  const leading = ["pre", "textarea"].includes(node.tagName) && content.includes("\n") ? "\n" : "";
  return `${startTag(node)}${leading}${content}</${node.tagName}>`;
}

function runs(nodes, blockified) {
  const groups = [];
  for (const node of nodes) {
    const standalone =
      isOwnBlock(node) ||
      (isBlock(node) && isIsolated(node, nodes)) ||
      (blockified && (isElement(node) || node.nodeName === "#comment"));
    if (standalone || (blockified && node.nodeName === "#text")) {
      groups.push([node]);
    } else if (groups.length > 0 && !groups.at(-1).standalone) {
      groups.at(-1).push(node);
    } else {
      groups.push([node]);
    }
    if (standalone) {
      groups.at(-1).standalone = true;
    }
  }
  return groups;
}

function block(node, depth, lines) {
  const indent = indentUnit.repeat(depth);
  if (node.nodeName === "#documentType") {
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
  const text = children.map((child) => child.value ?? "").join("");
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
    const content = children
      .map((child) => inline(child, false))
      .join("")
      .trim();
    lines.push(`${indent}${startTag(node)}${content}</${node.tagName}>`);
    return;
  }
  lines.push(`${indent}${startTag(node)}`);
  for (const group of groups) {
    if (group.standalone) {
      block(group[0], depth + 1, lines);
    } else {
      const content = group
        .map((child) => inline(child, false))
        .join("")
        .trim();
      if (content) {
        lines.push(`${indentUnit.repeat(depth + 1)}${content}`);
      }
    }
  }
  lines.push(`${indent}</${node.tagName}>`);
}

export function formatHtml(html) {
  const lines = [];
  for (const node of parse(html).childNodes) {
    block(node, 0, lines);
  }
  return `${lines.join("\n")}\n`;
}
