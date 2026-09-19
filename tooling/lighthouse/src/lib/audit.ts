import type { Result } from "lighthouse";

export type FormFactor = "mobile" | "desktop";
export type AuditResult = Result["audits"][string];

export interface AuditJob {
  url: string;
  formFactor: FormFactor;
  categories: string[];
  reportPath: string;
}

export type WorkerReply = { ready: true } | { lhr: Result } | { error: string };

export const categories = ["performance", "accessibility", "best-practices", "seo"];

export const metrics: readonly (readonly [string, string])[] = [
  ["first-contentful-paint", "FCP"],
  ["largest-contentful-paint", "LCP"],
  ["total-blocking-time", "TBT"],
  ["cumulative-layout-shift", "CLS"],
  ["speed-index", "SI"],
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFormFactor(value: unknown): value is FormFactor {
  return value === "mobile" || value === "desktop";
}

export function isAuditJob(value: unknown): value is AuditJob {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    isFormFactor(value.formFactor) &&
    Array.isArray(value.categories) &&
    value.categories.every((category) => typeof category === "string") &&
    typeof value.reportPath === "string"
  );
}

export function isWorkerReply(value: unknown): value is WorkerReply {
  return (
    isRecord(value) &&
    (value.ready === true || typeof value.error === "string" || isRecord(value.lhr))
  );
}
