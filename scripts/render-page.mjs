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
    "endDate",
    "icon",
    "secondaryIcon",
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
function listingDate(metadata, exact = false, recent = false) {
  if (metadata.period || !metadata.date) {
    return escapeHtml(metadata.period ?? "");
  }
  const month = new Intl.DateTimeFormat("en-US", {
    day: exact || recent ? "numeric" : undefined,
    month: "short",
    year:
      recent && Number(metadata.date.slice(0, 4)) === new Date().getUTCFullYear()
        ? undefined
        : "numeric",
    timeZone: "UTC",
  }).format(new Date(metadata.date));
  return `<time datetime="${escapeHtml(metadata.date)}">${month}</time>`;
}
function experiencePeriod(metadata) {
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const exact = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const date = (value) =>
    `<time class="cursor-help underline decoration-line decoration-dotted underline-offset-4" datetime="${escapeHtml(value)}" title="${exact.format(new Date(value))}">${month.format(new Date(value))}</time>`;
  return `${date(metadata.date)} – ${metadata.endDate ? date(metadata.endDate) : "present"}`;
}
function experienceEntry(page) {
  const { metadata } = page;
  const icons = [metadata.icon, metadata.secondaryIcon]
    .filter(Boolean)
    .map(
      (icon, index) =>
        `<img class="${index ? "m-0 -ml-6 translate-y-2.5" : "m-0"} size-9 rounded-[10px] border-2 border-bg bg-icon object-contain" src="${safeUrl(icon)}" alt="" width="36" height="36" loading="lazy">`,
    )
    .join("");
  return `<li class="border-b border-line"><a class="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center justify-between gap-4 py-5 leading-[1.5] no-underline max-sm:grid-cols-[48px_minmax(0,1fr)] max-sm:gap-3" href="${safeUrl(page.route)}"><span class="flex w-12 items-center max-sm:row-span-2">${icons}</span><span class="grid gap-0.75"><span class="group-hover:underline" data-title>${escapeHtml(metadata.title)}</span><span class="text-xs text-muted">${escapeHtml(metadata.role)}</span></span><span class="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums max-sm:col-start-2 max-sm:text-2xs">${experiencePeriod(metadata)}</span></a></li>`;
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
          const grouped = route === "/blogs/" && token.collection === "blogs";
          const list = (entries) =>
            `<ul class="list-none p-0">${entries
              .map((page) =>
                page.metadata.icon
                  ? experienceEntry(page)
                  : `<li class="border-b border-line"><a class="group flex items-baseline justify-between gap-5 py-3.75 leading-[1.5] no-underline max-sm:gap-3" href="${safeUrl(page.route)}"><span class="group-hover:underline" data-title>${escapeHtml(page.metadata.title)}</span><span class="shrink-0 text-xs text-muted max-sm:text-2xs">${listingDate(page.metadata, grouped, route === "/" && token.collection === "blogs")}</span></a></li>`,
              )
              .join("")}</ul>`;
          if (!grouped) {
            return list(items);
          }
          const years = new Map();
          for (const page of items) {
            const year = page.metadata.date.slice(0, 4);
            if (!years.has(year)) {
              years.set(year, []);
            }
            years.get(year).push(page);
          }
          return [...years]
            .map(
              ([year, entries]) =>
                `<h2 class="mt-10 mb-2 flex items-center gap-4 text-md font-[500] tracking-normal text-muted after:h-px after:flex-1 after:bg-line">${escapeHtml(year)}</h2>${list(entries)}`,
            )
            .join("");
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
      title: escapeHtml(pageTitle(metadata, site, route)),
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
          ? `<p class="text-sm text-muted">${[escapeHtml(metadata.role ?? ""), metadata.icon ? experiencePeriod(metadata) : escapeHtml(metadata.period ?? ""), detail].filter(Boolean).join(" · ")}</p>`
          : "",
      content: await markdown.parse(body),
    }),
  );
}

function breadcrumbs(route, pages) {
  const parents = ancestors(route, pages);
  return parents.length
    ? `<nav class="mb-8 text-[0.8rem]" aria-label="Breadcrumb"><ol class="flex list-none flex-wrap gap-2 p-0 [&>li+li]:before:mr-2 [&>li+li]:before:opacity-50 [&>li+li]:before:content-['/']">${parents.map((page) => `<li><a href="${escapeHtml(page.route)}">${escapeHtml(page.route === "/" ? "Home" : page.metadata.title)}</a></li>`).join("")}<li aria-current="page">${escapeHtml(pages.find((page) => page.route === route)?.metadata.title ?? "Current page")}</li></ol></nav>`
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
          `<li class="my-2"><a href="${escapeHtml(page.route)}">${escapeHtml(page.metadata.title)}</a></li>`,
      )
      .join("");
  return `${collections.length && route !== "/" ? `<nav class="mt-12 text-[0.9rem]" aria-label="Collections"><h2 class="text-[1rem]">Explore collections</h2><ul>${links(collections)}</ul></nav>` : ""}${related.length ? `<nav class="mt-12 text-[0.9rem]" aria-label="Related writing"><h2 class="text-[1rem]">Related writing</h2><ul>${links(related)}</ul></nav>` : ""}`;
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
  ["og:title", pageTitle(metadata, site, route)],
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
  ["twitter:title", pageTitle(metadata, site, route)],
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

export function renderDependencies(page, pages, site) {
  return {
    year: page.route === "/" ? new Date().getUTCFullYear() : undefined,
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
          entry.metadata.endDate,
          entry.metadata.icon,
          entry.metadata.secondaryIcon,
          entry.metadata.role,
        ]),
    ),
  };
}
