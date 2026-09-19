#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

interface Command {
  script: string;
  watch?: boolean;
  args?: readonly string[];
}

const commands = new Map<string, Command>([
  ["dev", { script: "dev.ts", watch: true }],
  ["build", { script: "build.ts" }],
  ["start", { script: "start.ts" }],
  ["clean", { script: "clean.ts" }],
  ["check-layouts", { script: "check-layouts.ts" }],
  ["check-seo", { script: "check-seo.ts" }],
  ["check-site", { script: "check-site.ts", args: ["dist"] }],
  ["check-browser", { script: "check-browser.ts" }],
]);
const [name = "", ...rest] = process.argv.slice(2);
const command = commands.get(name);
if (!command) {
  console.error(`Usage: site <${[...commands.keys()].join("|")}>`);
  process.exit(1);
}
const script = fileURLToPath(new URL(`commands/${command.script}`, import.meta.url));
const args = command.watch ? ["--watch", script] : [script, ...(command.args ?? []), ...rest];
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
