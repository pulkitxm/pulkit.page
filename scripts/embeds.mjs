import { components } from "./embeds/index.mjs";

const codeFont = "[font:0.84em/1.65_var(--font-mono)]";

const tagClasses = {
  center: "mt-0 mb-6 text-center [&_img]:mx-auto",
  div: "text-balance text-center",
  details: "mt-0 mb-6 rounded-lg border border-line p-4 [&>*:last-child]:mb-0",
  summary: "cursor-pointer font-bold",
  iframe: "mt-0 mb-6 block h-[500px] w-full overflow-hidden rounded border-0",
  video: "mt-0 mb-6 block h-auto w-full rounded-lg",
  small: "-mt-4 mb-6 block text-sm text-muted",
  code: `rounded-sm bg-surface px-1 py-0.5 ${codeFont}`,
};

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

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

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
    return undefined;
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

export function createPageAssets() {
  const styles = new Set();
  const scripts = new Set();
  return {
    style: (href) => styles.add(href),
    script: (src) => scripts.add(src),
    tags: () =>
      [
        ...[...styles].map((href) => `<link rel="stylesheet" href="${href}">`),
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

function attributesFor(tag, source) {
  const allowed = allowedAttributes[tag] ?? [];
  const output = [];
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
    output.push(decoded === undefined ? ` ${name}` : ` ${name}="${escapeHtml(decoded)}"`);
  }
  if (tag === "iframe") {
    output.push(' loading="lazy"');
  }
  return output.join("");
}

export function renderRawHtml(source, assets) {
  let output = "";
  let rest = source;
  while (rest.length) {
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
      const outputName = renamedTags[name] ?? name;
      if (closing) {
        output += voidTags.has(name) ? "" : `</${outputName}>`;
      } else {
        const classes = tagClasses[name] ? ` class="${tagClasses[name]}"` : "";
        if (name === "track") {
          rest = rest.slice(raw.length);
          continue;
        }
        const directive =
          name === "video" ? "<!-- [html-validate-disable-next no-autoplay] -->" : "";
        output += `${directive}<${outputName}${classes}${attributesFor(name, attributes)}>`;
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
