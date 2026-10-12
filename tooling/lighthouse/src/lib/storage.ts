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
  writeFileSync(path, `${JSON.stringify(lhr, null, 2)}\n`);
}
