import process from "node:process";
import { readRepositoryText, repositoryFiles } from "./repository-files.mjs";

export function emDashLines(text) {
  return text.split("\n").flatMap((line, index) => (line.includes("\u2014") ? [index + 1] : []));
}

if (import.meta.main) {
  const errors = [];
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
      errors.push(error.message);
    }
  }
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("No em dashes in repository text files");
}
