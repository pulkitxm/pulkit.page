import type { SpawnSyncReturns } from "node:child_process";
import process from "node:process";
import { fixtureSite, runCommand } from "./harness.ts";

export const pageSource =
  "---\ntitle: Building things\ndescription: Example page.\nlayout: home\n---\n\nSoftware engineer based in India.\n";

const fixtureEnv = { ...process.env, NODE_ENV: "production", SITE_URL: "" };

export function buildProject(files: Readonly<Record<string, string>> = {}): string {
  return fixtureSite("homepage-test-", {
    CNAME: "example.com\n",
    "content/_site.md": "---\nbrand: Pulkit\n---\n",
    "content/home.md": pageSource,
    "assets/example.txt": "asset",
    "styles.css": "",
    ...files,
  });
}

export function build(cwd: string, env: NodeJS.ProcessEnv = fixtureEnv): SpawnSyncReturns<string> {
  return runCommand("build", cwd, env);
}

export function buildEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...fixtureEnv, ...overrides };
}
