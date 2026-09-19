import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sharedAssets = resolve(root, "assets");

export function themeFile(path: string): string {
  return resolve(root, path);
}

function inside(directory: string, path: string): string | undefined {
  const file = resolve(directory, `.${path}`);
  return file.startsWith(`${directory}${sep}`) ? file : undefined;
}

export function assetFile(pathname: string, appAssets = resolve("assets")): string | undefined {
  if (!pathname.startsWith("/assets/")) {
    return;
  }
  const path = pathname.slice("/assets".length);
  return [inside(appAssets, path), inside(sharedAssets, path)].find(
    (file) => file !== undefined && existsSync(file),
  );
}
