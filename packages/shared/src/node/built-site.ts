import { relative, sep } from "node:path";
import { walkFiles } from "./files.ts";

export const developmentOutput = /^dev-[0-9]+$/;

export function developmentOutputName(port: string): string {
  return `dev-${port}`;
}

export function builtFiles(root: string): string[] {
  return walkFiles(
    root,
    (entry, directory) => directory === root && developmentOutput.test(entry.name),
  );
}

export function builtRoutes(root: string): string[] {
  return walkFiles(
    root,
    (entry) =>
      entry.isDirectory() && (entry.name === "assets" || developmentOutput.test(entry.name)),
  )
    .map((file) => `/${relative(root, file).split(sep).join("/")}`)
    .filter((file) => file.endsWith("/index.html"))
    .map((file) => file.slice(0, -"index.html".length));
}
