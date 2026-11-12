import type { Browser } from "playwright";
import { expect } from "./problems.ts";
import { auditProjectLayout } from "./project-layout.ts";
import { auditProjectPlayback } from "./project-playback.ts";
import { auditProjectSource } from "./project-source.ts";
import { openSession } from "./session.ts";

export async function auditExperimentGallery(
  browser: Browser,
  origin: string,
  route: string,
): Promise<void> {
  const label = "reviewed-gallery";
  const { context, page } = await openSession(browser, origin, label);
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(new URL(route, origin).href);
    expect(
      label,
      (await page.getByRole("heading", { name: "Claude directory", exact: true }).count()) === 1,
      "The original directory heading is missing",
    );
    const root = page.locator("[data-directory]");
    const cards = root.locator("[data-directory-list] [data-card]");
    const initial = await cards.count();
    expect(
      label,
      initial > 0 && initial <= 24,
      "Approved cards are missing or pagination overflowed",
    );
    const firstTitle = await cards.first().locator("[data-card-title]").innerText();
    const input = root.locator("[data-directory-query]");
    await cards.first().locator("[data-card-link]").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const video = document.querySelector<HTMLVideoElement>("[data-card-media] video");
      return Boolean(
        video?.muted && video.loop && video.playsInline && !video.paused && video.currentTime > 0,
      );
    });
    const firstRecording = await cards.first().locator("video").elementHandle();
    await page.waitForLoadState("networkidle");
    await input.fill(firstTitle);
    await page.waitForFunction(() =>
      Boolean(document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden),
    );
    expect(
      label,
      (await cards.locator("[data-card-title]").allTextContents()).includes(firstTitle),
      "Search omitted the matching approved project",
    );
    expect(
      label,
      await firstRecording?.evaluate((video) => !video.isConnected && !video.hasAttribute("src")),
      "Filtering retained the removed card's recording",
    );
    await page.waitForLoadState("networkidle");
    await input.fill("z".repeat(48));
    await root.locator("[data-directory-empty]").waitFor({ state: "visible" });
    expect(label, (await cards.count()) === 0, "An unmatched query retained stale cards");
    await page.waitForLoadState("networkidle");
    await root.locator("[data-directory-clear]").click();
    await page.waitForFunction(
      () => !document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden,
    );
    expect(
      label,
      (await cards.count()) === initial,
      "Clearing filters did not restore approved browsing",
    );
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLVideoElement>("[data-card-media] video")].every(
        (video) => video.paused && !video.hasAttribute("src"),
      ),
    );
    expect(
      label,
      await root
        .locator("[data-card-media] video")
        .evaluateAll((videos) =>
          videos.every((video) => (video as HTMLVideoElement).paused && !video.hasAttribute("src")),
        ),
      "Reduced motion started an automatic recording",
    );
    const category = root.locator("[data-filter^='category:']").first();
    if (await category.count()) {
      const selected = (await category.getAttribute("data-filter"))?.slice("category:".length);
      await category.click();
      await page.waitForFunction(() =>
        Boolean(document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden),
      );
      const names = await cards
        .locator("[data-card-link]")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      expect(
        label,
        names.length > 0 && names.every((href) => href.includes(`/experiments/${selected}--`)),
        "Category filtering included another group",
      );
      await page.waitForLoadState("networkidle");
    }
    await root.locator("[data-filter='all']").click();
    await page.waitForFunction(
      () => !document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden,
    );
    await page.waitForLoadState("networkidle");
    const next = root.locator("[data-directory-pages] a").filter({ hasText: /^Next$/ });
    if (await next.count()) {
      await next.click();
      await page.waitForURL(new URL(`${route}pages/2/`, origin).href);
      expect(
        label,
        (await page.locator("[data-directory-list] [data-card]").count()) > 0,
        "Native pagination produced an empty page",
      );
      await page.waitForLoadState("networkidle");
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForLoadState("networkidle");
    await page.locator("[data-directory-list] [data-card-link]").first().click();
    await page.locator("[data-project]").waitFor();
    expect(
      label,
      (await page.locator("a", { hasText: "Open current preview" }).count()) === 1,
      "Project preview is missing",
    );
    expect(
      label,
      (await page.locator("a", { hasText: "Source folder" }).count()) === 1,
      "Current source folder is missing",
    );
    expect(
      label,
      (await page.locator("iframe, [data-prompt], [data-file-explorer]").count()) === 0,
      "Retired media or source-copy controls returned",
    );
    await auditProjectSource(page, label);
    await auditProjectPlayback(page, label);
    await auditProjectLayout(page, label);
    await page.waitForLoadState("networkidle");
    await page
      .locator("[data-project-sidebar]")
      .getByRole("link", { name: "Claude directory", exact: true })
      .click();
    await page.waitForURL(new URL(route, origin).href);
    expect(
      label,
      (await page.locator("[data-directory-list] [data-card]").count()) === initial,
      "Detail navigation did not return to the gallery",
    );
    await page.waitForLoadState("networkidle");
  } finally {
    await context.close();
  }
  console.log(
    "Validated directory autoplay, reduced motion, search, filters, pagination and project playback",
  );
}
