import { readFileSync } from "node:fs";
import { join } from "node:path";
import profile from "@pulkit/profile";
import { developmentOutputName } from "@pulkit/shared/built-site";
import { formatDuration } from "@pulkit/shared/duration";
import {
  type CacheAccess,
  type GenerationCache,
  generationCache,
  generationVersion,
} from "../lib/generation-cache.ts";
import { llmsText } from "../markdown/llms-text.ts";
import { renderMarkdown } from "../markdown/markdown-export.ts";
import { crawlerOutputs } from "../seo/crawler-outputs.ts";
import { cardCategory, renderCard } from "../seo/og-images.ts";
import { imagePath, markdownPath } from "../seo/routes.ts";
import { renderSitePage } from "../site/generate.ts";
import { readSite } from "../site/site-inventory.ts";
import type { SiteInventory } from "../types.ts";

export const developmentOriginFile = ".cache/dev-origin";

type DevelopmentResponse =
  | { kind: "content"; body: string | Buffer; type: string; description: string }
  | { kind: "redirect"; location: string };

export interface DevelopmentRenderer {
  invalidate(reset?: boolean): void;
  render(pathname: string): Promise<DevelopmentResponse | undefined>;
}

function linkLocalSites(html: string): string {
  return Object.entries(profile.sites).reduce((body, [site, origin]) => {
    let local: string;
    try {
      local = readFileSync(join("..", site, developmentOriginFile), "utf8").trim();
    } catch {
      return body;
    }
    return body.replaceAll(`href="${origin}`, `href="${local}`);
  }, html);
}

function crawlerType(pathname: string): string {
  if (pathname.endsWith(".txt")) {
    return "text/plain";
  }
  return pathname === "/feed.xml" ? "application/atom+xml" : "application/xml";
}

export function developmentRenderer(origin: () => string): DevelopmentRenderer {
  let inventory: SiteInventory | undefined;
  let cache: GenerationCache | undefined;
  let savedCounts: string | undefined;
  const attempted = new Set<string>();
  function save(current: GenerationCache): void {
    const counts = JSON.stringify(current.counts);
    if (counts !== savedCounts) {
      current.save();
      savedCounts = counts;
    }
  }
  function tracker(pathname: string): {
    access: (state: CacheAccess) => void;
    summary: (startedAt: number) => string;
  } {
    let action = "cached";
    return {
      access(state) {
        if (state === "miss") {
          action = attempted.has(pathname) ? "rebuilt" : "compiled";
        } else {
          action = state === "pending" ? "waited for compilation" : "cached";
        }
        attempted.add(pathname);
      },
      summary(startedAt) {
        return action === "cached"
          ? "cached"
          : `${action} in ${formatDuration(performance.now() - startedAt)}`;
      },
    };
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
      cache ??= generationCache(
        `dist/${developmentOutputName(new URL(origin()).port)}`,
        generationVersion(),
      );
      const current = cache;
      const { pages, site } = inventory;
      const { access, summary } = tracker(pathname);
      const route = pathname.replace(/index\.html$/, "");
      const page = pages.find((entry) => entry.route === route);
      if (page) {
        const startedAt = performance.now();
        const html = await renderSitePage(page, inventory, current, access);
        const description = summary(startedAt);
        save(current);
        return {
          kind: "content",
          body: linkLocalSites(html),
          type: "text/html; charset=utf-8",
          description,
        };
      }
      const card = pages.find((entry) => imagePath(entry.route) === pathname);
      if (card) {
        const startedAt = performance.now();
        const category = cardCategory(card, pages, site);
        const body = current.get(
          "card",
          [card.metadata, card.route, site, category],
          () => renderCard(card, site, category).toString("base64"),
          access,
        );
        const description = summary(startedAt);
        save(current);
        return {
          kind: "content",
          body: Buffer.from(body, "base64"),
          type: "image/png",
          description,
        };
      }
      const crawler = crawlerOutputs(pages, site).get(pathname.slice(1));
      if (crawler) {
        return {
          kind: "content",
          body: crawler,
          type: crawlerType(pathname),
          description: "generated",
        };
      }
      const markdownPage = pages.find((entry) => markdownPath(entry.route) === pathname);
      if (markdownPage || pathname === "/llms.txt") {
        return {
          kind: "content",
          body: markdownPage ? renderMarkdown(markdownPage, pages, site) : llmsText(pages, site),
          type: markdownPage ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
          description: "generated",
        };
      }
      const redirects =
        !pathname.endsWith("/") && pages.some((entry) => entry.route === `${pathname}/`);
      return redirects ? { kind: "redirect", location: `${pathname}/` } : undefined;
    },
  };
}
