import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import process from "node:process";

const maximumBytes = 2 * 1024 * 1024;
const forbidden = [/(^|\/)\.DS_Store$/, /(^|\/)dist\//, /(^|\/)node_modules\//, /(^|\/)\.env$/];
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((file) => file && existsSync(file));
const failures = [];
const normalized = new Map();

for (const file of files) {
  if (lstatSync(file).isSymbolicLink()) {
    failures.push(`${file}: repository symlinks are forbidden`);
    continue;
  }
  if (
    /^(?:content|layouts|scripts|docs)\//.test(file) &&
    file !== "content/_site.md" &&
    !file.split("/").every((part) => /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/.test(part))
  ) {
    failures.push(`${file}: source paths must use lowercase ASCII kebab-case`);
  }
  if (/\.(?:log|tmp|bak|orig|rej)$/.test(file)) {
    failures.push(`${file}: temporary or merge artifact is forbidden`);
  }
  const key = file.normalize("NFC").toLowerCase();
  if (normalized.has(key)) {
    failures.push(`${file}: collides with ${normalized.get(key)}`);
  } else {
    normalized.set(key, file);
  }
  if (forbidden.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: forbidden tracked path`);
  }
  const size = statSync(file).size;
  const limit =
    file.startsWith("assets/content/") && /\.(gif|webp|png|jpg|pdf)$/.test(file)
      ? 5 * 1024 * 1024
      : maximumBytes;
  if (size > limit) {
    failures.push(`${file}: ${size} bytes exceeds ${limit}`);
  }
  const buffer = readFileSync(file);
  if (buffer.includes(0) || buffer.length === 0) {
    continue;
  }
  const text = buffer.toString("utf8");
  if (text.includes("\r\n")) {
    failures.push(`${file}: CRLF line endings are not allowed`);
  }
  if (!text.endsWith("\n")) {
    failures.push(`${file}: missing trailing newline`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`validated ${files.length} repository paths`);
