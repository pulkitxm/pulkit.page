import { readFileSync } from "node:fs";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { matchBlockEmbed, matchInlineEmbed } from "./embeds.mjs";
import { formatFence } from "./format-code.mjs";
import { relatedPages } from "./seo.mjs";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleRepetition: 3,
});

export function markdownPath(route) {
  return route === "/" ? "/index.md" : `${route.slice(0, -1)}.md`;
}

export function markdownOutputs(pages, site) {
  const output = new Map();
  for (const page of pages) {
    output.set(`pages${markdownPath(page.route)}`, Buffer.from(renderMarkdown(page, pages, site)));
  }
  output.set("pages/llms.txt", Buffer.from(llmsText(pages, site)));
  return output;
}

function label(text) {
  return String(text).replace(/[\\[\]]/g, "\\$&");
}

function destination(url) {
  return /[\s()<>]/.test(url) ? `<${url.replace(/>/g, "%3E")}>` : url;
}

function linkTo(text, url) {
  return `[${label(text)}](${destination(url)})`;
}

function humanize(name) {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function resolver(pages, site) {
  const routes = new Set(pages.map((page) => page.route));
  return (url) => {
    if (!url.startsWith("/") || url.startsWith("//")) {
      return url;
    }
    const [, path, suffix] = /^([^?#]*)(.*)$/.exec(url);
    return routes.has(path) ? site.url + markdownPath(path) + suffix : site.url + url;
  };
}

function isArticle(page) {
  return page.route.startsWith("/blogs/") && !page.index;
}

function collectionEntries(pages, route, collection, limit = Number.POSITIVE_INFINITY) {
  return pages
    .filter(
      (page) =>
        page.route !== route &&
        !page.index &&
        page.route.slice(0, page.route.lastIndexOf("/", page.route.length - 2) + 1) ===
          `/${collection}/`,
    )
    .sort(
      (a, b) =>
        (b.metadata.date ?? "").localeCompare(a.metadata.date ?? "") ||
        a.metadata.title.localeCompare(b.metadata.title),
    )
    .slice(0, limit);
}

function entryLine(page, resolve) {
  const { metadata } = page;
  const detail = metadata.role
    ? [metadata.role, metadata.period].filter(Boolean).join(", ")
    : metadata.date
      ? shortDate(metadata.date)
      : "";
  return `- ${linkTo(metadata.title, resolve(page.route))}${detail ? `: ${detail}` : ""}`;
}

function quote(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function embedMarkdown(name, props, resolve, inline, notes) {
  const image = (src, alt = "") => `![${label(alt)}](${destination(resolve(src))})`;
  switch (name) {
    case "math":
      return props.block && !inline ? `$$\n${props.formula}\n$$` : `$${props.formula}$`;
    case "cmd-key":
      return "Cmd";
    case "info-tip":
      notes.push(props.tip);
      return `${props.text}[^${notes.length}]`;
    case "image-popup":
      return linkTo(props.children ?? props.alt, resolve(props.src));
    case "image":
      return image(props.src, props.alt);
    case "blog-image":
      return props.caption
        ? `${image(props.src, props.alt)}\n\n*${props.caption.replace(/[*\\]/g, "\\$&")}*`
        : image(props.src, props.alt);
    case "image-grid":
    case "blog-gallery":
      return props.images
        .map((entry) =>
          typeof entry === "string" ? image(entry) : image(entry.src, entry.alt ?? ""),
        )
        .join("\n\n");
    case "contact-links":
      return props.links
        .map((link) => `- **${link.label}:** ${linkTo(link.value, link.href)}`)
        .join("\n");
    case "document-tabs":
      return props.documents
        .map((document) => `- ${linkTo(document.title, resolve(document.documentUrl))} (PDF)`)
        .join("\n");
    case "document-viewer":
      return `${linkTo(props.title, resolve(props.documentUrl))} (PDF)`;
    case "install-tabs":
      return `\`\`\`sh\nnpm install ${props.packages}\n\`\`\``;
    case "tech-badges":
      return props.technologies.map((technology) => `- ${technology}`).join("\n");
    case "tweet":
    case "tweet-embed":
      return `${quote(props.content)}\n>\n> ${linkTo("View the post on X", props.tweetUrl)}`;
    case "replies-carousel":
      return props.replies
        .map(
          (reply) =>
            `${quote(reply.content)}\n>\n> ${linkTo(`${reply.name} (@${reply.username})`, reply.link)}`,
        )
        .join("\n\n");
    case "youtube-embed":
      return linkTo(
        `Watch on YouTube: ${props.title}`,
        `https://www.youtube.com/watch?v=${props.videoId}`,
      );
    default:
      throw new Error(`No Markdown fallback for embed: ${name}`);
  }
}

function demoMarkdown(name, variant, pageUrl) {
  const key = variant ? `${name}-${variant}` : name;
  const showcase = JSON.parse(
    readFileSync(new URL(`../demos/showcases/${key}.json`, import.meta.url), "utf8"),
  );
  const heading = `**Interactive demo: ${humanize(showcase.component)}.** ${linkTo("Try it on the page", pageUrl)}.`;
  const files = showcase.files.map(
    (file) =>
      `\`${file.filename}\`\n\n\`\`\`${file.language}\n${formatFence(file.language, file.code).trimEnd()}\n\`\`\``,
  );
  return [heading, ...files].join("\n\n");
}

function codeRanges(body) {
  const ranges = [];
  (function walk(node) {
    if (node.type === "code") {
      ranges.push([node.position.start.offset, node.position.end.offset]);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  })(markdown.parse(body));
  return ranges;
}

function outsideCode(body, transform) {
  let output = "";
  let cursor = 0;
  for (const [start, end] of codeRanges(body)) {
    output += transform(body.slice(cursor, start)) + body.slice(start, end);
    cursor = end;
  }
  return output + transform(body.slice(cursor));
}

function tokenize(body, context) {
  const { resolve, snippets, notes, page, pages } = context;
  const token = (value) => {
    snippets.push(value);
    return `MDSNIPPET${snippets.length - 1}X`;
  };
  const pageUrl = context.site.url + page.route;
  return outsideCode(body, (segment) => {
    let text = segment
      .replace(/^:::embed [^\n]*\n[^\n]*\n:::$/gm, (block) => {
        const { name, props } = matchBlockEmbed(`${block}\n`);
        return token(embedMarkdown(name, props, resolve, false, notes));
      })
      .replace(/^:::demo ([a-z0-9-]+)(?: ([a-z0-9-]+))?[ \t]*$/gm, (_, name, variant) =>
        token(demoMarkdown(name, variant, pageUrl)),
      )
      .replace(/^:::list ([a-z0-9/-]+)(?: limit=([1-9][0-9]*))?[ \t]*$/gm, (_, collection, limit) =>
        token(
          collectionEntries(pages, page.route, collection, Number(limit) || undefined)
            .map((entry) => entryLine(entry, resolve))
            .join("\n"),
        ),
      )
      .replace(/^:::carousel[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_, images) =>
        token(
          [...images.matchAll(/!\[([^\]\n]+)\]\(([^)\s]+)\)/g)]
            .map(([, alt, src]) => `![${label(alt)}](${destination(resolve(src))})`)
            .join("\n\n"),
        ),
      );
    let scan = text.indexOf(":embed[");
    while (scan !== -1) {
      const match = matchInlineEmbed(text.slice(scan));
      if (match) {
        text = `${text.slice(0, scan)}${token(embedMarkdown(match.name, match.props, resolve, true, notes))}${text.slice(scan + match.raw.length)}`;
      }
      scan = text.indexOf(":embed[", scan + 1);
    }
    return text;
  });
}

function attribute(html, name) {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(html)?.[1];
  return value
    ?.replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function textOf(node) {
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

function mediaLink(html, resolve) {
  const source = attribute(html, "src");
  const value = html.startsWith("<video")
    ? linkTo(`Video: ${attribute(html, "title") ?? source.split("/").pop()}`, resolve(source))
    : linkTo(`Live demo: ${attribute(html, "title")}`, source);
  return { type: "html", value };
}

function blockHtml(node, resolve) {
  const value = node.value.trim();
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

function inlineHtml(children, resolve, inTable) {
  const output = [];
  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    if (node.type !== "html") {
      output.push(node);
      continue;
    }
    const tag = /^<(\/?)([a-z]+)[^>]*>/.exec(node.value.trim());
    if (!tag) {
      throw new Error(`No Markdown fallback for HTML: ${node.value.slice(0, 60)}`);
    }
    const [, closing, name] = tag;
    if (name === "br") {
      output.push(inTable ? node : { type: "break" });
    } else if (!closing && (name === "video" || name === "iframe")) {
      output.push(mediaLink(node.value.trim(), resolve));
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
    } else if (!["small", "u", "center", "div", "track", "video", "iframe"].includes(name)) {
      throw new Error(`No Markdown fallback for HTML: ${node.value}`);
    }
  }
  return output;
}

function transformTree(node, resolve, inTable = false) {
  if (node.type === "link" || node.type === "image" || node.type === "definition") {
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

function header(page, pages, site, resolve) {
  const { metadata } = page;
  const facts = [`- URL: ${site.url}${page.route}`];
  if (isArticle(page) && metadata.date) {
    facts.push(`- Published: ${shortDate(metadata.date)}`);
  }
  if (metadata.role) {
    facts.push(`- Role: ${metadata.role}`);
  }
  if (metadata.period) {
    facts.push(`- Period: ${metadata.period}`);
  }
  if (metadata.tags?.length) {
    facts.push(`- Tags: ${metadata.tags.join(", ")}`);
  }
  const parents = pages
    .filter(
      (candidate) =>
        candidate.index && candidate.route !== page.route && page.route.startsWith(candidate.route),
    )
    .sort((a, b) => b.route.length - a.route.length);
  if (parents.length) {
    facts.push(`- Part of: ${linkTo(parents[0].metadata.title, resolve(parents[0].route))}`);
  }
  return `# ${metadata.title}\n\n${quote(metadata.description)}\n\n${facts.join("\n")}`;
}

function footer(page, pages, resolve) {
  const sections = [];
  const collections = pages.filter(
    (candidate) =>
      page.route !== "/" &&
      candidate.index &&
      candidate.route !== page.route &&
      candidate.route.startsWith(page.route) &&
      !pages.some(
        (parent) =>
          parent.index &&
          parent.route !== page.route &&
          parent.route !== candidate.route &&
          candidate.route.startsWith(parent.route) &&
          parent.route.startsWith(page.route),
      ),
  );
  if (collections.length) {
    sections.push(
      `## Explore collections\n\n${collections.map((entry) => `- ${linkTo(entry.metadata.title, resolve(entry.route))}`).join("\n")}`,
    );
  }
  const related = relatedPages(page.route, page.metadata, pages);
  if (related.length) {
    sections.push(
      `## Related writing\n\n${related.map((entry) => entryLine(entry, resolve)).join("\n")}`,
    );
  }
  return sections.join("\n\n");
}

export function renderMarkdown(page, pages, site) {
  const resolve = resolver(pages, site);
  const snippets = [];
  const notes = [];
  const body = tokenize(page.body, { resolve, snippets, notes, page, pages, site });
  const tree = markdown.parse(body);
  transformTree(tree, resolve);
  const content = markdown
    .stringify(tree)
    .replace(/MDSNIPPET(\d+)X/g, (_, index) => snippets[Number(index)])
    .trim();
  const footnotes = notes.map((note, index) => `[^${index + 1}]: ${note}`).join("\n");
  return `${[header(page, pages, site, resolve), content, footer(page, pages, resolve), footnotes]
    .filter(Boolean)
    .join("\n\n")}\n`;
}

export function llmsText(pages, site) {
  const resolve = resolver(pages, site);
  const home = pages.find((page) => page.route === "/");
  const collections = pages
    .filter((page) => page.index)
    .sort((a, b) => a.route.localeCompare(b.route));
  const describe = (page) => {
    const { metadata } = page;
    const detail = metadata.role
      ? `${metadata.role}, ${metadata.period}. `
      : isArticle(page) && metadata.date
        ? `${shortDate(metadata.date)}. `
        : "";
    return `- ${linkTo(metadata.title, resolve(page.route))}: ${detail}${metadata.description.replace(/\s+/g, " ")}`;
  };
  const standalone = pages
    .filter((page) => page.route !== "/" && !page.index && page.route.split("/").length === 3)
    .sort((a, b) => a.route.localeCompare(b.route));
  const sections = [
    `## Pages\n\n${[home, ...standalone].map(describe).join("\n")}`,
    ...collections.map((collection) => {
      const parent = collection.route.slice(1, -1);
      const entries = collectionEntries(pages, collection.route, parent);
      return `## ${collection.metadata.title}\n\n${[collection, ...entries].map(describe).join("\n")}`;
    }),
  ];
  return `# ${site.brand}\n\n> ${home.metadata.description}\n\nEvery page on ${new URL(site.url).host} is also published as Markdown: add \`.md\` to the page path, for example ${site.url}/about.md for ${site.url}/about/. The homepage is ${site.url}/index.md. The links below point at those Markdown versions.\n\n${sections.join("\n\n")}\n`;
}
