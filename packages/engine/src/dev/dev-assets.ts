import { existsSync, readFileSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { bundleDemoScripts, compileDemoStyles, fontFile } from "@pulkit/demos/assets";
import { bundleEmbedScripts, katexDirectory, photoswipeStyles } from "@pulkit/embeds/bundle";
import { assetFile } from "@pulkit/theme/files";

type AssetResolution =
  | { kind: "vite" }
  | { kind: "missing" }
  | { kind: "file"; type: string; body: string | Buffer };

export interface DevelopmentAssets {
  resolve(pathname: string): Promise<AssetResolution> | undefined;
  invalidateDemos(): void;
}

const sharedTypes: Readonly<Record<string, string>> = {
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

const demoOutput = ".cache/demos-dev";
const embedOutput = ".cache/embeds-dev";
const missing: AssetResolution = { kind: "missing" };
const vite: AssetResolution = { kind: "vite" };

function file(type: string, body: string | Buffer): AssetResolution {
  return { kind: "file", type, body };
}

function katexAsset(pathname: string): AssetResolution {
  const katex = resolve(katexDirectory);
  const path = resolve(katex, `.${pathname.slice("/assets/katex".length)}`);
  if (!path.startsWith(`${katex}${sep}`) || !existsSync(path)) {
    return missing;
  }
  return file(path.endsWith(".css") ? "text/css" : "font/woff2", readFileSync(path));
}

function sharedAsset(pathname: string, appAssets: string): AssetResolution {
  const path = assetFile(pathname === "/favicon.ico" ? "/assets/favicon-32.png" : pathname);
  if (!path) {
    return missing;
  }
  if (realpathSync(path).startsWith(`${appAssets}${sep}`)) {
    return vite;
  }
  return file(sharedTypes[extname(path)] ?? "application/octet-stream", readFileSync(path));
}

export function developmentAssets(): DevelopmentAssets {
  const appAssets = resolve("assets");
  let embedBundle: Promise<void> | undefined;
  let demoBundle: Promise<void> | undefined;
  let demoStyles: ReturnType<typeof compileDemoStyles> | undefined;

  async function embedAsset(name: string): Promise<AssetResolution> {
    if (name === "photoswipe.css") {
      return file("text/css", readFileSync(photoswipeStyles));
    }
    if (!/-[a-z0-9]{8}\.js$/.test(name) || !embedBundle) {
      embedBundle = (embedBundle ?? Promise.resolve()).then(async () => {
        await rm(embedOutput, { force: true, recursive: true });
        await bundleEmbedScripts(embedOutput, { minify: false });
      });
    }
    await embedBundle;
    const path = resolve(embedOutput, name);
    if (!/^[\w.-]+\.js$/.test(name) || !existsSync(path)) {
      return missing;
    }
    return file("text/javascript", readFileSync(path));
  }

  async function demoAsset(name: string): Promise<AssetResolution> {
    if (name === "demos.css" || name === "document.css") {
      demoStyles ??= compileDemoStyles({ minify: false });
      return file("text/css", name === "demos.css" ? demoStyles.shadow : demoStyles.document);
    }
    const font = fontFile(name);
    if (font) {
      return file("font/woff2", readFileSync(font));
    }
    if (!/^[\w.-]+\.js$/.test(name)) {
      return missing;
    }
    if (name === "index.js" || !demoBundle) {
      demoBundle = rm(demoOutput, { force: true, recursive: true }).then(() =>
        bundleDemoScripts(demoOutput, { minify: false }),
      );
    }
    await demoBundle;
    const path = resolve(demoOutput, name);
    return existsSync(path) ? file("text/javascript", readFileSync(path)) : missing;
  }

  return {
    resolve(pathname) {
      if (pathname.startsWith("/@") || pathname.startsWith("/node_modules/")) {
        return Promise.resolve(vite);
      }
      if (pathname.startsWith("/assets/katex/")) {
        return Promise.resolve(katexAsset(pathname));
      }
      if (pathname.startsWith("/assets/embeds/")) {
        return embedAsset(pathname.slice("/assets/embeds/".length));
      }
      if (pathname.startsWith("/assets/demos/")) {
        return demoAsset(pathname.slice("/assets/demos/".length));
      }
      if (pathname === "/styles.css") {
        return Promise.resolve(vite);
      }
      return pathname === "/favicon.ico" || pathname.startsWith("/assets/")
        ? Promise.resolve(sharedAsset(pathname, appAssets))
        : undefined;
    },
    invalidateDemos() {
      demoBundle = undefined;
      demoStyles = undefined;
    },
  };
}
