import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assetFile, themeFile } from "./files.ts";

function withAppAssets(files: Record<string, string>, check: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "theme-assets-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), body);
    }
    check(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("theme files resolve inside the theme package", () => {
  expect(themeFile("src/client/theme.ts")).toMatch(/packages\/theme\/src\/client\/theme\.ts$/);
  expect(themeFile("layouts")).toMatch(/packages\/theme\/layouts$/);
});

test("app assets win over shared assets with the same path", () => {
  withAppAssets({ "content/pulkit-portrait.webp": "app" }, (assets) => {
    expect(assetFile("/assets/content/pulkit-portrait.webp", assets)).toBe(
      join(assets, "content/pulkit-portrait.webp"),
    );
  });
});

test("missing app assets fall back to the shared theme assets", () => {
  withAppAssets({}, (assets) => {
    expect(assetFile("/assets/favicon.svg", assets)).toBe(themeFile("assets/favicon.svg"));
    expect(assetFile("/assets/fonts/comic-relief-regular-latin.woff2", assets)).toBe(
      themeFile("assets/fonts/comic-relief-regular-latin.woff2"),
    );
  });
});

test("paths outside /assets/, missing files and traversal resolve to nothing", () => {
  withAppAssets({ "a.txt": "a" }, (assets) => {
    expect(assetFile("/styles.css", assets)).toBeUndefined();
    expect(assetFile("/assets/missing.png", assets)).toBeUndefined();
    expect(assetFile("/assets/../package.json", assets)).toBeUndefined();
    expect(assetFile("/assets/../../package.json", assets)).toBeUndefined();
  });
});
