import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = resolve(import.meta.dir);

test("cleanup removes complete output and cache trees, preserves sources and packages, and tolerates missing trees", () => {
  const directory = mkdtempSync(join(tmpdir(), "page-clean-test-"));
  try {
    const removed = ["dist", ".cache", ".turbo", "node_modules/.vite", "node_modules/.vite-temp"];
    const preserved = ["content", "layouts", "node_modules/example"];
    for (const path of [...removed, ...preserved]) {
      mkdirSync(join(directory, path, "nested"), { recursive: true });
      writeFileSync(join(directory, path, "nested/fixture.txt"), "fixture\n");
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync("bun", [join(source, "clean.mjs")], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      for (const path of removed) {
        expect(existsSync(join(directory, path))).toBe(false);
      }
      for (const path of preserved) {
        expect(existsSync(join(directory, path, "nested/fixture.txt"))).toBe(true);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
