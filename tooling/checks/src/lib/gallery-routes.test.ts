import { expect, test } from "bun:test";
import { approvedGalleryPaths } from "./gallery-routes.ts";

test("the gallery accepts only current approved pages and exact social-card variants", () => {
  const paths = approvedGalleryPaths(
    Array.from({ length: 25 }, (_, index) => `hero-sections--mock-${index}`),
  );
  expect(paths.pages.has("index.html")).toBe(true);
  expect(paths.pages.has("pages/2/index.html")).toBe(true);
  expect(paths.pages.has("experiments/hero-sections--mock-0/index.html")).toBe(true);
  expect(paths.pages.has("reviewed-projects.json")).toBe(true);
  for (const path of [
    "projects.json",
    "old-template/index.html",
    "pages/3/index.html",
    "experiments/unapproved/index.html",
  ]) {
    expect(paths.pages.has(path)).toBe(false);
  }
  expect(paths.socialCards.has("card.png")).toBe(true);
  expect(paths.socialCards.has("card-x.png")).toBe(true);
  expect(paths.socialCards.has("pages/2/card.png")).toBe(true);
  expect(paths.socialCards.has("experiments/hero-sections--mock-0/card-x.png")).toBe(true);
  for (const path of [
    "stale.png",
    "index.html",
    "old-template/card.png",
    "experiments/unapproved/card.png",
    "pages/2/stale.png",
  ]) {
    expect(paths.socialCards.has(path)).toBe(false);
  }
});
