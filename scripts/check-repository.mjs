import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const maximumBytes = 2 * 1024 * 1024;
const forbidden = [/(^|\/)\.DS_Store$/, /(^|\/)dist\//, /(^|\/)node_modules\//, /(^|\/)\.env$/];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const failures = [];
const normalized = new Map();

for (const file of files) {
  const key = file.normalize("NFC").toLowerCase();
  if (normalized.has(key)) failures.push(`${file}: collides with ${normalized.get(key)}`);
  else normalized.set(key, file);
  if (forbidden.some((pattern) => pattern.test(file)))
    failures.push(`${file}: forbidden tracked path`);
  const size = statSync(file).size;
  if (size > maximumBytes) failures.push(`${file}: ${size} bytes exceeds ${maximumBytes}`);
  const buffer = readFileSync(file);
  if (buffer.includes(0) || buffer.length === 0) continue;
  const text = buffer.toString("utf8");
  if (text.includes("\r\n")) failures.push(`${file}: CRLF line endings are not allowed`);
  if (!text.endsWith("\n")) failures.push(`${file}: missing trailing newline`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`validated ${files.length} tracked paths`);
