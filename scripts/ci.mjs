import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts ?? {};
const ordered = [
  "check:comments",
  "check:repository",
  "format:check",
  "lint",
  "test",
  "check:generated",
  "typecheck",
  "build",
  "check:site",
];
const additional = Object.keys(scripts)
  .filter((name) => name.startsWith("check:") && !ordered.includes(name))
  .sort();
const selected = [...ordered, ...additional].filter((name) => scripts[name]);

for (const name of selected) {
  console.log(`\n$ bun run ${name}`);
  const result = spawnSync("bun", ["run", name], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\ncompleted ${selected.length} required checks`);
