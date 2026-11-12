import { projectSourceSchema } from "@pulkit/shared/project-source";
import type { Page } from "playwright";
import { expect } from "./problems.ts";

export async function auditProjectSource(page: Page, label: string): Promise<void> {
  const video = page.locator("[data-project-recording]");
  await video.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused === false,
  );
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator("[data-project-sidebar]");
  const workspace = page.locator("[data-code-workspace]");
  const path = await workspace.getAttribute("data-source-url");
  const url = new URL(path ?? "", page.url()).href;
  let requests = 0;
  page.on("request", (request) => {
    if (request.url() === url) {
      requests += 1;
    }
  });
  const sourceResponse = page.waitForResponse((response) => response.url() === url);
  await sidebar.getByRole("button", { name: "Code", exact: true }).click();
  const bundle = projectSourceSchema.parse(await (await sourceResponse).json());
  expect(
    label,
    bundle.project === (await page.locator("[data-project]").getAttribute("data-project-path")),
    "Source files belong to another project",
  );
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused,
  );
  await workspace.locator("[data-source-content]").waitFor();
  const files = workspace.locator("[data-source-file]");
  expect(label, (await files.count()) > 0, "Project source file tree is empty");
  const target = files.last();
  const selected = await target.getAttribute("data-source-file");
  const expectedContent = bundle.files.find((file) => file.path === selected)?.content;
  await target.click();
  await page.waitForFunction(
    (expected) => document.querySelector("[data-source-content]")?.textContent === expected,
    expectedContent,
  );
  expect(label, expectedContent !== undefined, "Code view selected an unapproved file");
  const wrap = workspace.getByRole("button", { name: "Wrap lines", exact: true });
  await wrap.click();
  expect(
    label,
    (await wrap.getAttribute("aria-pressed")) === "true",
    "Code line wrapping did not enable",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (globalThis as typeof globalThis & { copiedProjectSource?: string }).copiedProjectSource =
            text;
          return Promise.resolve();
        },
      },
    });
  });
  await workspace.getByRole("button", { name: "Copy file", exact: true }).click();
  expect(
    label,
    await page.evaluate(
      (expected) =>
        (globalThis as typeof globalThis & { copiedProjectSource?: string }).copiedProjectSource ===
        expected,
      expectedContent,
    ),
    "Copy file differs from the displayed source",
  );
  await sidebar.getByRole("button", { name: "Preview", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused === false,
  );
  await sidebar.getByRole("button", { name: "Code", exact: true }).click();
  await workspace.locator("[data-source-content]").waitFor();
  expect(label, requests === 1, "Switching views fetched duplicate source bundles");
  await sidebar.getByRole("button", { name: "Preview", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector<HTMLVideoElement>("[data-project-recording]")?.paused === false,
  );
}
