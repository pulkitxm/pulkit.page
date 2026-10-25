import { execFileSync, spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { sha256Hex } from "@pulkit/shared/hash";
import { chromium, firefox } from "playwright";
import { sampleVisit } from "../styles/browser.ts";
import {
  type Artifact,
  type BuildSample,
  type NavigationSample,
  type Profile,
  profiles,
  root,
  variants,
} from "../styles/config.ts";
import { fixtureServers } from "../styles/server.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: "string", default: join(root, "reports/style-benchmark") },
    runs: { type: "string", default: "9" },
    smoke: { type: "boolean", default: false },
    "skip-build": { type: "boolean", default: false },
  },
});
const output = resolve(values.output);
const runs = values.smoke ? 1 : Number(values.runs);
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("runs must be a positive integer");
}
const selected = values.smoke
  ? profiles.filter((profile) => ["desktop", "severe"].includes(profile.id))
  : profiles;
const samples: NavigationSample[] = [];
const builds: BuildSample[] = [];
const orders: { stage: string; round: number; order: string[] }[] = [];
const browsers: Record<string, string> = {};
const environment: { engine: string; profile: Profile }[] = [];
const metadata = {
  startedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  inputHash: sha256Hex(readFileSync(join(output, "input/home.html"))),
  cssHash: sha256Hex(readFileSync(join(output, "input/home.css"))),
  host: {
    os: process.platform,
    release: release(),
    arch: process.arch,
    cpu: cpus()[0]?.model,
    logicalCores: cpus().length,
    ramGiB: totalmem() / 1073741824,
    bun: Bun.version,
  },
  runs,
  warmups: values.smoke ? 0 : 1,
  environment,
  browsers,
};
const resultsFile = join(output, values.smoke ? "smoke.json" : "measurements.json");
function save(): void {
  writeFileSync(resultsFile, `${JSON.stringify({ metadata, orders, builds, samples }, null, 2)}\n`);
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

if (!values["skip-build"]) {
  const trialRoot = join(output, "build-trials");
  mkdirSync(trialRoot, { recursive: true });
  for (let round = values.smoke ? 0 : -1; round < runs; round++) {
    const order = shuffle(variants);
    orders.push({ stage: "build", round, order: order.map((variant) => variant.id) });
    for (const variant of order) {
      const target = join(trialRoot, variant.id);
      const start = performance.now();
      const child = spawnSync(
        process.execPath,
        [
          join(root, "tooling/benchmarks/src/commands/build-style-variant.ts"),
          variant.id,
          join(output, "input"),
          target,
        ],
        { cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
      );
      const processMs = performance.now() - start;
      if (child.status !== 0) {
        throw new Error(child.stderr || child.stdout);
      }
      const artifact: Artifact = JSON.parse(readFileSync(join(target, "artifact.json"), "utf8"));
      if (round >= 0) {
        builds.push({
          variant: variant.id,
          round,
          wallMs: artifact.stageMs.pipeline ?? processMs,
          processMs,
          stages: artifact.stageMs,
        });
      }
    }
    save();
    console.log(`build round ${round + 1}/${runs}`);
  }
}

const servers = fixtureServers(
  output,
  variants.map((variant) => variant.id),
);
try {
  for (const [engine, type] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ] as const) {
    const browser = await type.launch();
    browsers[engine] = browser.version();
    const settings: Profile[] =
      engine === "chromium"
        ? [...selected]
        : profiles
            .filter((profile) => ["desktop", "mobile"].includes(profile.id))
            .map((profile) => ({
              ...profile,
              cpu: 1,
              latency: 0,
              download: 0,
              upload: 0,
              label: `${profile.mobile ? "Small-screen" : "Desktop"} Firefox, unthrottled`,
            }));
    try {
      for (const profile of settings) {
        environment.push({ engine, profile });
        for (let round = values.smoke ? 0 : -1; round < runs; round++) {
          const order = shuffle(variants);
          orders.push({
            stage: `${engine}:${profile.id}`,
            round,
            order: order.map((variant) => variant.id),
          });
          for (const variant of order) {
            const server = servers.get(variant.id);
            if (!server) {
              throw new Error(`Missing server ${variant.id}`);
            }
            const measured = await sampleVisit(browser, engine, profile, variant.id, round, server);
            if (round >= 0) {
              samples.push(...measured);
            }
            if (measured.some((sample) => sample.errors.length > 0)) {
              save();
              throw new Error(
                `${engine}:${profile.id} ${variant.id}: ${JSON.stringify(measured.flatMap((sample) => sample.errors))}`,
              );
            }
          }
          save();
          console.log(`${engine}:${profile.id} round ${round + 1}/${runs}`);
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const server of servers.values()) {
    server.close();
  }
}
save();
console.log(`saved ${builds.length} builds and ${samples.length} navigations to ${resultsFile}`);
