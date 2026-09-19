import { readFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { resolve } from "node:path";
import { parse } from "@babel/parser";
import { reportFailures } from "@pulkit/shared/failures";
import { repositoryFiles } from "@pulkit/shared/repository";

const moduleSource = /^(?:apps|packages|tooling)\/.+\.(?:m?js|ts)$/;
const testFile = /\.test\.(?:js|ts)$/;
const files = repositoryFiles().filter(
  (file) => moduleSource.test(file) && !file.includes("/node_modules/"),
);
const failures: string[] = [];
for (const file of files) {
  const require = createRequire(resolve(file));
  const tree = parse(readFileSync(file, "utf8"), {
    sourceType: "module",
    plugins: file.endsWith(".ts") ? ["typescript"] : [],
  });
  for (const node of tree.program.body) {
    if (
      node.type !== "ImportDeclaration" &&
      node.type !== "ExportNamedDeclaration" &&
      node.type !== "ExportAllDeclaration"
    ) {
      continue;
    }
    const specifier = node.source?.value;
    if (
      specifier === undefined ||
      isBuiltin(specifier) ||
      (specifier === "bun:test" && testFile.test(file))
    ) {
      continue;
    }
    try {
      require.resolve(specifier);
    } catch {
      failures.push(`${file}:${node.loc?.start.line}: unresolved import ${specifier}`);
    }
  }
}
reportFailures(
  failures,
  `Resolved static imports in ${files.length} JavaScript and TypeScript modules`,
);
