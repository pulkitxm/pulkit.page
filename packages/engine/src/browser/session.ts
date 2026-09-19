import type { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import { defaultViewport } from "./audit-config.ts";
import { report } from "./problems.ts";

export interface Session {
  context: BrowserContext;
  page: Page;
}

export async function openSession(
  browser: Browser,
  origin: string,
  label: string,
  options: BrowserContextOptions = {},
  initScripts: readonly (() => void)[] = [],
): Promise<Session> {
  const context = await browser.newContext({
    viewport: defaultViewport,
    colorScheme: "light",
    ...options,
  });
  for (const script of initScripts) {
    await context.addInitScript(script);
  }
  const page = await context.newPage();
  const scope = () => `${label} ${new URL(page.url()).pathname}`;
  const embedded = (source: string | undefined) =>
    Boolean(source) && /^https?:\/\//.test(source ?? "") && !source?.startsWith(origin);
  page.on("pageerror", (error) => {
    if (!embedded(/https?:\/\/[^\s)]+/.exec(error.stack ?? "")?.[0])) {
      report(scope(), `Uncaught error: ${error.message}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !embedded(message.location().url)) {
      report(scope(), `Console error: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      report(scope(), `HTTP ${response.status()} for ${new URL(response.url()).pathname}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) {
      report(scope(), `Request failed for ${new URL(request.url()).pathname}`);
    }
  });
  return { context, page };
}

export async function waitForImages(page: Page): Promise<void> {
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        image.loading = "eager";
      }
    }
  });
  await page.waitForFunction(
    () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => document.fonts.ready);
}
