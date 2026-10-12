import { expect, test } from "bun:test";
import { validateRequestedRoutes } from "./sites.ts";

test("mixed valid and missing routes fail with every missing route", () => {
  expect(() =>
    validateRequestedRoutes(
      ["/existing/", "/missing/", "/another-missing/", "/missing/"],
      ["/", "/existing/"],
    ),
  ).toThrow("Requested routes were not found: /missing/, /another-missing/");
});

test("requested routes can belong to different selected sites", () => {
  const selectedSites = [{ routes: ["/", "/exp/example/"] }, { routes: ["/", "/example-post/"] }];
  expect(() =>
    validateRequestedRoutes(
      ["/exp/example/", "/example-post/"],
      selectedSites.flatMap((site) => site.routes),
    ),
  ).not.toThrow();
});

test("all-route audits need no explicit route validation", () => {
  expect(() => validateRequestedRoutes([], ["/", "/example/"])).not.toThrow();
});
