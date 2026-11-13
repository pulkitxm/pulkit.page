import { expect, test } from "bun:test";
import { replaceNoticeSections, sameImplementation } from "./notice-publication.ts";

test("updates exact current notice sections without changing upstream terms", () => {
  const upstream = "Synthetic upstream grant\nCopyright Sample Author\n";
  const published = `License preface\n\nPackage license\n${upstream}\nProject preface\n${upstream}`;
  const current = replaceNoticeSections(published, [
    { previous: "License preface\n", current: "License scope\r\n" },
    { previous: `Project preface\n${upstream}`, current: `Project license\n${upstream}` },
  ]);
  expect(current).toBe(
    `License scope\n\nPackage license\n${upstream}\nProject license\n${upstream}`,
  );
  expect(current.split(upstream)).toHaveLength(3);
  expect(() =>
    replaceNoticeSections(published, [{ previous: upstream, current: "Changed" }]),
  ).toThrow("exactly once");
  expect(() =>
    replaceNoticeSections(published, [{ previous: "Missing", current: "Changed" }]),
  ).toThrow("exactly once");
});

test("preserves the captured runtime source identity across notice-only updates", () => {
  const captured = [{ path: "index.html", sha256: "a".repeat(64) }];
  expect(sameImplementation(captured, [...captured])).toMatch(/^[a-f0-9]{64}$/);
  expect(() =>
    sameImplementation(captured, [{ path: "index.html", sha256: "b".repeat(64) }]),
  ).toThrow("differs");
  expect(() => sameImplementation(captured, [])).toThrow("differs");
  expect(() =>
    sameImplementation(captured, [...captured, { path: "script.js", sha256: "c".repeat(64) }]),
  ).toThrow("differs");
});
