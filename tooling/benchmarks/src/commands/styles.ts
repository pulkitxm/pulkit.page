import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { root } from "../styles/config.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: "string", default: join(root, "reports/style-benchmark") },
    phase: { type: "string", default: "all" },
    runs: { type: "string", default: "9" },
    smoke: { type: "boolean", default: false },
  },
});
const output = resolve(values.output);
const stages = ["prepare", "verify", "measure", "report"];
if (values.phase !== "all" && !stages.includes(values.phase)) {
  throw new Error("phase must be all, prepare, verify, measure or report");
}
for (const phase of stages.filter((stage) => values.phase === "all" || values.phase === stage)) {
  const names: Record<string, string> = {
    prepare: "prepare-styles",
    verify: "verify-style-variants",
    measure: "measure-styles",
    report: "render-style-report",
  };
  let argumentsForStage = [output];
  if (phase === "measure") {
    argumentsForStage = [
      "--output",
      output,
      "--runs",
      values.runs,
      ...(values.smoke ? ["--smoke"] : []),
    ];
  }
  if (phase === "report" && values.smoke) {
    argumentsForStage.push("smoke.json");
  }
  const result = spawnSync(
    process.execPath,
    [join(root, `tooling/benchmarks/src/commands/${names[phase]}.ts`), ...argumentsForStage],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`${phase} failed`);
  }
}
