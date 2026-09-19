import { escapeHtml } from "@pulkit/shared/html";
import { lightboxStyle } from "./lightbox.mjs";
import { components } from "./registry.mjs";
import { localVideoSize } from "./video-size.mjs";

const codeFont = "[font:0.84em/1.65_var(--font-mono)]";
const frameBox = "mt-0 mb-6 block h-[500px] w-full overflow-hidden rounded";

const tagClasses = {
  center: "mt-0 mb-6 text-center [&_img]:mx-auto",
  div: "text-balance text-center",
  details: "mt-0 mb-6 rounded-lg border border-line p-4 [&>*:last-child]:mb-0",
  summary: "cursor-pointer font-bold",
  iframe: `${frameBox} border-0`,
  video: "mt-0 mb-6 block h-auto w-full rounded-lg",
  small: "-mt-4 mb-6 block text-sm text-muted",
  code: `rounded-sm bg-surface px-1 py-0.5 ${codeFont}`,
};

const facadeClasses = {
  root: `relative ${frameBox} border border-line bg-surface`,
  panel:
    "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center [&[hidden]]:hidden",
  button:
    "inline-flex cursor-pointer items-center justify-center rounded-md border border-line bg-bg px-4 py-2 font-medium text-fg text-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2",
  note: "m-0 max-w-[32rem] text-balance text-muted text-sm",
  link: "text-muted text-xs underline-offset-4 hover:text-fg",
  frame: "absolute inset-0 size-full border-0",
};

const facadeScript = "/assets/embeds/frame-facade.js";
const interactionStyles = new Set([lightboxStyle]);

const allowedAttributes = {
  iframe: ["src", "title", "allow", "sandbox"],
  video: ["src", "title", "autoplay", "loop", "muted", "playsinline", "controls"],
  track: ["kind"],
  details: ["open"],
};

const renamedTags = { center: "div" };
const voidTags = new Set(["br", "track"]);
const allowedTags = new Set([
  "br",
  "center",
  "code",
  "details",
  "div",
  "iframe",
  "small",
  "strong",
  "summary",
  "track",
  "u",
  "video",
]);
const trustedFrames = /^https:\/\/codesandbox\.io\/embed\//;
let facades = 0;

function decode(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function readJson(source, start) {
  let depth = 0;
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "\\") {
        index += 1;
      } else if (character === '"') {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: JSON.parse(source.slice(start, index + 1)), end: index + 1 };
      }
    }
  }
  throw new Error(`Unterminated embed properties: ${source.slice(start, start + 80)}`);
}

export function matchInlineEmbed(source) {
  const head = /^:embed\[([a-z][a-z0-9-]*)\]\{/.exec(source);
  if (!head) {
    return;
  }
  const { value, end } = readJson(source, head[0].length);
  if (source[end] !== "}") {
    throw new Error(`Inline embed must close with "}": ${source.slice(0, 80)}`);
  }
  return { raw: source.slice(0, end + 1), name: head[1], props: value };
}

export function matchBlockEmbed(source) {
  const match = /^:::embed ([a-z][a-z0-9-]*)\n(\{[^\n]*\})\n:::(?:\n|$)/.exec(source);
  return match ? { raw: match[0], name: match[1], props: JSON.parse(match[2]) } : undefined;
}

function styleTag(href) {
  return interactionStyles.has(href)
    ? `<link rel="stylesheet" href="${href}" media="print" data-lightbox-style>`
    : `<link rel="stylesheet" href="${href}">`;
}

export function createPageAssets() {
  const styles = new Set();
  const scripts = new Set();
  const claimed = new Set();
  return {
    style: (href) => styles.add(href),
    script: (src) => scripts.add(src),
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

export function renderEmbed(name, props, assets, inline) {
  const component = components[name];
  if (!component) {
    throw new Error(`Unknown embed: ${name}`);
  }
  return component.render(props, { assets, inline, escapeHtml });
}

function parseAttributes(tag, source) {
  const allowed = allowedAttributes[tag] ?? [];
  const values = new Map();
  for (const [, name, , value] of source.matchAll(/([a-z-]+)(="([^"]*)")?/g)) {
    if (!allowed.includes(name)) {
      throw new Error(`Attribute ${name} is not allowed on <${tag}>`);
    }
    const decoded = value === undefined ? undefined : decode(value);
    if (name === "src" && tag === "iframe" && !trustedFrames.test(decoded)) {
      throw new Error(`Untrusted iframe source: ${decoded}`);
    }
    if (name === "src" && tag === "video" && !decoded.startsWith("/assets/")) {
      throw new Error(`Video must come from /assets/: ${decoded}`);
    }
    values.set(name, decoded);
  }
  return values;
}

function serializeAttributes(values) {
  return [...values]
    .map(([name, value]) => (value === undefined ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`))
    .join("");
}

function isThirdParty(src) {
  return /^https?:\/\//.test(src ?? "");
}

function dataAttribute(name, value) {
  return value === undefined ? "" : ` ${name}="${escapeHtml(value)}"`;
}

function frameFacade(values) {
  const src = values.get("src");
  const host = escapeHtml(new URL(src).hostname);
  const href = escapeHtml(src);
  facades += 1;
  const note = `frame-note-${facades}`;
  const away = `<a class="${facadeClasses.link}" href="${href}" target="_blank" rel="noopener noreferrer">Open on ${host}</a>`;
  const data = [
    dataAttribute("data-frame-src", src),
    dataAttribute("data-frame-title", values.get("title")),
    dataAttribute("data-frame-class", facadeClasses.frame),
    dataAttribute("data-frame-sandbox", values.get("sandbox")),
    dataAttribute("data-frame-allow", values.get("allow")),
  ].join("");
  return [
    `<div class="${facadeClasses.root}" data-frame-facade${data}>`,
    `<div class="${facadeClasses.panel}" data-frame-panel="offer">`,
    `<button type="button" class="${facadeClasses.button}" data-frame-run aria-describedby="${note}">Run this sandbox</button>`,
    `<p id="${note}" class="${facadeClasses.note}">Runs ${host} in an embedded frame, which loads third-party code and cookies.</p>`,
    away,
    "</div>",
    `<div class="${facadeClasses.panel}" data-frame-panel="loading" hidden>`,
    `<p class="${facadeClasses.note}" role="status">Loading the sandbox...</p>`,
    "</div>",
    `<div class="${facadeClasses.panel}" data-frame-panel="error" hidden>`,
    `<p class="${facadeClasses.note}" role="alert">This sandbox could not be loaded.</p>`,
    `<button type="button" class="${facadeClasses.button}" data-frame-run>Try again</button>`,
    away,
    "</div>",
  ].join("");
}

function openTag(name, attributes, assets) {
  const values = parseAttributes(name, attributes);
  if (name === "iframe" && isThirdParty(values.get("src"))) {
    assets.script(facadeScript);
    return { html: frameFacade(values), faded: true };
  }
  if (name === "iframe") {
    values.set("loading", "lazy");
  }
  if (name === "video") {
    const size = localVideoSize(values.get("src"));
    if (size) {
      values.set("width", String(size.width));
      values.set("height", String(size.height));
    }
  }
  const outputName = renamedTags[name] ?? name;
  const classes = tagClasses[name] ? ` class="${tagClasses[name]}"` : "";
  const directive = name === "video" ? "<!-- [html-validate-disable-next no-autoplay] -->" : "";
  return { html: `${directive}<${outputName}${classes}${serializeAttributes(values)}>` };
}

export function renderRawHtml(source, assets) {
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
      const [raw, closing, name, attributes] = tag;
      if (!allowedTags.has(name)) {
        throw new Error(`Raw <${name}> is not allowed`);
      }
      if (closing) {
        if (name === "iframe" && faded) {
          faded = false;
          output += "</div>";
        } else if (!voidTags.has(name)) {
          output += `</${renamedTags[name] ?? name}>`;
        }
      } else if (name !== "track") {
        const result = openTag(name, attributes, assets);
        output += result.html;
        if (name === "iframe") {
          faded = Boolean(result.faded);
        }
      }
      rest = rest.slice(raw.length);
      continue;
    }
    const text = /^[^<:]+|^[<:]/.exec(rest)[0];
    if (text === "<") {
      throw new Error(`Malformed raw HTML: ${rest.slice(0, 80)}`);
    }
    output += escapeHtml(decode(text));
    rest = rest.slice(text.length);
  }
  return output;
}
