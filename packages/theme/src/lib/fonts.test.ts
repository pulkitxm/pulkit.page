import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { themeFile } from "./files.ts";

function fontFaces(): Array<{ source: string; weight: number; ranges: [number, number][] }> {
  return [...readFileSync(themeFile("styles.css"), "utf8").matchAll(/@font-face\s*{([^}]+)}/g)].map(
    ([, rules = ""]) => ({
      source: /url\("([^"]+)"\)/.exec(rules)?.[1] ?? "",
      weight: Number(/font-weight:\s*(\d+)/.exec(rules)?.[1]),
      ranges: [...rules.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/g)].map(([, start = "", end]) => [
        Number.parseInt(start, 16),
        Number.parseInt(end ?? start, 16),
      ]),
    }),
  );
}

test("font ranges match original coverage and exclude unsupported characters", () => {
  const faces = fontFaces();
  const supportedRanges =
    "20-7E,A0-FF,131,152-153,2C6,2DA,2DC,2013-2015,2017-201E,2020-2022,2026,2030,2032-2033,2039-203A,203C,203E,2044,20AC,2122,2212,2215";
  const supported = new Set<number>();
  for (const range of supportedRanges.split(",")) {
    const [first = "", last = first] = range.split("-");
    for (let point = Number.parseInt(first, 16); point <= Number.parseInt(last, 16); point += 1) {
      supported.add(point);
    }
  }
  expect(faces).toHaveLength(4);
  expect(supported.size).toBe(224);
  for (const weight of [400, 700]) {
    const selected = faces.filter((face) => face.weight === weight);
    const coverage = new Set<number>();
    for (const face of selected) {
      expect(
        readFileSync(themeFile(face.source.slice(1)))
          .subarray(0, 4)
          .toString(),
      ).toBe("wOF2");
      for (const [first, last] of face.ranges) {
        for (let point = first; point <= last; point += 1) {
          expect(coverage.has(point)).toBe(false);
          coverage.add(point);
        }
      }
    }
    expect(coverage).toEqual(supported);
    for (const character of ["🤞", "✌", "🏻", "↗", "→", "中"]) {
      expect(coverage.has(character.codePointAt(0) ?? -1)).toBe(false);
    }
    for (const [character, suffix] of [
      ["a", "core"],
      ["é", "core"],
      ["ê", "latin"],
      ["€", "latin"],
    ]) {
      const codepoint = character?.codePointAt(0) ?? -1;
      const face = selected.find((candidate) =>
        candidate.ranges.some(([first, last]) => first <= codepoint && codepoint <= last),
      );
      expect(face?.source).toEndWith(`-${suffix}.woff2`);
    }
  }
});

test("preloads fetch only smaller core fonts and retain the original font assets", () => {
  const head = readFileSync(themeFile("layouts/partials/head.html"), "utf8");
  let saved = 0;
  for (const weight of ["regular", "bold"]) {
    const core = `assets/fonts/comic-relief-${weight}-core.woff2`;
    const original = `assets/fonts/comic-relief-${weight}-latin.woff2`;
    expect(head).toContain(`href="/${core}"`);
    expect(head).not.toContain(`href="/${original}"`);
    saved += readFileSync(themeFile(original)).length - readFileSync(themeFile(core)).length;
  }
  expect(saved).toBeGreaterThan(10_000);
});
