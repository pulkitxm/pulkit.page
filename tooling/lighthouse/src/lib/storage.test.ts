import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Result } from "lighthouse";
import { jsonReport, reportPath, writeRawResult } from "./storage.ts";

const result = {
  lighthouseVersion: "13.5.0",
  requestedUrl: "https://example.test/sample/",
  configSettings: { formFactor: "mobile", throttlingMethod: "simulate" },
  environment: { benchmarkIndex: 1234 },
  audits: {
    "sample-insight": {
      details: {
        items: [{ node: { selector: "main > p", boundingRect: { top: 120, height: 48 } } }],
      },
    },
  },
  runWarnings: ["sample warning"],
  runtimeError: { code: "SAMPLE_FAILURE", message: "sample runtime failure" },
} as unknown as Result;

function withDirectory(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "lighthouse-storage-"));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("raw Lighthouse JSON preserves nested research data and runtime failures", () => {
  withDirectory((directory) => {
    writeRawResult(directory, "example.test", "/sample/", "mobile", result);
    const path = reportPath(directory, "example.test", "/sample/", "mobile", "json");
    const source = readFileSync(path, "utf8");
    expect(JSON.parse(source)).toEqual(result);
    expect(source.endsWith("\n")).toBe(true);
  });
});

test("completed device results stay available when a later audit fails", () => {
  withDirectory((directory) => {
    writeRawResult(directory, "example.test", "/sample/", "mobile", result);
    const mobile = reportPath(directory, "example.test", "/sample/", "mobile", "json");
    expect(() => {
      throw new Error("later worker crashed");
    }).toThrow("later worker crashed");
    expect(JSON.parse(readFileSync(mobile, "utf8"))).toEqual(result);
    expect(existsSync(reportPath(directory, "example.test", "/sample/", "desktop", "json"))).toBe(
      false,
    );
    expect(existsSync(join(directory, "run.json"))).toBe(false);
  });
});

test("HTML and raw JSON paths use the same route and device naming", () => {
  expect(reportPath("reports/run", "example.test", "/", "mobile", "json")).toBe(
    "reports/run/json/example.test/home-mobile.json",
  );
  expect(reportPath("reports/run", "example.test", "/nested/sample/", "desktop", "html")).toBe(
    "reports/run/html/example.test/nested-sample-desktop.html",
  );
  expect(reportPath("reports/run", "example.test", "/nested/sample/", "desktop", "json")).toBe(
    "reports/run/json/example.test/nested-sample-desktop.json",
  );
});

test("JSON escapes em dashes without altering decoded diagnostic data", () => {
  const diagnostic = { warning: `sample${String.fromCodePoint(0x2014)}warning` };
  const source = jsonReport(diagnostic);
  expect(source).not.toContain(String.fromCodePoint(0x2014));
  expect(source).toContain("\\u2014");
  expect(JSON.parse(source)).toEqual(diagnostic);
});
