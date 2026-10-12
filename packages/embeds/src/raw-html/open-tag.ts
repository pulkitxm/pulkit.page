import { unescapeHtml as decode, escapeHtml } from "@pulkit/shared/html";
import { localVideoSize } from "../lib/video-size.ts";
import type { PageAssets } from "../types.ts";
import { type AttributeValues, facadeScript, frameFacade } from "./frame-facade.ts";
import { allowedAttributes, outputTag, tagClasses, trustedFrames } from "./tag-rules.ts";

export interface OpenedTag {
  html: string;
  faded: boolean;
}

function checkSource(tag: string, source: string | undefined): void {
  if (tag === "iframe" && !trustedFrames.test(String(source))) {
    throw new Error(`Untrusted iframe source: ${source}`);
  }
  if (tag === "video" && !source?.startsWith("/assets/")) {
    throw new Error(`Video must come from /assets/: ${source}`);
  }
}

function parseAttributes(tag: string, source: string): AttributeValues {
  const allowed = allowedAttributes[tag] ?? [];
  const values: AttributeValues = new Map();
  for (const [, name = "", , value] of source.matchAll(/([a-z-]+)(="([^"]*)")?/g)) {
    if (!allowed.includes(name)) {
      throw new Error(`Attribute ${name} is not allowed on <${tag}>`);
    }
    const decoded = value === undefined ? undefined : decode(value);
    if (name === "src") {
      checkSource(tag, decoded);
    }
    values.set(name, decoded);
  }
  return values;
}

function serializeAttributes(values: AttributeValues): string {
  return [...values]
    .map(([name, value]) => (value === undefined ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`))
    .join("");
}

function isThirdParty(src: string | undefined): src is string {
  return /^https?:\/\//.test(src ?? "");
}

export function openTag(name: string, attributes: string, assets: PageAssets): OpenedTag {
  const values = parseAttributes(name, attributes);
  const src = values.get("src");
  if (name === "iframe" && isThirdParty(src)) {
    assets.script(facadeScript);
    return { html: frameFacade(src, values), faded: true };
  }
  if (name === "iframe") {
    values.set("loading", "lazy");
  }
  if (name === "video" && src !== undefined) {
    const size = localVideoSize(src);
    if (size) {
      values.set("width", String(size.width));
      values.set("height", String(size.height));
    }
  }
  const classes = tagClasses[name] ? ` class="${tagClasses[name]}"` : "";
  const directive = name === "video" ? "<!-- [html-validate-disable-next no-autoplay] -->" : "";
  return {
    html: `${directive}<${outputTag(name)}${classes}${serializeAttributes(values)}>`,
    faded: false,
  };
}
