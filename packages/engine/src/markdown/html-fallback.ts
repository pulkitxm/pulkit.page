import { unescapeHtml } from "@pulkit/shared/html";
import { linkTo, type ResolveUrl } from "./markdown-links.ts";

export interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

const droppedInlineTags = new Set(["small", "u", "center", "div", "track", "video", "iframe"]);

function attribute(html: string, name: string): string | undefined {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(html)?.[1];
  return value === undefined ? undefined : unescapeHtml(value);
}

function textOf(node: MarkdownNode): string {
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

function mediaLink(html: string, resolve: ResolveUrl): MarkdownNode {
  const source = attribute(html, "src") ?? "";
  const value = html.startsWith("<video")
    ? linkTo(`Video: ${attribute(html, "title") ?? source.split("/").pop()}`, resolve(source))
    : linkTo(`Live demo: ${attribute(html, "title")}`, source);
  return { type: "html", value };
}

function blockHtml(node: MarkdownNode, resolve: ResolveUrl): MarkdownNode[] {
  const value = (node.value ?? "").trim();
  if (/^<\/?(?:center|div)>$/.test(value) || /^<br\s*\/?>$/.test(value)) {
    return [];
  }
  if (/^<\/?(?:details|summary)\b/.test(value)) {
    return [node];
  }
  if (/^<(?:iframe|video)\b/.test(value)) {
    return [mediaLink(value, resolve)];
  }
  throw new Error(`No Markdown fallback for HTML: ${value.slice(0, 60)}`);
}

function inlineHtml(
  children: readonly MarkdownNode[],
  resolve: ResolveUrl,
  inTable: boolean,
): MarkdownNode[] {
  const output: MarkdownNode[] = [];
  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    if (node === undefined) {
      continue;
    }
    if (node.type !== "html") {
      output.push(node);
      continue;
    }
    const html = node.value ?? "";
    const tag = /^<(\/?)([a-z]+)[^>]*>/.exec(html.trim());
    if (!tag) {
      throw new Error(`No Markdown fallback for HTML: ${html.slice(0, 60)}`);
    }
    const [, closing, name = ""] = tag;
    if (name === "br") {
      output.push(inTable ? node : { type: "break" });
    } else if (!closing && (name === "video" || name === "iframe")) {
      output.push(mediaLink(html.trim(), resolve));
    } else if (!closing && (name === "code" || name === "strong")) {
      const end = children.findIndex(
        (candidate, position) =>
          position > index && candidate.type === "html" && candidate.value === `</${name}>`,
      );
      const inner = children.slice(index + 1, end);
      output.push(
        name === "code"
          ? { type: "inlineCode", value: inner.map(textOf).join("") }
          : { type: "strong", children: inlineHtml(inner, resolve, inTable) },
      );
      index = end;
    } else if (!droppedInlineTags.has(name)) {
      throw new Error(`No Markdown fallback for HTML: ${html}`);
    }
  }
  return output;
}

export function transformTree(node: MarkdownNode, resolve: ResolveUrl, inTable = false): void {
  if (
    (node.type === "link" || node.type === "image" || node.type === "definition") &&
    node.url !== undefined
  ) {
    node.url = resolve(node.url);
  }
  if (!node.children) {
    return;
  }
  const table = inTable || node.type === "table";
  node.children = node.children.flatMap((child) =>
    child.type === "html" && node.type === "root" ? blockHtml(child, resolve) : [child],
  );
  if (node.children.some((child) => child.type === "html") && node.type !== "root") {
    node.children = inlineHtml(node.children, resolve, table);
  }
  for (const child of node.children) {
    transformTree(child, resolve, table);
  }
}
