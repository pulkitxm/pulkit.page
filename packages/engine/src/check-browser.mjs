import { existsSync, readdirSync, statSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import process from "node:process";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { preview } from "vite";
import { readSite } from "./site-inventory.mjs";

const buildDirectory = "dist";
const themeKey = "portfolio-theme";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const selectedViewport = process.env.BROWSER_VIEWPORT;
const auditedViewports = viewports.filter(
  (viewport) => !selectedViewport || viewport.name === selectedViewport,
);
if (auditedViewports.length === 0) {
  throw new Error(`Unknown BROWSER_VIEWPORT ${selectedViewport}`);
}
const auditsSiteFlows = auditedViewports.includes(viewports[0]);
const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const themeDependentRules = ["color-contrast", "link-in-text-block"];
const workersPerViewport = Math.max(
  1,
  Math.floor(availableParallelism() / auditedViewports.length),
);
const blockingImpacts = new Set(["serious", "critical"]);
const { pages, site } = readSite("http://localhost");
const collections = pages.filter((page) => page.index).map((page) => page.route);
const navigationTarget = site.navigation.find((item) => item.href.startsWith("/")).href;
const problems = new Set();

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

function report(scope, message) {
  problems.add(`${scope}: ${message}`);
}

function expect(scope, condition, message) {
  if (!condition) {
    report(scope, message);
  }
}

function isBuiltFile(pathname) {
  const file = join(buildDirectory, decodeURIComponent(pathname));
  return existsSync(file) && statSync(file).isFile();
}

async function openSession(browser, origin, label, options = {}, initScripts = []) {
  const context = await browser.newContext({
    viewport: viewports[0],
    colorScheme: "light",
    ...options,
  });
  for (const script of initScripts) {
    await context.addInitScript(script);
  }
  const page = await context.newPage();
  const scope = () => `${label} ${new URL(page.url()).pathname}`;
  const embedded = (source) =>
    Boolean(source) && /^https?:\/\//.test(source) && !source.startsWith(origin);
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

async function waitForImages(page) {
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) {
      image.loading = "eager";
    }
  });
  await page.waitForFunction(
    () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate(() => document.fonts.ready);
}

function inspectDocument() {
  const viewportWidth = document.documentElement.clientWidth;
  const clipsHorizontally = (element) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== "visible") {
        return true;
      }
    }
    return false;
  };
  const describe = (element) =>
    [element.tagName.toLowerCase(), element.id && `#${element.id}`, element.classList[0]]
      .filter(Boolean)
      .join(".");
  return {
    mains: document.querySelectorAll("main").length,
    headings: document.querySelectorAll("h1").length,
    lang: document.documentElement.lang,
    viewportMeta: document.getElementsByName("viewport")[0]?.content ?? "",
    title: document.title.trim(),
    overflow: document.documentElement.scrollWidth - viewportWidth,
    overflowing: [...document.body.querySelectorAll("*")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > viewportWidth + 1 && !clipsHorizontally(element),
      )
      .slice(0, 3)
      .map(describe),
    unsafeBlankLinks: [...document.querySelectorAll('a[target="_blank"]')]
      .filter((link) => !/\bnoopener\b|\bnoreferrer\b/.test(link.rel))
      .map((link) => link.href),
    emptyLinks: [...document.querySelectorAll("a[href]")]
      .filter((link) => !link.textContent.trim() && !link.getAttribute("aria-label"))
      .filter((link) => !link.querySelector("img")?.alt.trim())
      .map((link) => link.href),
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index),
    ids: [...document.querySelectorAll("[id], a[name]")].map(
      (element) => element.id || element.getAttribute("name"),
    ),
    links: [...document.querySelectorAll("a[href]")].map((link) => link.href),
  };
}

async function auditAccessibility(page, scope) {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selected) => {
      document.documentElement.dataset.theme = selected;
    }, theme);
    const builder = new AxeBuilder({ page }).exclude(["iframe", "*"]).setLegacyMode(true);
    const { violations } = await (theme === "light"
      ? builder.withTags(axeTags)
      : builder.withRules(themeDependentRules)
    ).analyze();
    for (const violation of violations.filter((item) => blockingImpacts.has(item.impact))) {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ");
      report(`${scope} ${theme}`, `axe ${violation.id} (${violation.impact}) at ${targets}`);
    }
  }
}

async function auditPage(page, viewport, path, origin) {
  const scope = `${viewport.name} ${path}`;
  const response = await page.goto(new URL(path, origin).href);
  if (response?.status() !== 200) {
    report(scope, `Page returned HTTP ${response?.status()}`);
    return null;
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

async function auditViewport(browser, origin, paths, viewport) {
  const queue = [...paths];
  const results = new Map();
  await Promise.all(
    Array.from({ length: Math.min(workersPerViewport, paths.length) }, async () => {
      const { context, page } = await openSession(browser, origin, viewport.name, { viewport });
      for (let path = queue.shift(); path; path = queue.shift()) {
        results.set(path, await auditPage(page, viewport, path, origin));
      }
      await context.close();
    }),
  );
  console.log(`Audited ${paths.length} pages at ${viewport.width}px`);
  return results;
}

async function auditPages(browser, origin, paths) {
  const [primary] = await Promise.all(
    auditedViewports.map((viewport) => auditViewport(browser, origin, paths, viewport)),
  );
  return new Map(
    paths.filter((path) => primary.get(path)).map((path) => [path, primary.get(path)]),
  );
}

function auditLinks(documents, origin) {
  let checked = 0;
  for (const [source, { links }] of documents) {
    for (const href of links) {
      const url = new URL(href);
      if (url.origin !== origin) {
        continue;
      }
      checked += 1;
      const scope = `links ${source}`;
      if (!documents.has(url.pathname)) {
        if (documents.has(`${url.pathname}/`)) {
          report(scope, `Link to ${url.pathname} is missing its trailing slash`);
        } else if (!isBuiltFile(url.pathname)) {
          report(scope, `Broken link to ${url.pathname}`);
        }
        continue;
      }
      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment && !documents.get(url.pathname).ids.includes(fragment)) {
        report(scope, `Missing anchor ${url.pathname}#${fragment}`);
      }
    }
  }
  console.log(`Checked ${checked} internal links and anchors`);
}

async function auditWithoutJavaScript(browser, origin, paths) {
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

function recordThemeAtBody() {
  const observer = new MutationObserver(() => {
    if (document.body) {
      window.themeAtBody = document.documentElement.dataset.theme ?? null;
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}

const readTheme = (page) => page.locator("html").getAttribute("data-theme");
const readBackground = (page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const readStoredTheme = (page, key) => page.evaluate((name) => localStorage.getItem(name), key);

async function auditThemeFlow(browser, origin, systemScheme) {
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
    (await page.evaluate(() => window.themeAtBody)) === other,
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

async function auditThemes(browser, origin) {
  const light = await auditThemeFlow(browser, origin, "light");
  const dark = await auditThemeFlow(browser, origin, "dark");
  expect("theme", light.toggled === dark.initial, "Chosen dark differs from system dark");
  expect("theme", dark.toggled === light.initial, "Chosen light differs from system light");
  console.log("Validated theme toggle, persistence and system preference");
}

function blockStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage is blocked", "SecurityError");
    },
  });
}

async function auditBlockedStorage(browser, origin) {
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

async function auditKeyboard(browser, origin) {
  const label = "keyboard";
  const { context, page } = await openSession(browser, origin, label);
  await page.goto(origin);
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute("href"),
    visible: document.activeElement?.getBoundingClientRect().top >= 0,
  }));
  expect(label, skip.href === "#main", "First tab stop is not the skip link");
  expect(label, skip.visible, "Skip link stays off screen when focused");
  await page.keyboard.press("Enter");
  expect(label, new URL(page.url()).hash === "#main", "Skip link did not jump to main");
  let reached = false;
  for (let step = 0; step < 200 && !reached; step += 1) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.hasAttribute("data-theme-toggle"));
  }
  expect(label, reached, "Theme toggle is not reachable with Tab");
  if (reached) {
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle,
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

function recordTransition() {
  window.addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    window.transitionState = transition ? "pending" : "none";
    transition?.ready.then(
      () => {
        window.transitionState = "animated";
      },
      () => {
        window.transitionState = "skipped";
      },
    );
  });
}

async function settledTransition(page) {
  await page.waitForFunction(() => window.transitionState && window.transitionState !== "pending");
  return page.evaluate(() => window.transitionState);
}

async function auditTransitions(browser, origin) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
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

const server = await preview({
  configFile: false,
  appType: "mpa",
  logLevel: "silent",
  preview: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  const paths = routes(buildDirectory);
  if (paths.length === 0) {
    report("build", "The build must contain pages");
  }
  const documents = await auditPages(browser, origin, paths);
  auditLinks(documents, origin);
  if (auditsSiteFlows) {
    await auditWithoutJavaScript(browser, origin, paths);
    await auditThemes(browser, origin);
    await auditBlockedStorage(browser, origin);
    await auditKeyboard(browser, origin);
    await auditTransitions(browser, origin);
  }
} finally {
  await browser?.close();
  await server.close();
}
if (problems.size > 0) {
  console.error(`\n${problems.size} browser problems:\n${[...problems].join("\n")}`);
  process.exitCode = 1;
}
