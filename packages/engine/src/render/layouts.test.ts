import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtureSite, removeTemporaryDirectories } from "../../test/lib/harness.ts";
import { loadLayouts } from "./layouts.ts";
import { checkLayouts } from "./validate-layouts.ts";

afterEach(removeTemporaryDirectories);

test("all templates reject unknown placeholders, missing includes, cycles, and invalid HTML", async () => {
  const directory = join(fixtureSite("layouts-test-", {}), "layouts");
  const simple = join(directory, "simple.html");
  const original = readFileSync(simple, "utf8");
  writeFileSync(simple, original.replace(/{{\s*content\s*}}/, "{{typo}}"));
  expect(() => loadLayouts(directory)).toThrow("Unknown template placeholder");
  writeFileSync(simple, original.replace(/{{\s*>\s*head\s*}}/, "{{> missing}}"));
  expect(() => loadLayouts(directory)).toThrow("Missing partial");
  writeFileSync(simple, original.replace(/{{\s*content\s*}}/, ""));
  expect(() => loadLayouts(directory)).toThrow("exactly one {{content}}");
  writeFileSync(
    simple,
    original.replace(/{{\s*content\s*}}/, '<img src="/example.png" />{{content}}'),
  );
  await expect(checkLayouts(directory)).rejects.toThrow("Invalid HTML");
  writeFileSync(simple, original);
  writeFileSync(join(directory, "partials/footer.html"), "{{> footer}}\n");
  expect(() => loadLayouts(directory)).toThrow("Circular partial");
});
