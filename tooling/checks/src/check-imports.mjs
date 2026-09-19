import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { parse } from "@babel/parser";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(
    (file) =>
      /^(?:apps|packages|tooling)\/.+\.m?js$/.test(file) &&
      !file.includes("/node_modules/") &&
      existsSync(file),
  );
const failures = [];
for (const file of files) {
  const require = createRequire(resolve(file));
  const tree = parse(readFileSync(file, "utf8"), { sourceType: "module" });
  for (const node of tree.program.body) {
    if (
      !node.source ||
      !["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)
    ) {
      continue;
    }
    const specifier = node.source.value;
    if (isBuiltin(specifier) || (specifier === "bun:test" && file.endsWith(".test.js"))) {
      continue;
    }
    try {
      require.resolve(specifier);
    } catch {
      failures.push(`${file}:${node.loc.start.line}: unresolved import ${specifier}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Resolved static imports in ${files.length} JavaScript modules`);
