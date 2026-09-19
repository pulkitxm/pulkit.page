import { errorMessage, reportFailures } from "@pulkit/shared/failures";
import { readRepositoryText, repositoryFiles } from "@pulkit/shared/repository";
import { emDashLines } from "../lib/em-dashes.ts";

const errors: string[] = [];
for (const file of repositoryFiles()) {
  try {
    if (file.includes("\u2014")) {
      errors.push(`${file}: em dash in filename is forbidden`);
    }
    const text = readRepositoryText(file);
    if (text === null) {
      continue;
    }
    for (const line of emDashLines(text)) {
      errors.push(`${file}:${line}: em dash is forbidden`);
    }
  } catch (error) {
    errors.push(errorMessage(error));
  }
}
reportFailures(errors, "No em dashes in repository text files");
