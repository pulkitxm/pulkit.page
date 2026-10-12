import type { Result } from "lighthouse";
import type { AuditResult } from "./audit.ts";
import { isRecord, metrics } from "./audit.ts";
import { slug } from "./format.ts";
import type { SiteSection } from "./reports.ts";

export interface ResearchContext {
  runId: string;
  production: boolean;
  minimumScore: number;
  concurrency: number;
  effectiveConcurrency: number;
  runnerRevision: string | null;
  provenance?: Record<string, unknown>;
}

type FindingReason = "non-perfect-score" | "warning" | "error" | "informative";

const unscoredModes = new Set(["manual", "notApplicable", "informative", "error"]);
const screenshotAudits = new Set(["screenshot-thumbnails", "final-screenshot"]);

function hasDetails(details: unknown): boolean {
  if (!isRecord(details)) {
    return false;
  }
  if (Array.isArray(details.items)) {
    return details.items.length > 0;
  }
  if (isRecord(details.items)) {
    return Object.keys(details.items).length > 0;
  }
  return Object.keys(details).some((key) => key !== "type" && key !== "headings");
}

function findingReasons(audit: AuditResult): FindingReason[] {
  const reasons: FindingReason[] = [];
  if (audit.score !== null && audit.score < 1 && !unscoredModes.has(audit.scoreDisplayMode)) {
    reasons.push("non-perfect-score");
  }
  if (audit.warnings?.length) {
    reasons.push("warning");
  }
  if (audit.scoreDisplayMode === "error" || audit.errorMessage) {
    reasons.push("error");
  }
  if (
    audit.scoreDisplayMode === "informative" &&
    (hasDetails(audit.details) ||
      audit.displayValue ||
      audit.numericValue !== undefined ||
      Object.keys(audit.metricSavings ?? {}).length > 0)
  ) {
    reasons.push("informative");
  }
  return reasons;
}

function findings(lhr: Result) {
  return Object.values(lhr.audits).flatMap((audit) => {
    if (screenshotAudits.has(audit.id)) {
      return [];
    }
    const reasons = findingReasons(audit);
    if (reasons.length === 0) {
      return [];
    }
    const categoryMemberships = Object.entries(lhr.categories).flatMap(([category, result]) =>
      result.auditRefs
        .filter((reference) => reference.id === audit.id)
        .map((reference) => ({ category, ...reference })),
    );
    return [{ ...audit, reasons, categoryMemberships }];
  });
}

export function researchReport(sections: readonly SiteSection[], context: ResearchContext) {
  return {
    schemaVersion: 1,
    runId: context.runId,
    provenance: {
      ...context.provenance,
      production: context.production,
      runnerRevision: context.runnerRevision,
      runnerRevisionScope: "runner-checkout",
    },
    settings: {
      minimumScore: context.minimumScore,
      requestedConcurrency: context.concurrency,
      effectiveConcurrency: context.effectiveConcurrency,
    },
    pages: sections.flatMap((section) =>
      section.results.flatMap(({ route, runs }) =>
        runs.map(({ formFactor, lhr }) => ({
          domain: section.domain,
          route,
          formFactor,
          auditedUrl: new URL(route, section.origin).href,
          requestedUrl: lhr.requestedUrl,
          finalUrl: lhr.finalUrl,
          finalDisplayedUrl: lhr.finalDisplayedUrl,
          mainDocumentUrl: lhr.mainDocumentUrl,
          jsonReport: `json/${section.domain}/${slug(route)}-${formFactor}.json`,
          lighthouseVersion: lhr.lighthouseVersion,
          fetchTime: lhr.fetchTime,
          userAgent: lhr.userAgent,
          environment: lhr.environment,
          configSettings: lhr.configSettings,
          categories: lhr.categories,
          categoryGroups: lhr.categoryGroups,
          metrics: Object.fromEntries(
            metrics.flatMap(([id, name]) => {
              const audit = lhr.audits[id];
              return audit
                ? [
                    [
                      id,
                      {
                        name,
                        score: audit.score,
                        numericValue: audit.numericValue,
                        numericUnit: audit.numericUnit,
                        displayValue: audit.displayValue,
                      },
                    ],
                  ]
                : [];
            }),
          ),
          runtimeError: lhr.runtimeError ?? null,
          runWarnings: lhr.runWarnings ?? [],
          findings: findings(lhr),
        })),
      ),
    ),
  };
}
