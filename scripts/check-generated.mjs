import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

function snapshot() {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (!packageJson.scripts?.generate) {
  console.log("no generate script is defined, generated-file check skipped");
  process.exit(0);
}

const before = snapshot();
const result = spawnSync("bun", ["run", "generate"], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
const after = snapshot();

if (before !== after) {
  console.error("generated files are stale, run `bun run generate` and commit the result");
  const status = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
  process.stderr.write(status);
  process.exit(1);
}

console.log("generated files match their sources");
