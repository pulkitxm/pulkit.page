import { Marked } from "marked";
import { parse } from "yaml";
import { formatFence } from "./format-code.mjs";
import { formatHtml } from "./format-html.mjs";
import { highlightFence } from "./highlight.mjs";
import { applyLayout, loadLayouts } from "./layouts.mjs";
import { ancestors, imagePath, pageTitle, relatedPages, safeJson, structuredData } from "./seo.mjs";

export function readPage(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) {
    throw new Error("Markdown must start with YAML frontmatter");
  }
  const metadata = parse(match[1]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("YAML frontmatter must be a mapping");
  }
  for (const field of [
    "title",
    "description",
    "date",
    "role",
    "period",
    "layout",
    "brand",
    "copyright",
  ]) {
    if (
      metadata[field] !== undefined &&
      (typeof metadata[field] !== "string" || !metadata[field].trim())
    ) {
      throw new Error(`${field} must be a nonempty string`);
    }
  }
  return { metadata, body: match[2] };
}
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}
function safeUrl(value) {
  if (typeof value !== "string" || !/^(?:\/(?!\/)|https:\/\/|mailto:|#)/.test(value)) {
    throw new Error(`Invalid link: ${value}`);
  }
  return escapeHtml(value);
}
export async function renderPage(
  source,
  { layouts = loadLayouts(), site = {}, pages = [], route = "/", cache } = {},
) {
  const { metadata, body } = readPage(source);
  if (typeof metadata?.title !== "string" || !metadata.title.trim()) {
    throw new Error("title must be a nonempty string");
  }
  const layout =
    metadata.layout ??
    (route.startsWith("/blogs/") && !pages.find((page) => page.route === route)?.index
      ? "article"
      : "simple");
  const ids = new Set(["main"]);
  const markdown = new Marked({
    async: true,
    walkTokens: async (token) => {
      if (token.type === "code") {
        const language = token.lang ?? "";
        const text = token.text;
        const render = () => highlightFence(language, formatFence(language, text));
        token.text = await (cache ? cache.get("fence", [language, text], render) : render());
        token.escaped = true;
      }
    },
    renderer: {
      heading(token) {
        const depth = Math.max(2, token.depth);
        let base = token.text
          .toLowerCase()
          .replace(/<[^>]*>/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (!/^[a-z]/.test(base)) {
          base = `section-${base || "heading"}`;
        }
        let id = base;
        let suffix = 1;
        while (ids.has(id)) {
          id = `${base}-${suffix++}`;
        }
        ids.add(id);
        return `<h${depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${depth}>`;
      },
      html(token) {
        return escapeHtml(token.text);
      },
      image(token) {
        return `<img src="${safeUrl(token.href)}" alt="${escapeHtml(token.text)}" loading="lazy">`;
      },
    },
  });
  markdown.use({
    extensions: [
      {
        name: "listing",
        level: "block",
        start: (src) => src.indexOf(":::list"),
        tokenizer(src) {
          const match = /^:::list ([a-z0-9/-]+)(?: limit=([1-9][0-9]*))?\s*(?:\n|$)/.exec(src);
          if (!match && /^:::list\b/.test(src)) {
            throw new Error("Invalid list directive; use :::list collection limit=5");
          }
          if (match) {
            return {
              type: "listing",
              raw: match[0],
              collection: match[1],
              limit: Number(match[2]) || Number.POSITIVE_INFINITY,
            };
          }
        },
        renderer(token) {
          const items = collectionItems(pages, route, token.collection, token.limit);
          if (!items.length) {
            throw new Error(`Empty or unknown collection: ${token.collection}`);
          }
          return `<ul class="entry-list">${items
            .slice(0, token.limit)
            .map(
              (page) =>
                `<li><a class="entry-link" href="${safeUrl(page.route)}"><span class="entry-title">${escapeHtml(page.metadata.title)}</span><span class="entry-meta">${escapeHtml(page.metadata.period ?? page.metadata.date?.slice(0, 4) ?? "")}</span></a></li>`,
            )
            .join("")}</ul>`;
        },
      },
    ],
  });
  if (
    metadata.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) ||
      Number.isNaN(Date.parse(metadata.date)) ||
      new Date(metadata.date).toISOString().slice(0, 10) !== metadata.date)
  ) {
    throw new Error("date must be a valid YYYY-MM-DD string");
  }
  const links = (items = [], navigation = false) =>
    items
      .map(
        (item) =>
          `<a href="${safeUrl(item.href)}"${navigation && item.href === route ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`,
      )
      .join(navigation ? "\n" : " · ");
  const detail =
    metadata.date && !metadata.period
      ? `<time datetime="${metadata.date}">${escapeHtml(metadata.date)}</time>`
      : "";
  return formatHtml(
    applyLayout(layouts, layout, {
      title: escapeHtml(pageTitle(metadata, site)),
      seo: site.url ? seoHead(route, metadata, site, pages) : "",
      breadcrumbs: breadcrumbs(route, pages),
      related: relatedNavigation(route, metadata, pages),
      description: escapeHtml(metadata.description ?? site.description ?? metadata.title),
      brand: escapeHtml(site.brand ?? "Pulkit"),
      navigation: links(site.navigation, true),
      social: links(site.social),
      copyright: escapeHtml(site.copyright ?? ""),
      heading: escapeHtml(metadata.title),
      date:
        detail || metadata.role
          ? `<p class="detail-meta">${[escapeHtml(metadata.role ?? ""), escapeHtml(metadata.period ?? ""), detail].filter(Boolean).join(" · ")}</p>`
          : "",
      content: await markdown.parse(body),
    }),
  );
}

function breadcrumbs(route, pages) {
  const parents = ancestors(route, pages);
  return parents.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${parents.map((page) => `<li><a href="${escapeHtml(page.route)}">${escapeHtml(page.route === "/" ? "Home" : page.metadata.title)}</a></li>`).join("")}<li aria-current="page">${escapeHtml(pages.find((page) => page.route === route)?.metadata.title ?? "Current page")}</li></ol></nav>`
    : "";
}
function relatedNavigation(route, metadata, pages) {
  const related = relatedPages(route, metadata, pages);
  const collections = pages.filter(
    (page) =>
      page.index &&
      page.route !== route &&
      page.route.startsWith(route) &&
      !pages.some(
        (parent) =>
          parent.index &&
          parent.route !== route &&
          parent.route !== page.route &&
          page.route.startsWith(parent.route) &&
          parent.route.startsWith(route),
      ),
  );
  const links = (entries) =>
    entries
      .map(
        (page) =>
          `<li><a href="${escapeHtml(page.route)}">${escapeHtml(page.metadata.title)}</a></li>`,
      )
      .join("");
  return `${collections.length && route !== "/" ? `<nav class="related" aria-label="Collections"><h2>Explore collections</h2><ul>${links(collections)}</ul></nav>` : ""}${related.length ? `<nav class="related" aria-label="Related writing"><h2>Related writing</h2><ul>${links(related)}</ul></nav>` : ""}`;
}
function seoHead(route, metadata, site, pages) {
  const url = site.url + route;
  const image = site.url + imagePath(route);
  const article = route.startsWith("/blogs/") && !pages.find((page) => page.route === route)?.index;
  const meta = (name, content, property = false) =>
    `<meta ${property ? "property" : "name"}="${name}" content="${escapeHtml(content)}" />`;
  return `<link rel="canonical" href="${escapeHtml(url)}" />
${meta("robots", "index, follow, max-image-preview:large")}
${[
  ["og:type", article ? "article" : "website"],
  ["og:site_name", site.brand],
  ["og:locale", "en_US"],
  ["og:title", pageTitle(metadata, site)],
  ["og:description", metadata.description],
  ["og:url", url],
  ["og:image", image],
  ["og:image:secure_url", image],
  ["og:image:type", "image/png"],
  ["og:image:width", "1200"],
  ["og:image:height", "630"],
  ["og:image:alt", metadata.title],
]
  .map(([key, value]) => meta(key, value, true))
  .join("\n")}
${article && metadata.date ? meta("article:published_time", metadata.date, true) + meta("article:author", `${site.url}/about/`, true) : ""}
${[
  ["twitter:card", "summary_large_image"],
  ["twitter:title", pageTitle(metadata, site)],
  ["twitter:description", metadata.description],
  ["twitter:image", image],
  ["twitter:image:alt", metadata.title],
]
  .map(([key, value]) => meta(key, value))
  .join("\n")}
<script type="application/ld+json">${safeJson(structuredData(route, metadata, site, pages))}</script>`;
}

function collectionItems(pages, route, collection, limit) {
  return pages
    .filter(
      (page) => page.route !== route && !page.index && page.route.startsWith(`/${collection}/`),
    )
    .sort(
      (a, b) =>
        (b.metadata.date ?? "").localeCompare(a.metadata.date ?? "") ||
        a.metadata.title.localeCompare(b.metadata.title),
    )
    .slice(0, limit);
}

export function renderDependencies(page, pages, site) {
  return {
    seo: seoHead(page.route, page.metadata, site, pages),
    breadcrumbs: breadcrumbs(page.route, pages),
    related: relatedNavigation(page.route, page.metadata, pages),
    listings: [...page.body.matchAll(/:::list ([a-z0-9/-]+)(?: limit=([1-9][0-9]*))?/g)].map(
      ([, collection, limit]) =>
        collectionItems(
          pages,
          page.route,
          collection,
          Number(limit) || Number.POSITIVE_INFINITY,
        ).map((entry) => [
          entry.route,
          entry.metadata.title,
          entry.metadata.period,
          entry.metadata.date,
        ]),
    ),
  };
}
