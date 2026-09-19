import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { checkContent } from "@pulkit/checks/content";
import { validateSeo } from "./check-seo.mjs";
import { renderCard, titleLines } from "./og-images.mjs";
import { readPage, renderPage } from "./render-page.mjs";
import { ancestors, relatedPages, safeJson, structuredData } from "./seo.mjs";
import { resolveSiteOrigin } from "./site-origin.mjs";

const site = {
  ...readPage(readFileSync("content/_site.md", "utf8")).metadata,
  url: resolveSiteOrigin({}),
};
const metadata = {
  title: "A <script> & title",
  description: "An accurate description",
  date: "2025-01-02",
  tags: ["CSS"],
};
const pages = [
  { route: "/", metadata: { title: "Home" } },
  { route: "/blogs/", index: true, metadata: { title: "Writing" } },
  { route: "/blogs/example/", metadata },
  { route: "/blogs/related/", metadata: { title: "Related", tags: ["CSS"] } },
  { route: "/blogs/unrelated/", metadata: { title: "Unrelated", tags: ["Databases"] } },
];
test("JSON-LD escapes script termination without changing data", () => {
  const value = { title: `</script>${String.fromCharCode(8232)}&` };
  const json = safeJson(value);
  expect(json).not.toContain("<");
  expect(JSON.parse(json)).toEqual(value);
});
test("graphs distinguish collections, posts, contact and experience without invented dates", () => {
  for (const [route, type] of [
    ["/blogs/", "CollectionPage"],
    ["/contact/", "ContactPage"],
    ["/about/", "AboutPage"],
    ["/exp/example/", "WebPage"],
  ]) {
    const graph = structuredData(route, metadata, site, pages)["@graph"];
    expect(graph.at(-1)["@type"]).toBe(type);
    expect(graph.some((entry) => entry["@type"] === "BlogPosting")).toBe(false);
    expect(JSON.stringify(graph)).not.toContain("dateModified");
  }
  const article = structuredData("/blogs/example/", metadata, site, pages)["@graph"].find(
    (entry) => entry["@type"] === "BlogPosting",
  );
  expect(article.datePublished).toBe(metadata.date);
  expect(article.author["@id"]).toBe(`${site.url}/#person`);
});
test("navigation selects ancestors and related topics, excluding unrelated posts", () => {
  expect(ancestors("/blogs/example/", pages).map((page) => page.route)).toEqual(["/", "/blogs/"]);
  expect(relatedPages("/blogs/example/", metadata, pages).map((page) => page.route)).toEqual([
    "/blogs/related/",
  ]);
});
test("cards render deterministically and preserve long titles", () => {
  const page = { route: "/blogs/example/", metadata };
  expect(renderCard(page, site).equals(renderCard(page, site))).toBe(true);
  const title =
    "Understanding distributed systems with practical examples and useful implementation details";
  expect(titleLines(title).join(" ")).toBe(title);
});
test("validator rejects wrong canonicals, missing metadata, broken JSON and wrong PNG dimensions", async () => {
  const source =
    "---\ntitle: Example\ndescription: Example description\ndate: 2025-01-02\n---\n\nText.\n";
  const data = readPage(source).metadata;
  const html = await renderPage(source, { site, pages, route: "/blogs/example/" });
  const png = renderCard({ route: "/blogs/example/", metadata: data }, site);
  const validate = (value, buffer = png) =>
    validateSeo(value, "/blogs/example/", data, site, () => buffer);
  expect(() => validate(html)).not.toThrow();
  expect(() => validate(html.replace('rel="canonical"', 'rel="alternate"'))).toThrow("canonical");
  expect(() => validate(html.replace('name="twitter:card"', 'name="missing"'))).toThrow(
    "twitter:card",
  );
  expect(() => validate(html.replace('"@context":', '"@context" broken:'))).toThrow();
  const invalid = Buffer.from(png);
  invalid.writeUInt32BE(500, 16);
  expect(() => validate(html, invalid)).toThrow("dimensions");
});
test("shared metadata rejects a second source of domain configuration", () => {
  const source = readFileSync("content/_site.md", "utf8").replace(
    "brand: Pulkit",
    "brand: Pulkit\nurl: https://example.com",
  );
  expect(checkContent("content/_site.md", source).errors.join(" ")).toContain(
    "unknown metadata field: url",
  );
});
