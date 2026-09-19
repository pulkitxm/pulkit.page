import { expect, test } from "bun:test";
import type { ListedPage, PageRecord, Site } from "../types.ts";
import { renderDependencies } from "./render-dependencies.ts";

test("page dependencies follow listing limits, schema, breadcrumbs and related links", () => {
  const page: PageRecord = {
    route: "/",
    body: ":::list blogs limit=1",
    metadata: { title: "Home" },
  };
  const newest: PageRecord = {
    route: "/blogs/new/",
    body: "",
    metadata: { title: "New", date: "2026-01-01", tags: ["web"] },
  };
  const oldest: PageRecord = {
    route: "/blogs/old/",
    body: "",
    metadata: { title: "Old", date: "2025-01-01", tags: ["web"] },
  };
  const pages: ListedPage[] = [page, newest, oldest];
  const site: Site = { url: "https://example.com", brand: "Example", articles: "/blogs/" };
  const before = renderDependencies(page, pages, site);
  oldest.body = "Changed body";
  oldest.metadata.title = "Changed older title";
  expect(renderDependencies(page, pages, site)).toEqual(before);
  newest.metadata.title = "Changed latest title";
  expect(renderDependencies(page, pages, site)).not.toEqual(before);
  const related = renderDependencies(newest, pages, site);
  oldest.metadata.title = "Changed related title";
  expect(renderDependencies(newest, pages, site)).not.toEqual(related);
});
