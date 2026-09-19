import { errorMessage, reportFailures } from "@pulkit/shared/failures";
import { readRepositoryText, repositoryFiles } from "@pulkit/shared/repository";
import { scanText } from "../lib/comments/comment-ranges.ts";

const allowedDirective = /^<!-- \[html-validate-(?:disable|enable)(?:-next|-block)? [a-z-]+\] -->$/;
const errors: string[] = [];
let total = 0;
for (const file of repositoryFiles()) {
  try {
    const source = readRepositoryText(file);
    if (source === null) {
      continue;
    }
    total++;
    for (const comment of await scanText(file, source)) {
      if (!allowedDirective.test(comment.text)) {
        errors.push(`${file}:${comment.line}: forbidden comment: ${comment.text}`);
      }
    }
  } catch (error) {
    errors.push(`${file}: ${errorMessage(error)}`);
  }
}
reportFailures(errors, `No comments in ${total} repository text files`);
