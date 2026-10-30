import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import MagicString from "magic-string";
import { type DefaultTreeAdapterTypes, parse, serializeOuter } from "parse5";
import { root } from "./config.ts";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

function elements(source: string): Element[] {
  const found: Element[] = [];
  const walk = (node: Node): void => {
    if ("tagName" in node) {
      found.push(node);
    }
    if ("childNodes" in node) {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
    if ("content" in node) {
      walk(node.content);
    }
  };
  walk(parse(source, { sourceCodeLocationInfo: true }));
  return found;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

export function classTokens(source: string): string[] {
  return elements(source).flatMap((element) =>
    element.attrs
      .filter((entry) => entry.name === "class" || /^data-[\w-]+-class$/.test(entry.name))
      .flatMap((entry) => entry.value.split(/\s+/).filter(Boolean)),
  );
}

export function originalHome(): string {
  const cache = join(root, "apps/page/.cache/generate");
  const candidates = readdirSync(cache).filter((name) => name.endsWith(".json"));
  const matches: string[] = [];
  for (const filename of candidates) {
    const data = JSON.parse(readFileSync(join(cache, filename), "utf8"));
    for (const [key, entry] of Object.entries(data.entries ?? {})) {
      if (
        !key.startsWith("html:") ||
        typeof entry !== "object" ||
        !entry ||
        !("value" in entry) ||
        typeof entry.value !== "string"
      ) {
        continue;
      }
      if (
        elements(entry.value).some(
          (element) =>
            element.tagName === "link" &&
            attribute(element, "rel") === "canonical" &&
            attribute(element, "href") === "https://pulkit.page/",
        )
      ) {
        matches.push(entry.value);
      }
    }
  }
  if (matches.length !== 1) {
    throw new Error("Build apps/page first: expected one canonical home page in its render cache");
  }
  const source = matches[0] ?? "";
  const built = readFileSync(join(root, "apps/page/dist/index.html"), "utf8");
  const optimized = elements(built).filter((element) => element.tagName === "img");
  const original = elements(source).filter((element) => element.tagName === "img");
  if (original.length !== optimized.length) {
    throw new Error("Built home and cached home have different image inventories");
  }
  const output = new MagicString(source);
  for (const [index, image] of original.entries()) {
    const final = optimized[index];
    const location = image.sourceCodeLocation;
    if (!final || !location || attribute(image, "src") !== attribute(final, "src")) {
      throw new Error("Home image order changed; rebuild before benchmarking");
    }
    final.attrs = [
      ...final.attrs.filter((entry) => entry.name !== "class"),
      ...image.attrs.filter((entry) => entry.name === "class"),
    ];
    output.overwrite(location.startOffset, location.endOffset, serializeOuter(final));
  }
  const html = output.toString();
  if (elements(html).some((element) => attribute(element, "src")?.startsWith("http"))) {
    throw new Error("Home fixture has an external resource");
  }
  if (html.includes("/assets/analytics.js")) {
    throw new Error("Create the benchmark fixture with analytics disabled");
  }
  return html;
}

export function scriptEntries(source: string): string[] {
  return elements(source)
    .filter((element) => element.tagName === "script")
    .flatMap((element) => {
      const src = attribute(element, "src");
      if (!src) {
        return [];
      }
      if (!/^\/assets\/embeds\/[\w-]+\.js$/.test(src)) {
        throw new Error(`Unsupported home script ${src}`);
      }
      return [
        join(
          root,
          "packages/embeds/client/entries",
          src.slice(src.lastIndexOf("/") + 1).replace(/\.js$/, ".ts"),
        ),
      ];
    });
}
