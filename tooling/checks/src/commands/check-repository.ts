import { lstatSync, readFileSync, statSync } from "node:fs";
import { reportFailures } from "@pulkit/shared/failures";
import { siteConfigFile } from "@pulkit/shared/frontmatter";
import { repositoryFiles } from "@pulkit/shared/repository";

const maximumBytes = 2 * 1024 * 1024;
const maximumSourceLines = 400;
const javaScriptSource = /\.(?:c|m)?jsx?$/;
const forbidden = [/(^|\/)\.DS_Store$/, /(^|\/)dist\//, /(^|\/)node_modules\//, /(^|\/)\.env$/];
const sourcePath =
  /^(?:apps\/[a-z0-9-]+\/(?:content|layouts)|packages\/[a-z0-9-]+\/src|tooling\/[a-z0-9-]+\/src|docs)\//;
const files = repositoryFiles();
const failures: string[] = [];
const normalized = new Map<string, string>();

function sizeLimit(file: string): number {
  return /^apps\/[a-z0-9-]+\/assets\/content\//.test(file) && /\.(gif|webp|png|jpg|pdf)$/.test(file)
    ? 5 * 1024 * 1024
    : maximumBytes;
}

function textFailures(file: string): string[] {
  const buffer = readFileSync(file);
  if (buffer.includes(0) || buffer.length === 0) {
    return [];
  }
  const text = buffer.toString("utf8");
  return [
    ...(text.includes("\r\n") ? [`${file}: CRLF line endings are not allowed`] : []),
    ...(text.endsWith("\n") ? [] : [`${file}: missing trailing newline`]),
    ...(file.endsWith(".ts") && text.split("\n").length - 1 > maximumSourceLines
      ? [`${file}: exceeds ${maximumSourceLines} lines`]
      : []),
  ];
}

for (const file of files) {
  if (lstatSync(file).isSymbolicLink()) {
    failures.push(`${file}: repository symlinks are forbidden`);
    continue;
  }
  if (
    sourcePath.test(file) &&
    !file.endsWith(`/${siteConfigFile}`) &&
    !file.split("/").every((part) => /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/.test(part))
  ) {
    failures.push(`${file}: source paths must use lowercase ASCII kebab-case`);
  }
  if (javaScriptSource.test(file)) {
    failures.push(`${file}: write TypeScript instead of JavaScript`);
  }
  if (/\.(?:log|tmp|bak|orig|rej)$/.test(file)) {
    failures.push(`${file}: temporary or merge artifact is forbidden`);
  }
  const key = file.normalize("NFC").toLowerCase();
  const collision = normalized.get(key);
  if (collision === undefined) {
    normalized.set(key, file);
  } else {
    failures.push(`${file}: collides with ${collision}`);
  }
  if (forbidden.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: forbidden tracked path`);
  }
  const size = statSync(file).size;
  const limit = sizeLimit(file);
  if (size > limit) {
    failures.push(`${file}: ${size} bytes exceeds ${limit}`);
  }
  failures.push(...textFailures(file));
}
reportFailures(failures, `validated ${files.length} repository paths`);
