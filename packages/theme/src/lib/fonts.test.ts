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

test("core and original fonts cover Unicode without overlapping ranges", () => {
  const faces = fontFaces();
  expect(faces).toHaveLength(4);
  for (const weight of [400, 700]) {
    const selected = faces.filter((face) => face.weight === weight);
    const ranges = selected.flatMap((face) => face.ranges).sort((a, b) => a[0] - b[0]);
    expect(ranges[0]?.[0]).toBe(0);
    expect(ranges.at(-1)?.[1]).toBe(0x10ffff);
    for (let index = 1; index < ranges.length; index += 1) {
      expect(ranges[index]?.[0]).toBe((ranges[index - 1]?.[1] ?? -1) + 1);
    }
    for (const face of selected) {
      expect(
        readFileSync(themeFile(face.source.slice(1)))
          .subarray(0, 4)
          .toString(),
      ).toBe("wOF2");
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
