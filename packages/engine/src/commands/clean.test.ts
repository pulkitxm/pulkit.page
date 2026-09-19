import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  removeTemporaryDirectories,
  runCommand,
  temporaryDirectory,
} from "../../test/lib/harness.ts";

afterEach(removeTemporaryDirectories);

test("cleanup removes complete output and cache trees, preserves sources and packages, and tolerates missing trees", () => {
  const directory = temporaryDirectory("page-clean-test-");
  const removed = ["dist", ".cache", ".turbo", "node_modules/.vite", "node_modules/.vite-temp"];
  const preserved = ["content", "layouts", "node_modules/example"];
  for (const path of [...removed, ...preserved]) {
    mkdirSync(join(directory, path, "nested"), { recursive: true });
    writeFileSync(join(directory, path, "nested/fixture.txt"), "fixture\n");
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(runCommand("clean", directory).status).toBe(0);
    for (const path of removed) {
      expect(existsSync(join(directory, path))).toBe(false);
    }
    for (const path of preserved) {
      expect(existsSync(join(directory, path, "nested/fixture.txt"))).toBe(true);
    }
  }
});
