import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import sharp from "sharp";
import { variants } from "./config.ts";
import type { fixtureServers } from "./server.ts";

type Servers = ReturnType<typeof fixtureServers>;
export interface ParityResult {
  engine: string;
  variant: string;
  viewport: number;
  theme: string;
  state: string;
  passed: boolean;
  differences: unknown[];
  pixelMean?: number;
  changedPixels?: number;
  saturatedRadiusDifferences?: number;
}

function snapshot() {
  const properties = [...getComputedStyle(document.documentElement)].filter(
    (name) => !name.startsWith("--") && name !== "transition-property",
  );
  const margins = new Set([
    "margin-left",
    "margin-right",
    "margin-inline-start",
    "margin-inline-end",
  ]);
  return [...document.querySelectorAll("body *")]
    .filter((node) => !["SCRIPT", "STYLE", "TEMPLATE"].includes(node.tagName))
    .map((node) => {
      const box = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        text: node.children.length === 0 ? node.textContent : "",
        rect: [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100),
        styles: [null, "::before", "::after"].map((pseudo) => {
          const style = getComputedStyle(node, pseudo);
          return Object.fromEntries(
            properties.map((name) => {
              const typed = node as Element & {
                computedStyleMap?: () => {
                  get(property: string): { toString(): string } | undefined;
                };
              };
              const value =
                pseudo === null && margins.has(name)
                  ? (typed.computedStyleMap?.().get(name)?.toString() ??
                    style.getPropertyValue(name))
                  : style.getPropertyValue(name);
              return [name, value];
            }),
          );
        }),
      };
    });
}

async function ready(page: Page): Promise<void> {
  await page.addStyleTag({
    content: [
      "*,*::before,*::after {",
      "animation: none !important;",
      "transition: none !important;",
      "content-visibility: visible !important;",
      "}",
    ].join("\n"),
  });
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        image.loading = "eager";
      }
    }
  });
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.evaluate(() => document.fonts.ready);
}

async function pixels(left: Buffer, right: Buffer) {
  const a = await sharp(left).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(right).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { pixelMean: Number.POSITIVE_INFINITY, changedPixels: 1 };
  }
  let sum = 0;
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    let maximum = 0;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs((a.data[index + channel] ?? 0) - (b.data[index + channel] ?? 0));
      sum += delta;
      maximum = Math.max(maximum, delta);
    }
    if (maximum > 8) {
      changed++;
    }
  }
  const count = a.info.width * a.info.height;
  return { pixelMean: sum / (count * 3), changedPixels: changed / count };
}

export async function checkParity(
  browser: Browser,
  engine: string,
  servers: Servers,
  output: string,
): Promise<ParityResult[]> {
  const results: ParityResult[] = [];
  const screenshots = join(output, "screenshots", engine);
  mkdirSync(screenshots, { recursive: true });
  for (const width of [360, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const reference = await context.newPage();
      await reference.goto(servers.get("utilities")?.url ?? "");
      await ready(reference);
      const initial = await reference.screenshot({ fullPage: true });
      const baseline = await reference.evaluate(snapshot);
      writeFileSync(join(screenshots, `utilities-${width}-${theme}.png`), initial);
      for (const variant of variants) {
        if (variant.id === "utilities") {
          continue;
        }
        const page = await context.newPage();
        await page.goto(servers.get(variant.id)?.url ?? "");
        await ready(page);
        const capture = await page.screenshot({ fullPage: true });
        writeFileSync(join(screenshots, `${variant.id}-${width}-${theme}.png`), capture);
        const actual = await page.evaluate(snapshot);
        const differences: unknown[] = [];
        let saturatedRadiusDifferences = 0;
        if (baseline.length !== actual.length) {
          differences.push({ nodes: [baseline.length, actual.length] });
        }
        for (const [index, before] of baseline.entries()) {
          const after = actual[index];
          if (!after || JSON.stringify(before) === JSON.stringify(after)) {
            continue;
          }
          const changes = before.styles.map((style, pseudo) =>
            Object.fromEntries(
              Object.entries(style)
                .filter(([key, value]) => {
                  const other = after.styles[pseudo]?.[key];
                  if (value === other) {
                    return false;
                  }
                  if (
                    /^border-.*radius$/.test(key) &&
                    value.endsWith("px") &&
                    other?.endsWith("px") &&
                    Number.parseFloat(value) > 1000000 &&
                    Number.parseFloat(other) > 1000000
                  ) {
                    saturatedRadiusDifferences++;
                    return false;
                  }
                  return true;
                })
                .map(([key, value]) => [key, [value, after.styles[pseudo]?.[key]]]),
            ),
          );
          if (
            changes.every((change) => Object.keys(change).length === 0) &&
            before.text === after.text &&
            JSON.stringify(before.rect) === JSON.stringify(after.rect)
          ) {
            continue;
          }
          differences.push({
            index,
            tag: before.tag,
            text: before.text === after.text ? undefined : [before.text, after.text],
            rect:
              JSON.stringify(before.rect) === JSON.stringify(after.rect)
                ? undefined
                : [before.rect, after.rect],
            changes,
          });
        }
        const comparison = await pixels(initial, capture);
        const passed =
          differences.length === 0 &&
          comparison.pixelMean < 0.25 &&
          comparison.changedPixels < 0.001;
        results.push({
          engine,
          variant: variant.id,
          viewport: width,
          theme,
          state: "initial",
          passed,
          differences: differences.slice(0, 8),
          ...comparison,
          saturatedRadiusDifferences,
        });
        await page.locator("[data-theme-toggle]").click();
        await page.waitForFunction(
          (expected) => document.documentElement.dataset.theme === expected,
          theme === "light" ? "dark" : "light",
        );
        const colors = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const expectedColor = await reference.evaluate(
          (selected) => {
            document.documentElement.dataset.theme = selected;
            return getComputedStyle(document.body).backgroundColor;
          },
          theme === "light" ? "dark" : "light",
        );
        results.push({
          engine,
          variant: variant.id,
          viewport: width,
          theme,
          state: "theme toggle",
          passed: colors === expectedColor,
          differences: colors === expectedColor ? [] : [{ colors, expectedColor }],
        });
        await reference.evaluate((selected) => {
          document.documentElement.dataset.theme = selected;
        }, theme);
        await page.locator("[data-youtube-play]").click();
        const frame = await page.locator("[data-youtube-embed] iframe").boundingBox();
        const container = await page.locator("[data-youtube-embed]").boundingBox();
        const fits = Boolean(
          frame &&
            container &&
            Math.abs(frame.width - container.width + 4) < 1 &&
            Math.abs(frame.height - container.height + 4) < 1,
        );
        results.push({
          engine,
          variant: variant.id,
          viewport: width,
          theme,
          state: "lazy iframe",
          passed: fits,
          differences: fits ? [] : [{ frame, container }],
        });
        console.log(
          `${engine} ${width} ${theme} ${variant.id}: ${passed ? "parity passed" : "DIFFERENT"}`,
        );
        await page.close();
      }
      await context.close();
    }
  }
  return results;
}
