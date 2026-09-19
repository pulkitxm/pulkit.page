#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const commands = {
  dev: ["--watch", "dev.mjs"],
  build: ["build.mjs"],
  start: ["start.mjs"],
  clean: ["clean.mjs"],
  "check-layouts": ["check-layouts.mjs"],
  "check-seo": ["check-seo.mjs"],
  "check-site": ["check-site.mjs", "dist"],
  "check-browser": ["check-browser.mjs"],
};
const [name, ...rest] = process.argv.slice(2);
const command = commands[name];
if (!command) {
  console.error(`Usage: site <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
const [first, ...others] = command;
const script = (file) => fileURLToPath(new URL(file, import.meta.url));
const args = first === "--watch" ? [first, script(others[0])] : [script(first), ...others, ...rest];
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
