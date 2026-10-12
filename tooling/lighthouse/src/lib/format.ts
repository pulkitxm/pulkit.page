import type { Result } from "lighthouse";
import type { AuditResult } from "./audit.ts";
import { isRecord } from "./audit.ts";

const binaryAudits = new Set(["screenshot-thumbnails", "final-screenshot"]);

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
    .replaceAll("\\", "\\\\")
    .replaceAll(/([|`*_[\]<>])/g, "\\$1")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function linkUrl(url: string): string {
  return url.replaceAll(/[\s()<>\\]/g, (character) => {
    const escaped = encodeURIComponent(character);
    return escaped === character
      ? `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      : escaped;
  });
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function detailValue(key: string, value: unknown, unit?: string): string {
  if (typeof value !== "number") {
    return String(value);
  }
  const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (unit === "bytes" || /Bytes$/.test(key)) {
    return `${formatted} bytes (${Number((value / 1024).toFixed(2))} KiB)`;
  }
  if (unit === "ms" || unit === "timespanMs" || /Ms$/.test(key)) {
    return `${formatted} ms`;
  }
  return formatted;
}

export function detailLabels(details: unknown): string[] {
  const lines: string[] = [];
  const ignored = new Set(["type", "lhId", "path", "headings", "data", "screenshot", "image"]);
  const visit = (value: unknown, prefix: string, units: ReadonlyMap<string, string>): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${prefix}[${index + 1}]`, units);
      });
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    const localUnits = new Map(units);
    const headings = value.headings;
    if (Array.isArray(headings)) {
      for (const heading of headings) {
        if (
          isRecord(heading) &&
          typeof heading.key === "string" &&
          typeof heading.valueType === "string"
        ) {
          localUnits.set(heading.key, heading.valueType);
        }
      }
    }
    const fields = Object.entries(value).filter(([key]) => !ignored.has(key));
    const values = fields.flatMap(([key, item]) => {
      if (item === null || typeof item === "object" || String(item).startsWith("data:")) {
        return [];
      }
      return [`${key}: ${detailValue(key, item, localUnits.get(key))}`];
    });
    if (values.length > 0) {
      lines.push(`${prefix ? `${prefix}: ` : ""}${values.join("; ")}`);
    }
    for (const [key, item] of fields) {
      if (typeof item === "object" && item !== null) {
        visit(item, prefix ? `${prefix}.${key}` : key, localUnits);
      }
    }
  };
  visit(details, "", new Map());
  return lines;
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
        audit.score !== null && audit.score < 1 && !hiddenModes.has(audit.scoreDisplayMode),
    )
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0));
}

export function diagnosticAudits(lhr: Result): AuditResult[] {
  return Object.values(lhr.audits).filter(
    (audit) =>
      audit.scoreDisplayMode === "error" ||
      Boolean(audit.errorMessage) ||
      Boolean(audit.warnings?.length) ||
      (audit.scoreDisplayMode === "informative" &&
        !binaryAudits.has(audit.id) &&
        Boolean(
          detailLabels(audit.details).length > 0 ||
            audit.displayValue ||
            audit.numericValue !== undefined,
        )),
  );
}

export function documentStatus(lhr: Result): number | undefined {
  const items = field(lhr.audits["network-requests"]?.details, "items");
  if (!Array.isArray(items)) {
    return undefined;
  }
  const item = items.find(
    (candidate) =>
      field(candidate, "resourceType") === "Document" &&
      field(candidate, "url") === (lhr.mainDocumentUrl || lhr.finalDisplayedUrl || lhr.finalUrl),
  );
  const status = field(item, "statusCode");
  return typeof status === "number" ? status : undefined;
}
