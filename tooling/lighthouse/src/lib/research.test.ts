import { expect, test } from "bun:test";
import type { Result } from "lighthouse";
import type { AuditResult } from "./audit.ts";
import type { SiteSection } from "./reports.ts";
import { type ResearchContext, researchReport } from "./research.ts";

const context: ResearchContext = {
  runId: "synthetic-run",
  production: true,
  minimumScore: 100,
  concurrency: 5,
  effectiveConcurrency: 2,
  runnerRevision: "synthetic-runner-revision",
};

function audit(id: string, changes: Partial<AuditResult> = {}): AuditResult {
  return {
    id,
    title: id,
    description: "Synthetic audit",
    score: 1,
    scoreDisplayMode: "binary",
    ...changes,
  };
}

function sections(audits: AuditResult[], score = 1): SiteSection[] {
  return [
    {
      domain: "example.test",
      origin: "https://example.test",
      results: [
        {
          route: "/example/",
          runs: [
            {
              formFactor: "mobile",
              lhr: {
                requestedUrl: "https://example.test/example/?source=fixture",
                finalUrl: "https://example.test/final/",
                finalDisplayedUrl: "https://example.test/final/",
                mainDocumentUrl: "https://example.test/main-document/",
                lighthouseVersion: "synthetic-version",
                fetchTime: "2026-01-01T00:00:00.000Z",
                userAgent: "Synthetic browser",
                environment: { benchmarkIndex: 123 },
                configSettings: { formFactor: "mobile", throttlingMethod: "simulate" },
                categories: {
                  performance: {
                    title: "Performance",
                    score,
                    auditRefs: audits.map(({ id }) => ({
                      id,
                      weight: id === "largest-contentful-paint" ? 0.25 : 0,
                      group: id === "largest-contentful-paint" ? "metrics" : "diagnostics",
                    })),
                  },
                },
                categoryGroups: { diagnostics: { title: "Diagnostics" } },
                audits: Object.fromEntries(audits.map((result) => [result.id, result])),
                runWarnings: ["Synthetic navigation warning"],
              } as unknown as Result,
            },
          ],
        },
      ],
    },
  ];
}

test("research preserves exact URLs, settings, scores, metrics and raw report paths", () => {
  const report = researchReport(
    sections(
      [
        audit("largest-contentful-paint", {
          score: 0.95123,
          scoreDisplayMode: "numeric",
          numericValue: 1234.56789,
          numericUnit: "millisecond",
        }),
      ],
      0.99567,
    ),
    context,
  );
  const page = report.pages[0];
  expect(report.schemaVersion).toBe(1);
  expect(report.provenance.runnerRevisionScope).toBe("runner-checkout");
  expect(report.settings).toEqual({
    minimumScore: 100,
    requestedConcurrency: 5,
    effectiveConcurrency: 2,
  });
  expect(page?.requestedUrl).toBe("https://example.test/example/?source=fixture");
  expect(page?.finalUrl).toBe("https://example.test/final/");
  expect(page?.mainDocumentUrl).toBe("https://example.test/main-document/");
  expect(page?.jsonReport).toBe("json/example.test/example-mobile.json");
  expect(page?.categories.performance?.score).toBe(0.99567);
  expect(page?.metrics["largest-contentful-paint"]?.numericValue).toBe(1234.56789);
  expect(page?.findings[0]?.score).toBe(0.95123);
  expect(page?.findings[0]?.categoryMemberships).toEqual([
    { category: "performance", id: "largest-contentful-paint", weight: 0.25, group: "metrics" },
  ]);
});

test("perfect categories retain unused script findings and all nested details", () => {
  const details = {
    type: "opportunity",
    items: Array.from({ length: 30 }, (_, index) => ({
      url: `https://example.test/assets/example-${index}.js`,
      wastedBytes: 1234 + index,
      subItems: {
        type: "subitems",
        items: [{ source: "x".repeat(400), timing: { duration: 123.456 } }],
      },
    })),
  };
  const source = sections([
    audit("unused-javascript", {
      score: 0.95,
      scoreDisplayMode: "metricSavings",
      metricSavings: { LCP: 250 },
      details: details as AuditResult["details"],
    }),
  ]);
  const snapshot = JSON.stringify(source);
  const report = JSON.parse(JSON.stringify(researchReport(source, context)));
  expect(report.pages[0].categories.performance.score).toBe(1);
  expect(report.pages[0].findings[0].details).toEqual(details);
  expect(report.pages[0].findings[0].metricSavings).toEqual({ LCP: 250 });
  expect(report.pages[0].findings[0].reasons).toEqual(["non-perfect-score"]);
  expect(report.pages[0].findings[0].categoryMemberships[0].weight).toBe(0);
  expect(JSON.stringify(source)).toBe(snapshot);
});

test("passed audits, manual checks and not-applicable audits are not failures", () => {
  const report = researchReport(
    sections([
      audit("passed"),
      audit("manual", { score: null, scoreDisplayMode: "manual" }),
      audit("not-applicable", { score: null, scoreDisplayMode: "notApplicable" }),
      audit("warning", { warnings: ["Synthetic audit warning"] }),
      audit("error", { score: null, scoreDisplayMode: "error", errorMessage: "Synthetic error" }),
      audit("informative-insight", {
        score: null,
        scoreDisplayMode: "informative",
        numericValue: 456,
      }),
      audit("lcp-breakdown-insight", {
        scoreDisplayMode: "informative",
        details: {
          type: "table",
          headings: [],
          items: [{ label: "Element render delay", duration: 123.456 }],
        },
      }),
      audit("empty-information", { score: null, scoreDisplayMode: "informative" }),
      audit("empty-details", {
        score: null,
        scoreDisplayMode: "informative",
        details: { type: "table", headings: [], items: [] },
      }),
    ]),
    context,
  );
  const page = report.pages[0];
  expect(page?.findings.map(({ id, reasons }) => ({ id, reasons }))).toEqual([
    { id: "warning", reasons: ["warning"] },
    { id: "error", reasons: ["error"] },
    { id: "informative-insight", reasons: ["informative"] },
    { id: "lcp-breakdown-insight", reasons: ["informative"] },
  ]);
  expect(page?.runWarnings).toEqual(["Synthetic navigation warning"]);
});

test("runtime failures remain available for research", () => {
  const input = sections([]);
  const run = input[0]?.results[0]?.runs[0];
  if (!run) {
    throw new Error("Missing synthetic run");
  }
  run.lhr.runtimeError = { code: "SYNTHETIC_ERROR", message: "Synthetic request failed" };
  const page = researchReport(input, context).pages[0];
  expect(page?.runtimeError).toEqual(run.lhr.runtimeError);
});

test("aggregate diagnostics omit screenshot data retained in the raw report", () => {
  const input = sections([
    audit("screenshot-thumbnails", {
      score: null,
      scoreDisplayMode: "informative",
      details: {
        type: "filmstrip",
        scale: 1,
        items: [{ timing: 0, timestamp: 0, data: "synthetic-image" }],
      },
    }),
    audit("final-screenshot", {
      score: null,
      scoreDisplayMode: "informative",
      details: { type: "screenshot", timing: 100, timestamp: 100, data: "synthetic-image" },
    }),
  ]);
  const report = researchReport(input, context);
  expect(report.pages[0]?.findings).toEqual([]);
  expect(input[0]?.results[0]?.runs[0]?.lhr.audits["final-screenshot"]?.details).toBeDefined();
  expect(JSON.stringify(report)).not.toContain("synthetic-image");
});
