import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { preview } from "vite";

function routes(directory, prefix = "/") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === "assets" || /^dev-[0-9]+$/.test(entry.name)
        ? []
        : routes(join(directory, entry.name), `${prefix}${entry.name}/`);
    }
    return entry.name === "index.html" ? [prefix] : [];
  });
}

const server = await preview({
  configFile: false,
  appType: "mpa",
  logLevel: "silent",
  preview: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const origin = server.resolvedUrls.local[0];
  const paths = routes("dist");
  assert.ok(paths.length > 0, "The build must contain pages");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "light" });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(origin) && response.status() >= 400) {
        failures.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(origin)) {
        failures.push(`Request failed: ${new URL(request.url()).pathname}`);
      }
    });
    for (const path of paths) {
      const response = await page.goto(new URL(path, origin).href);
      assert.equal(response.status(), 200, `Page must load: ${path}`);
      assert.equal(await page.locator("main").count(), 1);
      assert.equal(await page.locator("h1").count(), 1);
      const brokenImages = await page.locator("img").evaluateAll(async (images) => {
        await Promise.all(images.map((image) => image.decode().catch(() => {})));
        return images.filter((image) => image.naturalWidth === 0).length;
      });
      assert.equal(brokenImages, 0, `Images must load: ${path}`);
    }
    await page.goto(origin);
    await page.locator("[data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const link = page.locator('a[href="/blogs/"]').first();
    await link.click();
    await page.waitForURL(new URL("/blogs/", origin).href);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.locator("[data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    assert.deepEqual(failures, [], "Pages must have no runtime or local resource errors");
    await context.close();
    console.log(
      `Validated ${paths.length} pages, navigation, images and theme at ${viewport.width}px`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
