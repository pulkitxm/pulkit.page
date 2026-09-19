import type { Browser, Page } from "playwright";
import { themeKey } from "./audit-config.ts";
import { expect, report } from "./problems.ts";
import { openSession } from "./session.ts";

declare global {
  var themeAtBody: string | null | undefined;
  var transitionState: string | undefined;
}

type SystemScheme = "light" | "dark";

interface SiteTargets {
  collections: readonly string[];
  navigationTarget: string;
}

async function auditWithoutJavaScript(
  browser: Browser,
  origin: string,
  paths: readonly string[],
): Promise<void> {
  const { context, page } = await openSession(browser, origin, "no-js", {
    javaScriptEnabled: false,
  });
  for (const path of paths) {
    const scope = `no-js ${path}`;
    const response = await page.goto(new URL(path, origin).href);
    expect(scope, response?.status() === 200, `Page returned HTTP ${response?.status()}`);
    expect(scope, (await page.locator("main").count()) === 1, "Main is missing");
    expect(scope, (await page.locator("h1").count()) === 1, "Heading is missing");
    const text = await page.locator("main").innerText();
    expect(scope, text.trim().length > 0, "Main content is empty");
  }
  await context.close();
  console.log(`Rendered ${paths.length} pages without JavaScript`);
}

function recordThemeAtBody(): void {
  const observer = new MutationObserver(() => {
    if (document.body) {
      globalThis.themeAtBody = document.documentElement.dataset.theme ?? null;
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}

function readTheme(page: Page): Promise<string | null> {
  return page.locator("html").getAttribute("data-theme");
}

function readBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

function readStoredTheme(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => localStorage.getItem(name), key);
}

async function auditThemeFlow(
  browser: Browser,
  origin: string,
  systemScheme: SystemScheme,
  navigationTarget: string,
): Promise<{ initial: string; toggled: string }> {
  const label = `theme ${systemScheme}-system`;
  const other = systemScheme === "light" ? "dark" : "light";
  const { context, page } = await openSession(
    browser,
    origin,
    label,
    { colorScheme: systemScheme },
    [recordThemeAtBody],
  );
  await page.goto(origin);
  expect(label, (await readTheme(page)) === null, "Theme is forced before any choice");
  const initial = await readBackground(page);
  await page.locator("[data-theme-toggle]").click();
  expect(label, (await readTheme(page)) === other, `Toggle did not switch to ${other}`);
  expect(label, (await readStoredTheme(page, themeKey)) === other, "Choice was not stored");
  const toggled = await readBackground(page);
  expect(label, toggled !== initial, "Background did not change with the theme");
  await page.reload();
  expect(label, (await readTheme(page)) === other, "Choice did not survive a reload");
  expect(
    label,
    (await page.evaluate(() => globalThis.themeAtBody)) === other,
    "Stored theme was applied after the body started rendering",
  );
  await page.locator(`a[href="${navigationTarget}"]`).first().click();
  await page.waitForURL(new URL(navigationTarget, origin).href);
  expect(label, (await readTheme(page)) === other, "Choice did not survive navigation");
  await page.locator("[data-theme-toggle]").click();
  expect(label, (await readTheme(page)) === systemScheme, "Second toggle did not switch back");
  expect(label, (await readBackground(page)) === initial, "Background did not switch back");
  await context.close();
  return { initial, toggled };
}

async function auditThemes(browser: Browser, origin: string, navigationTarget: string) {
  const light = await auditThemeFlow(browser, origin, "light", navigationTarget);
  const dark = await auditThemeFlow(browser, origin, "dark", navigationTarget);
  expect("theme", light.toggled === dark.initial, "Chosen dark differs from system dark");
  expect("theme", dark.toggled === light.initial, "Chosen light differs from system light");
  console.log("Validated theme toggle, persistence and system preference");
}

function blockStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage is blocked", "SecurityError");
    },
  });
}

async function auditBlockedStorage(browser: Browser, origin: string): Promise<void> {
  const label = "blocked-storage";
  const { context, page } = await openSession(browser, origin, label, {}, [blockStorage]);
  await page.goto(origin);
  await page.locator("[data-theme-toggle]").click();
  expect(label, (await readTheme(page)) === "dark", "Toggle failed without storage");
  await page.reload();
  expect(label, (await readTheme(page)) === null, "Theme persisted without storage");
  await context.close();
  console.log("Validated theme toggle with blocked storage");
}

async function auditKeyboard(browser: Browser, origin: string): Promise<void> {
  const label = "keyboard";
  const { context, page } = await openSession(browser, origin, label);
  await page.goto(origin);
  let reached = false;
  for (let step = 0; step < 200 && !reached; step += 1) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(
      () => document.activeElement?.hasAttribute("data-theme-toggle") ?? false,
    );
  }
  expect(label, reached, "Theme toggle is not reachable with Tab");
  if (reached) {
    const outline = await page.evaluate(() =>
      document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : "none",
    );
    expect(label, outline !== "none", "Focused theme toggle has no visible outline");
    await page.keyboard.press("Enter");
    expect(label, (await readTheme(page)) === "dark", "Enter did not toggle the theme");
    await page.keyboard.press("Space");
    expect(label, (await readTheme(page)) === "light", "Space did not toggle the theme");
  }
  await context.close();
  console.log("Validated keyboard navigation");
}

function recordTransition(): void {
  globalThis.addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    globalThis.transitionState = transition ? "pending" : "none";
    transition?.ready.then(
      () => {
        globalThis.transitionState = "animated";
      },
      () => {
        globalThis.transitionState = "skipped";
      },
    );
  });
}

async function settledTransition(page: Page): Promise<string | undefined> {
  await page.waitForFunction(
    () => globalThis.transitionState && globalThis.transitionState !== "pending",
  );
  return page.evaluate(() => globalThis.transitionState);
}

async function auditTransitions(
  browser: Browser,
  origin: string,
  collections: readonly string[],
): Promise<void> {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const label = `transitions ${reducedMotion}`;
    const { context, page } = await openSession(browser, origin, label, { reducedMotion }, [
      recordTransition,
    ]);
    for (const collection of collections) {
      await page.goto(new URL(collection, origin).href);
      const entry = page.locator(`main a[href^="${collection}"]:has([data-title])`);
      if ((await entry.count()) === 0) {
        report(`${label} ${collection}`, "No entry links to navigate to");
        continue;
      }
      await entry.first().click();
      await page.waitForURL((url) => url.pathname !== collection);
      const forward = await settledTransition(page);
      await page.goBack();
      await page.waitForURL(new URL(collection, origin).href);
      if (reducedMotion === "reduce") {
        expect(`${label} ${collection}`, forward !== "animated", "Animated with reduced motion");
      } else {
        expect(`${label} ${collection}`, forward === "animated", `Transition was ${forward}`);
      }
    }
    await context.close();
  }
  console.log("Validated view transitions with and without reduced motion");
}

export async function auditSiteFlows(
  browser: Browser,
  origin: string,
  paths: readonly string[],
  { collections, navigationTarget }: SiteTargets,
): Promise<void> {
  await auditWithoutJavaScript(browser, origin, paths);
  await auditThemes(browser, origin, navigationTarget);
  await auditBlockedStorage(browser, origin);
  await auditKeyboard(browser, origin);
  await auditTransitions(browser, origin, collections);
}
