import { createPageAssets, renderRawHtml } from "@pulkit/embeds";
import { errorMessage } from "@pulkit/shared/failures";

export interface MarkdownNode {
  type: string;
  value?: string;
  alt?: string | null | undefined;
  url?: string;
  lang?: string | null | undefined;
  meta?: string | null | undefined;
  depth?: number;
  identifier?: string;
  position?: { start: { line: number } } | undefined;
  children?: MarkdownNode[];
}

export type Fail = (message: string, node?: MarkdownNode) => void;

const genericLinkText =
  /^(?:click here|read more|learn more|here|this|link|more)[\s.,:;!?>\u2192]*$/i;

function sourceText(node: MarkdownNode): string {
  return node.value ?? node.alt ?? node.children?.map(sourceText).join("") ?? "";
}

function checkUrl(node: MarkdownNode, page: boolean, fail: Fail): void {
  const url = node.url ?? "";
  if (!url || /^(?:javascript|data|file|vbscript):/i.test(url) || url.startsWith("//")) {
    fail("unsafe or empty URL", node);
  }
  if (page && url && !/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/.test(url)) {
    fail("page links must be root-relative, HTTPS/HTTP, mailto, or fragments", node);
  }
  if (page && node.type === "image" && url && !url.startsWith("/assets/")) {
    fail("page images must be self-hosted under /assets/", node);
  }
  const target = url.startsWith("/") ? (url.split(/[?#]/)[0] ?? "") : "";
  if (target && !target.endsWith("/") && !/\.[a-z0-9]+$/i.test(target)) {
    fail("page URLs must end with /", node);
  }
}

function checkDirective(node: MarkdownNode, fail: Fail): void {
  const text = sourceText(node);
  if (
    !/^(?::::list (?:[a-z0-9-]+:all|[a-z0-9]+(?:[-/][a-z0-9]+)*)(?: limit=[1-9][0-9]*)?(?: by-year)?|:::carousel|:::)$/.test(
      text,
    ) &&
    !/^:::demo [a-z0-9]+(?:-[a-z0-9]+)*(?: [a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(text) &&
    !/^:::projects [\w.-]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) &&
    !/^EMBEDTOKEN\d+X$/.test(text)
  ) {
    fail("invalid or embedded directive", node);
  }
}

export interface MarkdownWalk {
  topHeadings: number;
}

export function walkMarkdown(tree: MarkdownNode, page: boolean, fail: Fail): MarkdownWalk {
  let topHeadings = 0;
  let headingDepth = page ? 1 : 0;
  const headings = new Set<string>();
  const definitions = new Set<string>();
  const references: MarkdownNode[] = [];
  function walk(node: MarkdownNode): void {
    if (node.type === "html") {
      try {
        renderRawHtml(node.value ?? "", createPageAssets());
      } catch (error) {
        fail(`raw HTML: ${errorMessage(error)}`, node);
      }
    }
    if (node.type === "heading") {
      const depth = node.depth ?? 1;
      if (depth === 1) {
        topHeadings++;
      }
      if (page && depth === 1) {
        fail("page H1 comes from title; start body headings at ##", node);
      } else if (depth > headingDepth + 1) {
        fail(`heading levels must not skip: h${headingDepth} is followed by h${depth}`, node);
      }
      headingDepth = depth;
      const label = sourceText(node).toLowerCase();
      if (headings.has(label)) {
        fail(`duplicate heading: ${label}`, node);
      }
      headings.add(label);
    }
    if (
      node.type === "code" &&
      (!node.lang || !/^[a-z][a-z0-9+#-]*$/.test(node.lang) || node.meta)
    ) {
      fail("code fences need a lowercase language and no extra metadata", node);
    }
    if (node.type === "link") {
      const label = sourceText(node).trim();
      if (!label) {
        fail("links require descriptive text", node);
      } else if (genericLinkText.test(label)) {
        fail(`link text must describe its destination, not "${label}"`, node);
      }
    }
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      checkUrl(node, page, fail);
    }
    if (node.type === "definition") {
      if (definitions.has(node.identifier ?? "")) {
        fail("duplicate link definition", node);
      }
      definitions.add(node.identifier ?? "");
    }
    if (node.type === "linkReference" || node.type === "imageReference") {
      references.push(node);
    }
    if (node.type === "paragraph" && sourceText(node).includes(":::")) {
      checkDirective(node, fail);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(tree);
  for (const node of references) {
    if (!definitions.has(node.identifier ?? "")) {
      fail(`undefined link reference: ${node.identifier}`, node);
    }
  }
  return { topHeadings };
}
