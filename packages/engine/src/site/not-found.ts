import { notFoundRoute } from "../seo/routes.ts";
import type { Page } from "../types.ts";
import { readPage } from "./read-page.ts";

const source = `---
title: Page not found
description: This address does not match anything here. Find your way back from this page.
---

Nothing lives at this address. The page may have moved, or the link that brought you here may be
out of date.

Head back to the [homepage](/), or pick one of the links above.
`;

export function notFoundPage(): Page {
  return {
    source: "engine/not-found",
    text: source,
    ...readPage(source),
    route: notFoundRoute,
    index: false,
  };
}
