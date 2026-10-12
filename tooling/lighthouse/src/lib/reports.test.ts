import { expect, test } from "bun:test";
import type { Result } from "lighthouse";
import { pageReport, summaryReport } from "./reports.ts";

function result(): Result {
  const audit = {
    id: "sample",
    title: "Sample warning",
    score: 1,
    scoreDisplayMode: "binary",
    warnings: ["A useful warning even at 100"],
  };
  return {
    lighthouseVersion: "13.5.0",
    requestedUrl: "https://example.test/a(b)/?q=a%20b",
    finalUrl: "https://example.test/final/",
    finalDisplayedUrl: "https://example.test/final/",
    mainDocumentUrl: "https://example.test/final/",
    fetchTime: "2026-01-01T00:00:00Z",
    runWarnings: ["A run warning"],
    environment: { networkUserAgent: "Sample Mobile Browser" },
    configSettings: {
      formFactor: "mobile",
      throttlingMethod: "simulate",
      throttling: { rttMs: 150, cpuSlowdownMultiplier: 4 },
      screenEmulation: { width: 412, height: 823 },
    },
    categories: Object.fromEntries(
      ["performance", "accessibility", "best-practices", "seo"].map((id) => [
        id,
        { title: id, score: 1, auditRefs: [{ id: "sample", weight: 0, group: "diagnostics" }] },
      ]),
    ),
    audits: {
      sample: audit,
      info: {
        id: "info",
        title: "Sample nested insight",
        score: null,
        scoreDisplayMode: "informative",
        details: {
          type: "list",
          items: [{ url: "https://example.test/asset", duration: 42, wastedBytes: 3072 }],
        },
      },
      "first-contentful-paint": {
        numericValue: 1234.567,
        numericUnit: "millisecond",
        displayValue: "1.2 s",
      },
      "network-requests": {
        id: "network-requests",
        title: "Network requests",
        score: null,
        scoreDisplayMode: "informative",
        details: {
          type: "table",
          items: [
            { url: "https://example.test/final/", resourceType: "Document", statusCode: 200 },
          ],
        },
      },
    },
  } as unknown as Result;
}

test("perfect category scores still show warnings, informative insights and exact research context", () => {
  const text = pageReport("example.test", "/sample/", [{ formFactor: "mobile", lhr: result() }]);
  expect(text).toContain("../../json/example.test/sample-mobile.json");
  expect(text).toContain("https://example.test/a%28b%29/?q=a%20b");
  expect(text).toContain("https://example.test/final/");
  expect(text).toContain("HTTP status: 200");
  expect(text).toContain("Lighthouse 13.5.0");
  expect(text).toContain("Sample Mobile Browser");
  expect(text).toContain("cpuSlowdownMultiplier");
  const psiLink = /exact requested URL\]\(([^)]+)\)/.exec(text)?.[1];
  expect(psiLink).toBeDefined();
  const psi = new URL(psiLink ?? "");
  expect(psi.searchParams.get("url")).toBe(result().requestedUrl ?? null);
  expect(psi.searchParams.get("form_factor")).toBe("mobile");

  expect(text).toContain("A useful warning even at 100");
  expect(text).toContain("Category weights: performance: 0 (diagnostics)");
  expect(text).toContain("A run warning");
  expect(text).toContain("Sample nested insight");
  expect(text).toContain("wastedBytes: 3072 bytes (3 KiB)");
  expect(text).toContain("1234.567");
  expect(text).not.toContain("non-perfect audits");
});

test("large nested details explicitly count omitted rows and truncate long snippets", () => {
  const lhr = result();
  const audit = lhr.audits.info;
  if (!audit) {
    throw new Error("Missing synthetic audit");
  }
  audit.details = {
    type: "table",
    headings: [],
    items: Array.from({ length: 20 }, (_, index) => ({
      url: `https://example.test/${index}`,
      snippet: "x".repeat(800),
    })),
  };
  const text = pageReport("example.test", "/sample/", [{ formFactor: "mobile", lhr }]);
  expect(text).toContain("8 detail rows omitted; see full JSON");
  expect(text).toContain("characters omitted");
  expect(text.length).toBeLessThan(20_000);
});

test("summary separates warning frequency from scored failures and links research data", () => {
  const text = summaryReport(
    "sample-run",
    true,
    [
      {
        domain: "example.test",
        origin: "https://example.test",
        results: [{ route: "/sample/", runs: [{ formFactor: "mobile", lhr: result() }] }],
      },
    ],
    ["mobile"],
  );
  expect(text).toContain("[Structured research context](research.json)");
  expect(text).toContain("No non-perfect scored audits");
  expect(text).toContain("Warning and error frequency");
  expect(text).toContain("Sample warning: 1 of 1 pages");
  expect(text).toContain("does not identify the deployed revision");
});

test("near-perfect scored audits and runtime errors retain their exact values", () => {
  const lhr = result();
  const audit = lhr.audits.sample;
  if (!audit) {
    throw new Error("Missing synthetic audit");
  }
  audit.score = 0.95;
  audit.warnings = Array.from({ length: 22 }, () => "Sample audit warning");
  lhr.runtimeError = { code: "NO_FCP", message: "Synthetic page did not paint" };
  const text = pageReport("example.test", "/sample/", [{ formFactor: "mobile", lhr }]);
  expect(text).toContain("non-perfect audits");
  expect(text).toContain("score 95");
  expect(text).toContain("2 audit warnings omitted");
  expect(text).toContain("Runtime error (NO\\_FCP): Synthetic page did not paint");
});
