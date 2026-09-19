import { formatDuration } from "./duration.mjs";
import { generationCache, generationVersion } from "./generation-cache.mjs";
import { llmsText, renderMarkdown } from "./markdown-export.mjs";
import { cardCategory, crawlerOutputs, renderCard } from "./og-images.mjs";
import { renderDependencies, renderPage } from "./render-page.mjs";
import { imagePath, markdownPath } from "./seo.mjs";
import { readSite } from "./site-inventory.mjs";

export function developmentRenderer(origin) {
  let inventory;
  let cache;
  let savedCounts;
  const attempted = new Set();
  function save() {
    const counts = JSON.stringify(cache.counts);
    if (counts !== savedCounts) {
      cache.save();
      savedCounts = counts;
    }
  }
  return {
    invalidate(reset = false) {
      inventory = undefined;
      if (reset) {
        cache = undefined;
        savedCounts = undefined;
      }
    },
    async render(pathname) {
      inventory ??= readSite(origin());
      cache ??= generationCache(`dist/dev-${new URL(origin()).port}`, generationVersion());
      const { pages, layouts, site } = inventory;
      let action;
      function access(state) {
        action =
          state === "miss"
            ? attempted.has(pathname)
              ? "rebuilt"
              : "compiled"
            : state === "pending"
              ? "waited for compilation"
              : "cached";
        attempted.add(pathname);
      }
      function summary(startedAt) {
        return action === "cached"
          ? "cached"
          : `${action} in ${formatDuration(performance.now() - startedAt)}`;
      }
      const route = pathname.replace(/index\.html$/, "");
      const page = pages.find((entry) => entry.route === route);
      if (page) {
        const startedAt = performance.now();
        const html = await cache.get(
          "html",
          [page.route, page.text, [...layouts], site, renderDependencies(page, pages, site)],
          () => renderPage(page.text, { layouts, site, pages, route: page.route, cache }),
          access,
        );
        const description = summary(startedAt);
        save();
        return { body: html, type: "text/html; charset=utf-8", description };
      }
      const card = pages.find((entry) => imagePath(entry.route) === pathname);
      if (card) {
        const startedAt = performance.now();
        const body = cache.get(
          "card",
          [card.metadata, card.route, site, cardCategory(card, pages, site)],
          () => renderCard(card, site, cardCategory(card, pages, site)).toString("base64"),
          access,
        );
        const description = summary(startedAt);
        save();
        return { body: Buffer.from(body, "base64"), type: "image/png", description };
      }
      const crawler = crawlerOutputs(pages, site).get(pathname.slice(1));
      if (crawler) {
        return {
          body: crawler,
          type: pathname.endsWith(".txt")
            ? "text/plain"
            : pathname === "/feed.xml"
              ? "application/atom+xml"
              : "application/xml",
          description: "generated",
        };
      }
      const markdownPage = pages.find((entry) => markdownPath(entry.route) === pathname);
      if (markdownPage || pathname === "/llms.txt") {
        return {
          body: markdownPage ? renderMarkdown(markdownPage, pages, site) : llmsText(pages, site),
          type: markdownPage ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
          description: "generated",
        };
      }
      if (!pathname.endsWith("/") && pages.some((entry) => entry.route === `${pathname}/`)) {
        return { redirect: `${pathname}/` };
      }
      return undefined;
    },
  };
}
