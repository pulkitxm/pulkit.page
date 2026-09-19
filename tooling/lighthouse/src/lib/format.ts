import type { Result } from "lighthouse";
import type { AuditResult } from "./audit.ts";
import { isRecord } from "./audit.ts";

const hiddenModes = new Set(["notApplicable", "manual", "informative", "error"]);

export function slug(route: string): string {
  return route === "/" ? "home" : route.slice(1, -1).replaceAll("/", "-");
}

export function score(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const rounded = Math.round(value * 100);
  return rounded < 90 ? `**${rounded}**` : String(rounded);
}

export function cell(text: unknown): string {
  return String(text ?? "")
    .replaceAll("|", "\\|")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function itemLabel(item: unknown): string | undefined {
  const value =
    field(item, "url") ??
    field(field(item, "source"), "url") ??
    field(field(item, "node"), "snippet") ??
    field(field(item, "node"), "selector") ??
    field(item, "label") ??
    field(item, "description");
  return typeof value === "string" ? value : undefined;
}

export function detailLabels(details: unknown): string[] {
  const items = field(details, "items");
  if (Array.isArray(items)) {
    const list: unknown[] = items;
    return list.map(itemLabel).filter((label): label is string => Boolean(label));
  }
  if (field(details, "type") === "checklist" && isRecord(items)) {
    return Object.values(items)
      .filter((check) => field(check, "value") === false)
      .map((check) => String(field(check, "label") ?? ""));
  }
  return [];
}

export function categoryOf(lhr: Result, category: string): Result.Category {
  const found = lhr.categories[category];
  if (!found) {
    throw new Error(`Lighthouse result is missing the ${category} category`);
  }
  return found;
}

export function failingAudits(lhr: Result, category: string): AuditResult[] {
  return categoryOf(lhr, category)
    .auditRefs.filter((reference) => reference.group !== "metrics")
    .flatMap((reference) => {
      const audit = lhr.audits[reference.id];
      return audit ? [audit] : [];
    })
    .filter(
      (audit) =>
        audit.score !== null && audit.score < 0.9 && !hiddenModes.has(audit.scoreDisplayMode),
    )
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0));
}
