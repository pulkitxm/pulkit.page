import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sharedAssets = resolve(root, "assets");

export function themeFile(path) {
  return resolve(root, path);
}

function inside(directory, path) {
  const file = resolve(directory, `.${path}`);
  return file.startsWith(`${directory}${sep}`) ? file : undefined;
}

export function assetFile(pathname, appAssets = resolve("assets")) {
  if (!pathname.startsWith("/assets/")) {
    return;
  }
  const path = pathname.slice("/assets".length);
  return [inside(appAssets, path), inside(sharedAssets, path)].find(
    (file) => file && existsSync(file),
  );
}
