import { formatFence } from "@pulkit/code/format-code";
import { formatHtml } from "@pulkit/code/format-html";
import { highlightFence } from "@pulkit/code/highlight";
import { renderDemo } from "@pulkit/demos/render";
import {
  createPageAssets,
  matchBlockEmbed,
  matchInlineEmbed,
  renderEmbed,
  renderRawHtml,
} from "@pulkit/embeds";
import { lightboxScript, lightboxStyle, localImageSize, zoomable } from "@pulkit/embeds/lightbox";
import { Marked, Renderer } from "marked";
import { parse } from "yaml";
import { applyLayout, loadLayouts } from "./layouts.mjs";
import {
  ancestors,
  articles,
  categoryOf,
  imagePath,
  isArticle,
  markdownPath,
  pageTitle,
  relatedPages,
  safeJson,
  structuredData,
} from "./seo.mjs";

const link = "text-inherit decoration-muted underline-offset-4 hover:decoration-current";
const codeFont = "[font:0.84em/1.65_var(--font-mono)]";
const blockSpacing = "mt-0 mb-6";
const headingClasses = {
  2: "mt-12 text-xl font-semibold leading-tight tracking-tight",
  3: "mt-8 text-lg leading-tight tracking-tight",
  4: "leading-tight tracking-tight",
};
const portrait = "/assets/content/pulkit-portrait.webp";
const listDirective =
  /^:::list ((?:[a-z0-9-]+:all)|[a-z0-9/-]+)(?: limit=([1-9][0-9]*))?( by-year)?\s*(?:\n|$)/;

function withClass(html, classes) {
  return html.replace(/^<(\w+)/, `<$1 class="${classes}"`);
}
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
    "darkIcon",
    "secondaryIcon",
    "layout",
    "brand",
    "articles",
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
function listingDate(metadata, grouped = false, recent = false) {
  if (metadata.period || !metadata.date) {
    return escapeHtml(metadata.period ?? "");
  }
  const thisYear = Number(metadata.date.slice(0, 4)) === new Date().getUTCFullYear();
  const month = new Intl.DateTimeFormat("en-US", {
    day: grouped || recent ? "numeric" : undefined,
    month: "short",
    year: grouped || (recent && thisYear) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(metadata.date));
  return `<time datetime="${escapeHtml(metadata.date)}">${month}</time>`;
}
function readingMinutes(body) {
  const words = body
    .replace(/```[\s\S]*?```/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
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
  const image = (icon, className) =>
    `<img class="${className} size-9 rounded-xl border-2 border-bg object-contain" src="${safeUrl(icon)}" alt="" width="36" height="36" loading="lazy">`;
  const icons = [
    metadata.darkIcon
      ? image(metadata.icon, "m-0 bg-bg dark:hidden") +
        image(metadata.darkIcon, "m-0 hidden bg-bg dark:block")
      : image(metadata.icon, "m-0 bg-icon"),
    metadata.secondaryIcon && image(metadata.secondaryIcon, "m-0 -ml-6 translate-y-2.5 bg-icon"),
  ]
    .filter(Boolean)
    .join("");
  return `<li class="border-b border-line"><a class="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center justify-between gap-4 py-5 leading-normal text-inherit no-underline underline-offset-4 max-sm:grid-cols-[48px_minmax(0,1fr)] max-sm:gap-3" href="${safeUrl(page.route)}"><span class="flex w-12 items-center max-sm:row-span-2">${icons}</span><span class="grid gap-0.75"><span class="group-hover:underline" data-title>${escapeHtml(metadata.title)}</span><span class="text-xs text-muted">${escapeHtml(metadata.role)}</span></span><span class="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums max-sm:col-start-2 max-sm:text-2xs">${experiencePeriod(metadata)}</span></a></li>`;
}
export async function renderPage(
  source,
  { layouts = loadLayouts(), site = {}, pages = [], route = "/", cache } = {},
) {
  const { metadata, body } = readPage(source);
  if (typeof metadata?.title !== "string" || !metadata.title.trim()) {
    throw new Error("title must be a nonempty string");
  }
  const article = isArticle(route, pages, site);
  const layout = metadata.layout ?? (article ? "article" : "simple");
  const ids = new Set(["main"]);
  const assets = createPageAssets();
  const zoomAttributes = (href) => {
    const size = localImageSize(href);
    assets.style(lightboxStyle);
    assets.script(lightboxScript);
    return size
      ? ` data-media-zoom data-width="${size.width}" data-height="${size.height}"`
      : " data-media-zoom";
  };
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
      if (token.type === "link") {
        for (const child of token.tokens ?? []) {
          if (child.type === "image") {
            child.linked = true;
          }
        }
      }
      if (token.type === "demo") {
        token.html = await renderDemo(token.name, token.variant);
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
        const classes = headingClasses[depth] ? ` class="${headingClasses[depth]}"` : "";
        return `<h${depth} id="${id}"${classes}>${this.parser.parseInline(token.tokens)}</h${depth}>`;
      },
      paragraph(token) {
        return withClass(Renderer.prototype.paragraph.call(this, token), blockSpacing);
      },
      list(token) {
        return withClass(Renderer.prototype.list.call(this, token), blockSpacing);
      },
      listitem(token) {
        const html = Renderer.prototype.listitem.call(this, token);
        return token.loose ? withClass(html, "[&>p]:mb-2") : html;
      },
      blockquote(token) {
        return withClass(
          Renderer.prototype.blockquote.call(this, token),
          "mx-0 mt-0 mb-6 border-l-2 border-line pl-5 text-muted",
        );
      },
      code(token) {
        const [, language, highlighted] =
          /^<pre><code(?: class="([^"]*)")?>([\s\S]*)<\/code><\/pre>\n?$/.exec(
            Renderer.prototype.code.call(this, token),
          );
        const lines = highlighted
          .replace(/\n$/, "")
          .split("\n")
          .map(
            (line) =>
              `<span class="block leading-(--pre-line) whitespace-pre">${line || "<br>"}</span>`,
          )
          .join("");
        return `<pre tabindex="0" class="mt-0 mb-6 overflow-x-auto rounded-lg border border-line bg-surface p-5 whitespace-normal [--pre-line:1lh]"><code class="${[language, "block w-max min-w-full rounded-sm", codeFont, "[tab-size:2]"].filter(Boolean).join(" ")}">${lines}</code></pre>\n`;
      },
      codespan(token) {
        return withClass(
          Renderer.prototype.codespan.call(this, token),
          `rounded-sm bg-surface px-1 py-0.5 ${codeFont}`,
        );
      },
      hr(token) {
        return withClass(
          Renderer.prototype.hr.call(this, token),
          "mx-0 my-10 border-0 border-t border-line",
        );
      },
      table(token) {
        return withClass(
          Renderer.prototype.table.call(this, token),
          "mt-0 mb-6 block overflow-x-auto border-collapse text-md",
        );
      },
      tablecell(token) {
        return withClass(
          Renderer.prototype.tablecell.call(this, token),
          "border-b border-line px-3.5 py-2.5 text-left",
        );
      },
      link(token) {
        return withClass(Renderer.prototype.link.call(this, token), link);
      },
      html(token) {
        return renderRawHtml(token.text, assets);
      },
      image(token) {
        const classes =
          token.href === portrait
            ? "mx-0 mt-0 mb-7 block size-36 max-w-full rounded-[50%] object-cover"
            : "mx-auto my-7 block h-auto max-w-full rounded-md";
        const image = `<img class="${classes}" src="${safeUrl(token.href)}" alt="${escapeHtml(token.text)}" loading="lazy">`;
        return token.href === portrait || token.linked
          ? image
          : zoomable({
              src: token.href,
              image: image.replace('class="mx-auto', 'class="cursor-zoom-in mx-auto'),
              className: "block",
              assets,
              escapeHtml,
            });
      },
    },
  });
  markdown.use({
    extensions: [
      {
        name: "embed",
        level: "block",
        start: (src) => src.indexOf(":::embed"),
        tokenizer(src) {
          const match = matchBlockEmbed(src);
          return match ? { type: "embed", ...match } : undefined;
        },
        renderer(token) {
          return renderEmbed(token.name, token.props, assets, false);
        },
      },
      {
        name: "inlineEmbed",
        level: "inline",
        start: (src) => src.indexOf(":embed["),
        tokenizer(src) {
          const match = matchInlineEmbed(src);
          return match ? { type: "inlineEmbed", ...match } : undefined;
        },
        renderer(token) {
          return renderEmbed(token.name, token.props, assets, true);
        },
      },
      {
        name: "demo",
        level: "block",
        start: (src) => src.indexOf(":::demo"),
        tokenizer(src) {
          const match = /^:::demo ([a-z0-9-]+)(?: ([a-z0-9-]+))?\s*(?:\n|$)/.exec(src);
          if (match) {
            return { type: "demo", raw: match[0], name: match[1], variant: match[2] };
          }
        },
        renderer(token) {
          return token.html;
        },
      },
      {
        name: "carousel",
        level: "block",
        start: (src) => src.indexOf(":::carousel"),
        tokenizer(src) {
          if (!/^:::carousel\b/.test(src)) {
            return;
          }
          const match = /^:::carousel[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
          const images = match
            ? [...match[1].matchAll(/!\[([^\]\n]+)\]\(([^)\s]+)\)/g)].map(([, alt, href]) => ({
                alt,
                href,
              }))
            : [];
          if (
            !match ||
            images.length < 2 ||
            match[1].replace(/!\[[^\]\n]+\]\([^)\s]+\)/g, "").trim()
          ) {
            throw new Error(
              "Invalid carousel directive; wrap two or more images in :::carousel and :::",
            );
          }
          return { type: "carousel", raw: match[0], images };
        },
        renderer(token) {
          const slides = token.images
            .map(
              (image) =>
                `<a class="block w-full shrink-0 cursor-zoom-in snap-center" href="${safeUrl(image.href)}"${zoomAttributes(image.href)}><img class="mx-auto block h-auto max-h-[70vh] w-full object-contain" src="${safeUrl(image.href)}" alt="${escapeHtml(image.alt)}" loading="lazy"></a>`,
            )
            .join("");
          const button =
            "cursor-pointer rounded-md border border-line bg-transparent px-2.5 py-1.25 text-inherit [font:inherit] disabled:cursor-default disabled:opacity-40";
          return `<figure class="mx-0 my-7" data-carousel><section class="flex snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-roledescription="carousel" aria-label="${escapeHtml(`${token.images[0].alt} and ${token.images.length - 1} more`)}" data-carousel-track>${slides}</section><figcaption class="mt-3 flex items-center justify-center gap-4 text-xs text-muted"><button class="${button}" type="button" aria-label="Previous image" data-carousel-previous>Prev</button><span aria-live="polite" data-carousel-status>1 / ${token.images.length}</span><button class="${button}" type="button" aria-label="Next image" data-carousel-next>Next</button></figcaption></figure>`;
        },
      },
      {
        name: "listing",
        level: "block",
        start: (src) => src.indexOf(":::list"),
        tokenizer(src) {
          const match = listDirective.exec(src);
          if (!match && /^:::list\b/.test(src)) {
            throw new Error("Invalid list directive; use :::list collection limit=5 by-year");
          }
          if (match) {
            return {
              type: "listing",
              raw: match[0],
              collection: match[1],
              limit: Number(match[2]) || Number.POSITIVE_INFINITY,
              grouped: Boolean(match[3]),
            };
          }
        },
        renderer(token) {
          const items = collectionItems(pages, route, token.collection, token.limit, site);
          if (items.length === 0) {
            throw new Error(`Empty or unknown collection: ${token.collection}`);
          }
          const { grouped } = token;
          const list = (entries) =>
            `<ul class="mt-0 mb-6 list-none p-0">${entries
              .map((page) =>
                page.metadata.icon
                  ? experienceEntry(page)
                  : `<li class="border-b border-line"><a class="group flex items-baseline justify-between gap-5 py-3.75 leading-normal text-inherit no-underline underline-offset-4 max-sm:gap-3" href="${safeUrl(page.route)}"><span class="group-hover:underline" data-title>${escapeHtml(page.metadata.title)}</span><span class="shrink-0 text-xs text-muted max-sm:text-2xs">${listingDate(page.metadata, grouped, Number.isFinite(token.limit))}</span></a></li>`,
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
                `<h2 class="mt-10 mb-2 flex items-center gap-4 text-md font-medium leading-tight tracking-normal text-muted after:h-px after:flex-1 after:bg-line">${escapeHtml(year)}</h2>${list(entries)}`,
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
          `<a class="${navigation ? "text-inherit no-underline aria-[current=page]:text-fg" : "text-inherit no-underline"}" href="${safeUrl(item.href)}"${navigation && item.href === route ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`,
      )
      .join(navigation ? "\n" : " · ");
  const category = categoryOf(route, pages);
  const plainDate =
    metadata.date && !metadata.period
      ? `<time datetime="${metadata.date}">${escapeHtml(metadata.date)}</time>`
      : "";
  const detail = article
    ? [
        metadata.date
          ? `<time datetime="${escapeHtml(metadata.date)}">${new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(metadata.date))}</time>`
          : "",
        `${readingMinutes(body)} min read`,
        category
          ? `<a class="${link}" href="${safeUrl(category.route)}">${escapeHtml(category.metadata.title)}</a>`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : plainDate;
  const content = await markdown.parse(body);
  return formatHtml(
    applyLayout(layouts, layout, {
      title: escapeHtml(pageTitle(metadata, site, route)),
      seo: `${site.url ? seoHead(route, metadata, site, pages) : ""}${site.articles ? `<link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.brand ?? "Feed")}" href="/feed.xml">` : ""}${assets.tags()}${body.includes(":::demo ") ? '<link rel="stylesheet" href="/assets/demos/document.css"><script type="module" src="/assets/demos/index.js"></script>' : ""}`,
      breadcrumbs: breadcrumbs(route, pages),
      related: relatedNavigation(route, metadata, pages, site),
      description: escapeHtml(metadata.description ?? site.description ?? metadata.title),
      brand: escapeHtml(site.brand ?? "Pulkit"),
      author: escapeHtml(site.author ?? ""),
      authorUrl: site.authorUrl ? safeUrl(site.authorUrl) : "/",
      navigation: links(site.navigation, true),
      social: links(site.social),
      copyright: escapeHtml(site.copyright ?? ""),
      markdown: escapeHtml(markdownPath(route)),
      heading: escapeHtml(metadata.title),
      date:
        detail || metadata.role
          ? `<p class="mt-0 mb-6 text-sm text-muted">${[escapeHtml(metadata.role ?? ""), metadata.icon ? experiencePeriod(metadata) : escapeHtml(metadata.period ?? ""), detail].filter(Boolean).join(" · ")}</p>`
          : "",
      content,
    }),
  );
}

function breadcrumbs(route, pages) {
  const parents = ancestors(route, pages);
  return parents.length > 0
    ? `<nav class="mb-8 text-[0.8rem]" aria-label="Breadcrumb"><ol class="mt-0 mb-6 flex list-none flex-wrap gap-2 p-0 [&>li+li]:before:mr-2 [&>li+li]:before:opacity-50 [&>li+li]:before:content-['/'] [&_a]:text-inherit [&_a]:decoration-muted [&_a]:underline-offset-4 [&_a:hover]:decoration-current">${parents.map((page) => `<li><a href="${escapeHtml(page.route)}">${escapeHtml(page.route === "/" ? "Home" : page.metadata.title)}</a></li>`).join("")}<li aria-current="page">${escapeHtml(pages.find((page) => page.route === route)?.metadata.title ?? "Current page")}</li></ol></nav>`
    : "";
}
function relatedNavigation(route, metadata, pages, site) {
  const related = relatedPages(route, metadata, pages, site);
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
          `<li class="my-2"><a class="${link}" href="${escapeHtml(page.route)}">${escapeHtml(page.metadata.title)}</a></li>`,
      )
      .join("");
  return `${collections.length > 0 && route !== "/" ? `<nav class="mt-12 text-[0.9rem]" aria-label="Collections"><h2 class="mt-12 text-[1rem] font-semibold leading-tight tracking-tight">Explore collections</h2><ul class="mt-0 mb-6">${links(collections)}</ul></nav>` : ""}${related.length > 0 ? `<nav class="mt-12 text-[0.9rem]" aria-label="Related writing"><h2 class="mt-12 text-[1rem] font-semibold leading-tight tracking-tight">Related writing</h2><ul class="mt-0 mb-6">${links(related)}</ul></nav>` : ""}`;
}
function seoHead(route, metadata, site, pages) {
  const url = site.url + route;
  const image = site.url + imagePath(route);
  const article = isArticle(route, pages, site);
  const meta = (name, content, property = false) =>
    `<meta ${property ? "property" : "name"}="${name}" content="${escapeHtml(content)}" />`;
  return `<link rel="canonical" href="${escapeHtml(url)}" />
<link rel="alternate" type="text/markdown" href="${escapeHtml(site.url + markdownPath(route))}" />
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
${article && metadata.date ? meta("article:published_time", metadata.date, true) + meta("article:author", site.authorUrl ?? `${site.url}/`, true) : ""}
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

export function collectionItems(pages, route, collection, limit, site) {
  const external = /^([a-z0-9-]+):all$/.exec(collection)?.[1];
  if (external && !site?.external?.[external]) {
    throw new Error(`Unknown site in list directive: ${external}`);
  }
  let entries;
  if (external) {
    entries = site.external[external];
  } else if (collection === "all") {
    entries = articles(pages, site);
  } else {
    entries = pages.filter(
      (page) =>
        !page.index &&
        page.route.slice(0, page.route.lastIndexOf("/", page.route.length - 2) + 1) ===
          `/${collection}/`,
    );
  }
  return entries
    .filter((page) => page.route !== route)
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
    related: relatedNavigation(page.route, page.metadata, pages, site),
    category: categoryOf(page.route, pages)?.metadata.title,
    listings: [...page.body.matchAll(new RegExp(listDirective, "gm"))].map(
      ([, collection, limit]) =>
        collectionItems(
          pages,
          page.route,
          collection,
          Number(limit) || Number.POSITIVE_INFINITY,
          site,
        ).map((entry) => [
          entry.route,
          entry.metadata.title,
          entry.metadata.period,
          entry.metadata.date,
          entry.metadata.endDate,
          entry.metadata.icon,
          entry.metadata.darkIcon,
          entry.metadata.secondaryIcon,
          entry.metadata.role,
        ]),
    ),
  };
}
