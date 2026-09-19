import { unescapeHtml as decode, escapeHtml } from "@pulkit/shared/html";
import { readJson } from "./lib/embed-json.ts";
import { lightboxStyle } from "./lib/lightbox.ts";
import { readRecord } from "./lib/props.ts";
import { openTag } from "./raw-html/open-tag.ts";
import { allowedTags, outputTag, voidTags } from "./raw-html/tag-rules.ts";
import { renderers } from "./renderers/registry.ts";
import type { EmbedMatch, EmbedProps, PageAssets } from "./types.ts";

export type { EmbedMatch, EmbedProps, PageAssets };

const interactionStyles = new Set([lightboxStyle]);

function parseProps(value: unknown, name: string): EmbedProps {
  return readRecord(value, `${name} embed properties`);
}

export function matchInlineEmbed(source: string): EmbedMatch | undefined {
  const head = /^:embed\[([a-z][a-z0-9-]*)\]\{/.exec(source);
  const name = head?.[1];
  if (!(head && name)) {
    return;
  }
  const { value, end } = readJson(source, head[0].length);
  if (source[end] !== "}") {
    throw new Error(`Inline embed must close with "}": ${source.slice(0, 80)}`);
  }
  return { raw: source.slice(0, end + 1), name, props: parseProps(value, name) };
}

export function matchBlockEmbed(source: string): EmbedMatch | undefined {
  const match = /^:::embed ([a-z][a-z0-9-]*)\n(\{[^\n]*\})\n:::(?:\n|$)/.exec(source);
  const name = match?.[1];
  const json = match?.[2];
  if (!(match && name && json)) {
    return;
  }
  return { raw: match[0], name, props: parseProps(JSON.parse(json), name) };
}

function styleTag(href: string): string {
  return interactionStyles.has(href)
    ? `<link rel="stylesheet" href="${href}" media="print" data-lightbox-style>`
    : `<link rel="stylesheet" href="${href}">`;
}

export function createPageAssets(): PageAssets {
  const styles = new Set<string>();
  const scripts = new Set<string>();
  const claimed = new Set<string>();
  return {
    style: (href) => {
      styles.add(href);
    },
    script: (src) => {
      scripts.add(src);
    },
    claim: (key) => {
      if (claimed.has(key)) {
        return false;
      }
      claimed.add(key);
      return true;
    },
    tags: () =>
      [
        ...[...styles].map(styleTag),
        ...[...scripts].map((src) => `<script type="module" src="${src}"></script>`),
      ].join(""),
  };
}

export function renderEmbed(
  name: string,
  props: EmbedProps,
  assets: PageAssets,
  inline: boolean,
): string {
  const render = renderers.get(name);
  if (!render) {
    throw new Error(`Unknown embed: ${name}`);
  }
  return render(props, { assets, inline, escapeHtml });
}

export function renderRawHtml(source: string, assets: PageAssets): string {
  let output = "";
  let rest = source;
  let faded = false;
  while (rest.length > 0) {
    const embed = rest.startsWith(":embed[") ? matchInlineEmbed(rest) : undefined;
    if (embed) {
      output += renderEmbed(embed.name, embed.props, assets, true);
      rest = rest.slice(embed.raw.length);
      continue;
    }
    const tag = /^<(\/?)([a-z]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/.exec(rest);
    if (tag) {
      const [raw, closing, name = "", attributes = ""] = tag;
      if (!allowedTags.has(name)) {
        throw new Error(`Raw <${name}> is not allowed`);
      }
      if (closing) {
        if (name === "iframe" && faded) {
          faded = false;
          output += "</div>";
        } else if (!voidTags.has(name)) {
          output += `</${outputTag(name)}>`;
        }
      } else if (name !== "track") {
        const result = openTag(name, attributes, assets);
        output += result.html;
        if (name === "iframe") {
          faded = result.faded;
        }
      }
      rest = rest.slice(raw.length);
      continue;
    }
    const text = /^[^<:]+|^[<:]/.exec(rest)?.[0] ?? rest;
    if (text === "<") {
      throw new Error(`Malformed raw HTML: ${rest.slice(0, 80)}`);
    }
    output += escapeHtml(decode(text));
    rest = rest.slice(text.length);
  }
  return output;
}
