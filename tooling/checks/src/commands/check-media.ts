import { reportFailures } from "@pulkit/shared/failures";
import { repositoryFiles } from "@pulkit/shared/repository";
import { mediaKind } from "../lib/media/policy.ts";
import { validateMedia } from "../lib/media/validate.ts";

const files = repositoryFiles().filter((file) => mediaKind(file));
const failures: string[] = [];
for (const file of files) {
  const issues = await validateMedia(file);
  if (issues.length > 0) {
    failures.push(...issues, `Fix: bun run media:optimize ${JSON.stringify(file)}`);
  }
}
reportFailures(
  failures,
  `Validated ${files.length} media assets: formats, sizes, dimensions, animation and video playback budgets`,
);
