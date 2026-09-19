import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Browser, Page } from "playwright";
import {
  auditedViewports,
  axeTags,
  blockingImpacts,
  buildDirectory,
  ownsPath,
  themeDependentRules,
  type Viewport,
  workersPerViewport,
} from "./audit-config.ts";
import { type DocumentReport, inspectDocument } from "./inspect-document.ts";
import { expect, report } from "./problems.ts";
import { openSession, waitForImages } from "./session.ts";

function isBuiltFile(pathname: string): boolean {
  const file = join(buildDirectory, decodeURIComponent(pathname));
  return existsSync(file) && statSync(file).isFile();
}

async function auditAccessibility(page: Page, scope: string): Promise<void> {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selected) => {
      document.documentElement.dataset.theme = selected;
    }, theme);
    const builder = new AxeBuilder({ page }).exclude(["iframe", "*"]).setLegacyMode(true);
    const { violations } = await (theme === "light"
      ? builder.withTags(axeTags)
      : builder.withRules(themeDependentRules)
    ).analyze();
    for (const violation of violations) {
      const { impact } = violation;
      if (!(impact && blockingImpacts.has(impact))) {
        continue;
      }
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ");
      report(`${scope} ${theme}`, `axe ${violation.id} (${impact}) at ${targets}`);
    }
  }
}

async function auditPage(
  page: Page,
  viewport: Viewport,
  path: string,
  origin: string,
  owned: boolean,
): Promise<DocumentReport | null> {
  const scope = `${viewport.name} ${path}`;
  const response = await page.goto(new URL(path, origin).href);
  if (response?.status() !== 200) {
    report(scope, `Page returned HTTP ${response?.status()}`);
    return null;
  }
  if (!owned) {
    return page.evaluate(inspectDocument);
  }
  await waitForImages(page);
  const result = await page.evaluate(inspectDocument);
  expect(scope, result.mains === 1, `Expected one main, found ${result.mains}`);
  expect(scope, result.headings === 1, `Expected one h1, found ${result.headings}`);
  expect(scope, result.lang, "Missing html lang");
  expect(scope, result.title, "Missing title");
  expect(scope, result.viewportMeta.includes("width=device-width"), "Missing viewport meta");
  expect(
    scope,
    result.overflow <= 0,
    `Page scrolls horizontally by ${result.overflow}px (${result.overflowing.join(", ")})`,
  );
  for (const href of result.unsafeBlankLinks) {
    report(scope, `New-tab link without noopener: ${href}`);
  }
  for (const href of result.emptyLinks) {
    report(scope, `Link without an accessible name: ${href}`);
  }
  for (const id of new Set(result.duplicateIds)) {
    report(scope, `Duplicate id: ${id}`);
  }
  const toggle = await page.locator("[data-theme-toggle]").boundingBox();
  expect(scope, toggle && toggle.width > 0 && toggle.height > 0, "Theme toggle is not visible");
  await auditAccessibility(page, scope);
  return result;
}

async function auditViewport(
  browser: Browser,
  origin: string,
  paths: readonly string[],
  viewport: Viewport,
): Promise<Map<string, DocumentReport | null>> {
  const owned = new Set(paths.filter((_, index) => ownsPath(index)));
  const queue = [...paths];
  const results = new Map<string, DocumentReport | null>();
  await Promise.all(
    Array.from({ length: Math.min(workersPerViewport, paths.length) }, async () => {
      const { context, page } = await openSession(browser, origin, viewport.name, { viewport });
      for (let path = queue.shift(); path; path = queue.shift()) {
        results.set(path, await auditPage(page, viewport, path, origin, owned.has(path)));
      }
      await context.close();
    }),
  );
  console.log(`Audited ${owned.size} of ${paths.length} pages at ${viewport.width}px`);
  return results;
}

export async function auditPages(
  browser: Browser,
  origin: string,
  paths: readonly string[],
): Promise<Map<string, DocumentReport>> {
  const [primary] = await Promise.all(
    auditedViewports.map((viewport) => auditViewport(browser, origin, paths, viewport)),
  );
  const documents = new Map<string, DocumentReport>();
  for (const path of paths) {
    const document = primary?.get(path);
    if (document) {
      documents.set(path, document);
    }
  }
  return documents;
}

export function auditLinks(documents: ReadonlyMap<string, DocumentReport>, origin: string): void {
  let checked = 0;
  for (const [source, { links }] of documents) {
    for (const href of links) {
      const url = new URL(href);
      if (url.origin !== origin) {
        continue;
      }
      checked += 1;
      const scope = `links ${source}`;
      const target = documents.get(url.pathname);
      if (!target) {
        if (documents.has(`${url.pathname}/`)) {
          report(scope, `Link to ${url.pathname} is missing its trailing slash`);
        } else if (!isBuiltFile(url.pathname)) {
          report(scope, `Broken link to ${url.pathname}`);
        }
        continue;
      }
      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment && !target.ids.includes(fragment)) {
        report(scope, `Missing anchor ${url.pathname}#${fragment}`);
      }
    }
  }
  console.log(`Checked ${checked} internal links and anchors`);
}
