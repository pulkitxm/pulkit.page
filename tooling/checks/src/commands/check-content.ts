import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { errorMessage, reportFailures } from "@pulkit/shared/failures";
import { repositoryFiles } from "@pulkit/shared/repository";
import { checkContent, sitePath } from "../lib/content/check-content.ts";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--write") || args.length > 1) {
  throw new Error("Usage: check-content.ts [--write]");
}
const write = args.includes("--write");
const files = repositoryFiles().filter(
  (file) => /\.(md|mdx|ya?ml)$/i.test(file) || sitePath(file).file.startsWith("content/"),
);
const failures: string[] = [];
for (const file of files) {
  try {
    const source = readFileSync(file, "utf8");
    const { errors, formatted } = checkContent(file, source);
    failures.push(...errors.map((error) => `${file}:${error}`));
    if (formatted !== source) {
      if (write && errors.length === 0) {
        writeFileSync(file, formatted);
      } else {
        failures.push(`${file}: noncanonical formatting; run bun run format`);
      }
    }
  } catch (error) {
    failures.push(`${file}: ${errorMessage(error)}`);
  }
}
reportFailures(failures, `Validated ${files.length} Markdown/YAML files and content conventions`);
