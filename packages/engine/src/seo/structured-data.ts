import type { ListedPage, PageMetadata, Site } from "../types.ts";
import {
  ancestors,
  articles,
  categoryOf,
  imagePath,
  isArticle,
  newestFirstByRoute,
  parentRoute,
} from "./routes.ts";

type JsonObject = Record<string, unknown>;

interface StructuredData {
  "@context": string;
  "@graph": JsonObject[];
}

function ref(id: string): JsonObject {
  return { "@id": id };
}

function collectionEntries(route: string, pages: readonly ListedPage[], site: Site): ListedPage[] {
  return (
    route === site.articles
      ? articles(pages, site)
      : pages.filter((entry) => !entry.index && parentRoute(entry.route) === route)
  ).sort(newestFirstByRoute);
}

const pageTypes: Readonly<Record<string, string>> = {
  "/about/": "AboutPage",
  "/contact/": "ContactPage",
};

export function structuredData(
  route: string,
  metadata: PageMetadata,
  site: Site,
  pages: readonly ListedPage[],
): StructuredData {
  const origin = site.url;
  const url = `${origin}${route}`;
  const person = `${origin}/#person`;
  const website = `${origin}/#website`;
  const pageId = `${url}#webpage`;
  const index = pages.find((entry) => entry.route === route)?.index;
  const blog = isArticle(route, pages, site);
  const collection = index || route === site.articles;
  const image = `${url}#image`;
  const graph: JsonObject[] = [
    {
      "@type": "Person",
      "@id": person,
      name: site.author ?? site.brand,
      url: site.authorUrl ?? `${origin}/`,
      sameAs: (site.social ?? []).map((item) => item.href),
    },
    {
      "@type": "WebSite",
      "@id": website,
      url: `${origin}/`,
      name: site.brand,
      description: site.description,
      publisher: ref(person),
      inLanguage: "en",
    },
    {
      "@type": "ImageObject",
      "@id": image,
      contentUrl: `${origin}${imagePath(route)}`,
      width: 1200,
      height: 630,
      caption: metadata.title,
    },
  ];
  const page: JsonObject = {
    "@type": collection ? "CollectionPage" : (pageTypes[route] ?? "WebPage"),
    "@id": pageId,
    url,
    name: metadata.title,
    description: metadata.description,
    isPartOf: ref(website),
    primaryImageOfPage: ref(image),
    inLanguage: "en",
  };
  if (collection) {
    page.mainEntity = {
      "@type": "ItemList",
      "@id": `${url}#list`,
      itemListElement: collectionEntries(route, pages, site).map((entry, position) => ({
        "@type": "ListItem",
        position: position + 1,
        name: entry.metadata.title,
        url: `${origin}${entry.route}`,
      })),
    };
  } else if (blog) {
    page.mainEntity = ref(`${url}#article`);
    graph.push({
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: metadata.title,
      description: metadata.description,
      datePublished: metadata.date,
      author: ref(person),
      publisher: ref(person),
      mainEntityOfPage: ref(pageId),
      isPartOf: ref(`${origin}${categoryOf(route, pages)?.route ?? site.articles}#webpage`),
      image: ref(image),
      url,
      inLanguage: "en",
      keywords: metadata.tags,
    });
  } else {
    page.about = ref(person);
  }
  const parents = ancestors(route, pages);
  if (parents.length > 0) {
    page.breadcrumb = ref(`${url}#breadcrumbs`);
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [...parents, { route, metadata }].map((entry, position) => ({
        "@type": "ListItem",
        position: position + 1,
        name: entry.route === "/" ? "Home" : entry.metadata.title,
        item: `${origin}${entry.route}`,
      })),
    });
  }
  graph.push(page);
  return { "@context": "https://schema.org", "@graph": graph };
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
