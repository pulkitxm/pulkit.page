import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "lighthouse";
import type { FormFactor } from "./audit.ts";
import { slug } from "./format.ts";

export function reportPath(
  outputDirectory: string,
  domain: string,
  route: string,
  formFactor: FormFactor,
  format: "html" | "json",
): string {
  return join(outputDirectory, format, domain, `${slug(route)}-${formFactor}.${format}`);
}

export function writeRawResult(
  outputDirectory: string,
  domain: string,
  route: string,
  formFactor: FormFactor,
  lhr: Result,
): void {
  const path = reportPath(outputDirectory, domain, route, formFactor, "json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, jsonReport(lhr));
}

export function runnerState(): { runnerRevision: string | null; runnerDirty: boolean | null } {
  try {
    return {
      runnerRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      runnerDirty:
        execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
    };
  } catch {
    return { runnerRevision: null, runnerDirty: null };
  }
}

export function jsonReport(value: object): string {
  return `${JSON.stringify(value, null, 2).replaceAll("\u2014", "\\u2014")}\n`;
}
