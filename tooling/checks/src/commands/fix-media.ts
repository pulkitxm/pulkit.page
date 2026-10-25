import { execFileSync } from "node:child_process";
import process from "node:process";
import { errorMessage, failWith, reportFailures } from "@pulkit/shared/failures";
import { repositoryFiles } from "@pulkit/shared/repository";
import { mediaKind } from "../lib/media/policy.ts";
import { repairMedia } from "../lib/media/repair.ts";
import { validateMedia } from "../lib/media/validate.ts";

const args = process.argv.slice(2);
if (args.some((argument) => argument !== "--stage")) {
  failWith("Usage: bun run media:fix [--stage]");
}
try {
  const changed = await repairMedia();
  const failures: string[] = [];
  for (const file of repositoryFiles().filter((candidate) => mediaKind(candidate))) {
    failures.push(...(await validateMedia(file)));
  }
  reportFailures(failures, "All media assets satisfy their budgets");
  if (args.includes("--stage") && changed.length > 0) {
    execFileSync("git", ["add", "--force", "--", ...changed]);
  }
  console.log(`Repaired ${changed.length} media and reference paths`);
} catch (error) {
  failWith(errorMessage(error));
}
