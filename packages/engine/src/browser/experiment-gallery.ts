import type { Browser } from "playwright";
import { expect } from "./problems.ts";
import { openSession } from "./session.ts";

export async function auditExperimentGallery(
  browser: Browser,
  origin: string,
  route: string,
): Promise<void> {
  const label = "reviewed-gallery";
  const { context, page } = await openSession(browser, origin, label);
  try {
    await page.goto(new URL(route, origin).href);
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
    await input.fill(firstTitle);
    await page.waitForFunction(() =>
      Boolean(document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden),
    );
    expect(
      label,
      (await cards.locator("[data-card-title]").allTextContents()).includes(firstTitle),
      "Search omitted the matching approved project",
    );
    await input.fill("z".repeat(48));
    await root.locator("[data-directory-empty]").waitFor({ state: "visible" });
    expect(label, (await cards.count()) === 0, "An unmatched query retained stale cards");
    await root.locator("[data-directory-clear]").click();
    await root.locator("[data-filter='all']").click();
    await page.waitForFunction(
      () => !document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden,
    );
    expect(
      label,
      (await cards.count()) === initial,
      "Clearing filters did not restore approved browsing",
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
    }
    await root.locator("[data-filter='all']").click();
    await page.waitForFunction(
      () => !document.querySelector<HTMLElement>("[data-directory-pages]")?.hidden,
    );
    const next = root.locator("[data-directory-pages] a").filter({ hasText: /^Next$/ });
    if (await next.count()) {
      await next.click();
      await page.waitForURL(new URL(`${route}pages/2/`, origin).href);
      expect(
        label,
        (await page.locator("[data-directory-list] [data-card]").count()) > 0,
        "Native pagination produced an empty page",
      );
    }
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
    const recording = page.locator("video[data-project-recording]");
    expect(label, (await recording.count()) === 1, "Fresh project recording is missing");
    expect(
      label,
      (await recording.getAttribute("preload")) === "none",
      "Recording eagerly loads media",
    );
    expect(
      label,
      (await recording.getAttribute("controls")) !== null,
      "Recording controls are missing",
    );
    expect(
      label,
      (await recording.getAttribute("autoplay")) === null,
      "Detail recording autoplays",
    );
    await recording.evaluate(async (video: HTMLVideoElement) => {
      await video.play();
    });
    await page.waitForFunction(() => {
      const video = document.querySelector<HTMLVideoElement>("[data-project-recording]");
      return Boolean(video && video.currentTime > 0 && !video.paused);
    });
    await recording.evaluate((video: HTMLVideoElement) => video.pause());
    await page.getByRole("link", { name: "All experiments", exact: true }).click();
    await page.waitForURL(new URL(route, origin).href);
    expect(
      label,
      (await page.locator("[data-directory-list] [data-card]").count()) === initial,
      "Detail navigation did not return to the gallery",
    );
  } finally {
    await context.close();
  }
  console.log(
    "Validated reviewed gallery search, empty state, category filters, pagination and project navigation",
  );
}
