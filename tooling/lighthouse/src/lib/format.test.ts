import { expect, test } from "bun:test";
import type { Result } from "lighthouse";
import { cell, detailLabels, diagnosticAudits, failingAudits, linkUrl } from "./format.ts";

const lhr = {
  categories: { performance: { auditRefs: [{ id: "close" }, { id: "info" }, { id: "warning" }] } },
  audits: {
    close: { id: "close", score: 0.95, scoreDisplayMode: "numeric" },
    info: {
      id: "info",
      score: null,
      scoreDisplayMode: "informative",
      details: { type: "list", items: [] },
    },
    warning: { id: "warning", score: 1, scoreDisplayMode: "binary", warnings: ["Sample warning"] },
  },
} as unknown as Result;

test("non-perfect audits include scores above ninety without treating warnings as failures", () => {
  expect(failingAudits(lhr, "performance").map((audit) => audit.id)).toEqual(["close"]);
  expect(diagnosticAudits(lhr).map((audit) => audit.id)).toEqual(["warning"]);
});

test("nested details retain resource URLs, element selectors and numeric savings with units", () => {
  const labels = detailLabels({
    type: "list",
    items: [
      {
        type: "table",
        headings: [
          { key: "wasted", valueType: "bytes" },
          { key: "duration", valueType: "ms" },
        ],
        items: [
          {
            url: "https://example.test/image.webp",
            wasted: 2048,
            subItems: {
              type: "subitems",
              items: [
                { duration: 12.5, node: { selector: "img.hero", snippet: '<img alt="Sample">' } },
              ],
            },
          },
        ],
      },
    ],
  }).join("\n");
  expect(labels).toContain("https://example.test/image.webp");
  expect(labels).toContain("wasted: 2048 bytes (2 KiB)");
  expect(labels).toContain("duration: 12.5 ms");
  expect(labels).toContain("selector: img.hero");
  expect(labels).toContain('<img alt="Sample">');
});

test("Markdown content and URL destinations cannot create extra table cells or links", () => {
  const escaped = cell("[fake](url) | *bold* `code`\n<node>");
  for (const delimiter of ["[", "]", "|", "*", "`", "<", ">"]) {
    expect(escaped).toContain(`\\${delimiter}`);
  }
  expect(escaped).not.toContain("\n");
  expect(linkUrl("https://example.test/a(b)?q=some value")).toBe(
    `https://example.test/${"a%28b%29"}?q=${"some%20value"}`,
  );
});

test("untyped numeric fields retain raw values instead of inferred units", () => {
  const labels = detailLabels({
    type: "table",
    items: [
      { startTime: 1.2, fontSize: 16, transferSize: 100, wastedBytes: 1024, overallSavingsMs: 20 },
    ],
  }).join("\n");
  expect(labels).toContain("startTime: 1.2; fontSize: 16; transferSize: 100");
  expect(labels).toContain("wastedBytes: 1024 bytes (1 KiB)");
  expect(labels).toContain("overallSavingsMs: 20 ms");
});

test("binary screenshots and empty informative audits stay in JSON rather than Markdown", () => {
  const report = {
    audits: {
      screenshot: {
        id: "final-screenshot",
        scoreDisplayMode: "informative",
        details: { data: "data:image/png;base64,synthetic", timing: 100 },
      },
      empty: {
        id: "empty",
        scoreDisplayMode: "informative",
        details: { type: "table", items: [] },
      },
      numeric: { id: "numeric", scoreDisplayMode: "informative", numericValue: 0 },
    },
  } as unknown as Result;
  expect(diagnosticAudits(report).map((audit) => audit.id)).toEqual(["numeric"]);
});
