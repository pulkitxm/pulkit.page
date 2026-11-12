import type { Page } from "playwright";
import { expect } from "./problems.ts";

export async function auditProjectLayout(page: Page, label: string): Promise<void> {
  const originalViewport = page.viewportSize();
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1440, height: 720 },
      { width: 1024, height: 500 },
      { width: 1023, height: 500 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const box = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) {
            throw new Error("Project layout element is missing");
          }
          const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
          return { x, y, width, height, right, bottom };
        };
        return {
          sidebar: box("[data-project-sidebar]"),
          panel: box('[data-project-panel="preview"]'),
          frame: box("[data-project-frame]"),
          video: box("[data-project-recording]"),
          overflow: document.documentElement.scrollWidth - innerWidth,
          sidebarOverflow: getComputedStyle(
            document.querySelector<HTMLElement>("[data-project-sidebar]") ?? document.body,
          ).overflowY,
        };
      });
      const within = (inner: typeof layout.frame, outer: typeof layout.frame) =>
        inner.x >= outer.x - 1 &&
        inner.y >= outer.y - 1 &&
        inner.right <= outer.right + 1 &&
        inner.bottom <= outer.bottom + 1;
      expect(
        label,
        within(layout.frame, layout.panel) && within(layout.video, layout.frame),
        `Project recording or native controls are clipped at ${viewport.width}x${viewport.height}`,
      );
      expect(label, layout.overflow <= 1, "Project layout overflows the viewport");
      if (viewport.width >= 1024) {
        expect(
          label,
          Math.abs(layout.sidebar.width - 360) < 1 &&
            layout.sidebar.x > layout.panel.right &&
            Math.abs(layout.sidebar.height - layout.panel.height) < 1 &&
            layout.sidebarOverflow === "auto",
          "Desktop project sidebar is not a full-height scrollable right column",
        );
        expect(
          label,
          Math.abs(
            layout.frame.x + layout.frame.width / 2 - layout.panel.x - layout.panel.width / 2,
          ) < 1 &&
            Math.abs(
              layout.frame.y + layout.frame.height / 2 - layout.panel.y - layout.panel.height / 2,
            ) < 1,
          "Desktop project recording is not centered in its frame",
        );
      } else {
        expect(
          label,
          layout.sidebar.bottom <= layout.panel.y + 1,
          "Mobile project details must precede the preview",
        );
      }
      const sidebar = page.locator("[data-project-sidebar]");
      for (const name of ["Project licenses", "Next project"]) {
        const link = sidebar.getByRole("link", { name, exact: true });
        if ((await link.count()) === 0 && name === "Next project") {
          continue;
        }
        await link.scrollIntoViewIfNeeded();
        expect(
          label,
          await link.evaluate((element) => {
            const linkBox = element.getBoundingClientRect();
            const sidebarBox = element.closest("aside")?.getBoundingClientRect();
            return Boolean(
              sidebarBox &&
                linkBox.top >= sidebarBox.top - 1 &&
                linkBox.bottom <= sidebarBox.bottom + 1,
            );
          }),
          `Project sidebar control is unreachable: ${name}`,
        );
      }
      await sidebar.evaluate((element) => {
        element.scrollTop = 0;
      });
    }
    for (const name of [
      "Project licenses",
      "Capture provenance",
      "Gallery software notices",
      "Report an issue",
    ]) {
      expect(
        label,
        await page
          .getByRole("link", { name, exact: true })
          .evaluate((element) => Boolean(element.closest("[data-project-sidebar]"))),
        `Project resource must remain in the sidebar: ${name}`,
      );
    }
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }
  }
}
