import { readdirSync } from "node:fs";
import { join } from "node:path";

const developmentOutput = /^dev-[0-9]+$/;

export function builtFiles(root) {
  function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (directory === root && developmentOutput.test(entry.name)) {
        return [];
      }
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  }
  return walk(root);
}

export function builtRoutes(root) {
  function walk(directory, prefix) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        return entry.name === "assets" || developmentOutput.test(entry.name)
          ? []
          : walk(join(directory, entry.name), `${prefix}${entry.name}/`);
      }
      return entry.name === "index.html" ? [prefix] : [];
    });
  }
  return walk(root, "/");
}
