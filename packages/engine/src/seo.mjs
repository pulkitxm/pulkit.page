export function imagePath(route) {
  return `/og/${route === "/" ? "home" : route.slice(1, -1)}/card.png`;
}
export function isArticle(route, pages, site) {
  return (
    typeof site?.articles === "string" &&
    route !== "/" &&
    route.startsWith(site.articles) &&
    !pages.find((page) => page.route === route)?.index
  );
}
export function articles(pages, site) {
  return pages.filter((page) => isArticle(page.route, pages, site));
}
export function categoryOf(route, pages) {
  const parent = route.slice(0, route.lastIndexOf("/", route.length - 2) + 1);
  return parent === "/" ? undefined : pages.find((page) => page.index && page.route === parent);
}
function newestFirst(a, b) {
  return (
    (b.metadata.date ?? "").localeCompare(a.metadata.date ?? "") || a.route.localeCompare(b.route)
  );
}
export function pageTitle(metadata, site, route) {
  if (route === "/") {
    return site.brand ?? "Pulkit";
  }
  const branded = `${metadata.title} | ${site.brand ?? "Pulkit"}`;
  return branded.length > 70 ? metadata.title : branded;
}
export function ancestors(route, pages) {
  return pages
    .filter(
      (page) =>
        page.route !== route &&
        (page.route === "/" || (page.index && route.startsWith(page.route))),
    )
    .sort((a, b) => a.route.length - b.route.length);
}
export function relatedPages(route, metadata, pages, site) {
  if (!isArticle(route, pages, site)) {
    return [];
  }
  const tags = new Set((metadata.tags ?? []).map((tag) => tag.toLowerCase()));
  const parent = route.slice(0, route.lastIndexOf("/", route.length - 2) + 1);
  return articles(pages, site)
    .filter((page) => page.route !== route)
    .map((page) => ({
      page,
      score:
        (page.metadata.tags ?? []).filter((tag) => tags.has(tag.toLowerCase())).length +
        (parent !== site.articles && page.route.startsWith(parent) ? 3 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.route.localeCompare(b.page.route))
    .slice(0, 3)
    .map((item) => item.page);
}
export function structuredData(route, metadata, site, pages) {
  const origin = site.url;
  const url = `${origin}${route}`;
  const ref = (id) => ({ "@id": id });
  const person = `${origin}/#person`;
  const website = `${origin}/#website`;
  const pageId = `${url}#webpage`;
  const index = pages.find((page) => page.route === route)?.index;
  const blog = isArticle(route, pages, site);
  const collection = index || route === site.articles;
  const image = `${url}#image`;
  const graph = [
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
  const page = {
    "@type": collection
      ? "CollectionPage"
      : route === "/about/"
        ? "AboutPage"
        : route === "/contact/"
          ? "ContactPage"
          : "WebPage",
    "@id": pageId,
    url,
    name: metadata.title,
    description: metadata.description,
    isPartOf: ref(website),
    primaryImageOfPage: ref(image),
    inLanguage: "en",
  };
  if (collection) {
    const entries = (
      route === site.articles
        ? articles(pages, site)
        : pages.filter(
            (entry) =>
              !entry.index &&
              entry.route.slice(0, entry.route.lastIndexOf("/", entry.route.length - 2) + 1) ===
                route,
          )
    ).sort(newestFirst);
    page.mainEntity = {
      "@type": "ItemList",
      "@id": `${url}#list`,
      itemListElement: entries.map((entry, position) => ({
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
  if (parents.length) {
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
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
