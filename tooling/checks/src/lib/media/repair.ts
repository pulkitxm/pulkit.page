import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { repositoryFiles } from "@pulkit/shared/repository";
import { optimizeMedia } from "./optimize.ts";
import { mediaKind } from "./policy.ts";
import { validateMedia } from "./validate.ts";

function updateReferences(input: string, output: string, files: string[]): string[] {
  const app = input.match(/^apps\/([^/]+)\/assets\//)?.[1];
  if (!app) {
    throw new Error(`${input}: cannot automatically rename a shared asset; preserve its format`);
  }
  const source = input.replace(/^apps\/[^/]+/, "");
  const target = output.replace(/^apps\/[^/]+/, "");
  const changed: string[] = [];
  for (const file of files) {
    if (
      !(file.startsWith(`apps/${app}/`) || file.startsWith("packages/")) ||
      !/\.(md|json|html|css|ts)$/.test(file)
    ) {
      continue;
    }
    const before = readFileSync(file, "utf8");
    const after = before.replaceAll(source, target);
    if (before !== after) {
      writeFileSync(file, after);
      changed.push(file);
    }
  }
  return changed;
}

export async function repairMedia(): Promise<string[]> {
  const files = repositoryFiles();
  const changed = new Set<string>();
  for (const file of files.filter((candidate) => mediaKind(candidate))) {
    if ((await validateMedia(file)).length === 0) {
      continue;
    }
    let output: string;
    try {
      output = await optimizeMedia(file);
    } catch (error) {
      if (!String(error).includes("quality floor")) {
        throw error;
      }
      output = await optimizeMedia(file, "avif");
    }
    changed.add(file);
    changed.add(output);
    if (output !== file) {
      for (const reference of updateReferences(file, output, files)) {
        changed.add(reference);
      }
      rmSync(file);
    }
    console.log(`Optimized ${file} -> ${output}`);
  }
  return [...changed];
}
