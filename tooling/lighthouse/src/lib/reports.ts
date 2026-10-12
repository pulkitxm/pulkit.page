import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "lighthouse";
import type { FormFactor } from "./audit.ts";
import { categories, metrics } from "./audit.ts";
import {
  categoryOf,
  cell,
  detailLabels,
  diagnosticAudits,
  documentStatus,
  failingAudits,
  linkUrl,
  score,
  slug,
} from "./format.ts";

export interface PageRun {
  formFactor: FormFactor;
  lhr: Result;
}

interface PageResult {
  route: string;
  runs: PageRun[];
}

export interface SiteSection {
  domain: string;
  origin: string;
  results: PageResult[];
}

interface RunRecord {
  id: string;
  sites: string;
  pages: number;
  formFactors: FormFactor[];
  failed: number;
}

function scoreRow(lhr: Result): string[] {
  return categories.map((category) => score(categoryOf(lhr, category).score));
}

function metricRow(lhr: Result): string[] {
  return metrics.map(([id]) => cell(lhr.audits[id]?.displayValue));
}

function boundedCell(value: unknown): string {
  const text = String(value ?? "");
  return cell(
    text.length > 600 ? `${text.slice(0, 600)} [${text.length - 600} characters omitted]` : text,
  );
}

function auditLines(lhr: Result): string[] {
  const lines: string[] = [];
  const shown = new Set<string>();
  const render = (audit: Result["audits"][string]): void => {
    const numeric =
      audit.numericValue === undefined
        ? ""
        : `; numeric ${audit.numericValue} ${cell(audit.numericUnit ?? "")}`;
    const detail = audit.displayValue ? `: ${cell(audit.displayValue)}` : "";
    const auditScore = audit.score === null ? audit.scoreDisplayMode : `score ${audit.score * 100}`;
    lines.push(
      `- **${cell(audit.title)}** (${cell(audit.id)}; ${cell(auditScore)}${numeric})${detail}`,
    );
    const memberships = Object.entries(lhr.categories).flatMap(([id, category]) =>
      category.auditRefs
        .filter((reference) => reference.id === audit.id)
        .map(
          (reference) =>
            `${cell(id)}: ${reference.weight ?? "not recorded"}${reference.group ? ` (${cell(reference.group)})` : ""}`,
        ),
    );
    if (memberships.length > 0) {
      lines.push(`  - Category weights: ${memberships.join("; ")}`);
    }
    if (audit.description) {
      lines.push(`  - ${boundedCell(audit.description)}`);
    }
    if (audit.explanation) {
      lines.push(`  - Explanation: ${boundedCell(audit.explanation)}`);
    }
    if (audit.errorMessage) {
      lines.push(`  - Error: ${boundedCell(audit.errorMessage)}`);
    }
    for (const warning of (audit.warnings ?? []).slice(0, 20)) {
      lines.push(`  - Warning: ${boundedCell(warning)}`);
    }
    if ((audit.warnings?.length ?? 0) > 20) {
      lines.push(
        `  - ${(audit.warnings?.length ?? 0) - 20} audit warnings omitted; see full JSON.`,
      );
    }
    const savings = audit.metricSavings;
    if (savings) {
      lines.push(
        `  - Metric savings: ${Object.entries(savings)
          .map(([metric, value]) => `${cell(metric)}: ${value}${metric === "CLS" ? "" : " ms"}`)
          .join("; ")}`,
      );
    }
    const items = detailLabels(audit.details);
    for (const item of items.slice(0, 12)) {
      lines.push(`  - ${boundedCell(item)}`);
    }
    if (items.length > 12) {
      lines.push(`  - ${items.length - 12} detail rows omitted; see full JSON.`);
    }
  };
  for (const category of categories) {
    const audits = failingAudits(lhr, category).filter((audit) => !shown.has(audit.id));
    if (audits.length === 0) {
      continue;
    }
    lines.push(`### ${categoryOf(lhr, category).title}: non-perfect audits`, "");
    for (const audit of audits.slice(0, 30)) {
      render(audit);
      shown.add(audit.id);
    }
    if (audits.length > 30) {
      lines.push(`- ${audits.length - 30} audits omitted; see full JSON.`);
    }
    lines.push("");
  }
  const diagnostics = diagnosticAudits(lhr).filter((audit) => !shown.has(audit.id));
  if (diagnostics.length > 0) {
    lines.push(
      "### Diagnostics, warnings and errors",
      "",
      "Informative diagnostics do not necessarily lower category scores.",
      "",
    );
    for (const audit of diagnostics.slice(0, 30)) {
      render(audit);
    }
    if (diagnostics.length > 30) {
      lines.push(`- ${diagnostics.length - 30} diagnostics omitted; see full JSON.`);
    }
    lines.push("");
  }
  return lines;
}

function contextLines(lhr: Result, formFactor: FormFactor): string[] {
  const settings = lhr.configSettings;
  const requested = lhr.requestedUrl ?? "";
  const finalUrl = lhr.finalDisplayedUrl || lhr.finalUrl || "";
  const psi = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(requested)}&form_factor=${formFactor}`;
  return [
    `Requested URL: [${cell(requested)}](${linkUrl(requested)})`,
    "",
    `Final URL: [${cell(finalUrl)}](${linkUrl(finalUrl)}). Main document: ${cell(lhr.mainDocumentUrl)}. HTTP status: ${documentStatus(lhr) ?? "not recorded"}.`,
    "",
    `Lighthouse ${cell(lhr.lighthouseVersion)}; fetched ${cell(lhr.fetchTime)}; device ${cell(settings.formFactor)}; throttling ${cell(settings.throttlingMethod)}.`,
    "",
    `Screen emulation: ${cell(JSON.stringify(settings.screenEmulation))}`,
    "",
    `Throttling settings: ${cell(JSON.stringify(settings.throttling))}`,
    "",
    `Network user agent: ${cell(lhr.environment.networkUserAgent)}`,
    "",
    `[PageSpeed Insights for the exact requested URL](${linkUrl(psi)}). This opens a separate test, not this saved result.`,
    "",
  ];
}

export function pageReport(domain: string, route: string, pageRuns: readonly PageRun[]): string {
  const lines = [
    `# Lighthouse: \`${domain}${route}\``,
    "",
    "[Back to summary](../../README.md)",
    "",
  ];
  for (const { formFactor, lhr } of pageRuns) {
    lines.push(
      `## ${formFactor}`,
      "",
      `[Full HTML report](../../html/${domain}/${slug(route)}-${formFactor}.html) · [Lossless Lighthouse JSON](../../json/${domain}/${slug(route)}-${formFactor}.json)`,
      "",
    );
    lines.push(...contextLines(lhr, formFactor));
    for (const warning of (lhr.runWarnings ?? []).slice(0, 20)) {
      lines.push(`Run warning: ${boundedCell(warning)}`, "");
    }
    if ((lhr.runWarnings?.length ?? 0) > 20) {
      lines.push(`${(lhr.runWarnings?.length ?? 0) - 20} run warnings omitted; see full JSON.`, "");
    }
    if (lhr.runtimeError) {
      lines.push(
        `Runtime error (${cell(lhr.runtimeError.code)}): ${boundedCell(lhr.runtimeError.message)}`,
        "",
      );
    }
    lines.push(
      `| ${categories.map((category) => categoryOf(lhr, category).title).join(" | ")} |`,
      `| ${categories.map(() => "---").join(" | ")} |`,
      `| ${scoreRow(lhr).join(" | ")} |`,
      "",
      `| ${metrics.map(([, label]) => label).join(" | ")} |`,
      `| ${metrics.map(() => "---").join(" | ")} |`,
      `| ${metricRow(lhr).join(" | ")} |`,
      "",
      "Raw numeric metrics:",
      "",
      "| Metric | Value | Unit |",
      "| --- | --- | --- |",
      ...metrics.map(
        ([id, label]) =>
          `| ${label} | ${lhr.audits[id]?.numericValue ?? "not recorded"} | ${cell(lhr.audits[id]?.numericUnit)} |`,
      ),
      "",
      ...auditLines(lhr),
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function commonIssues(results: readonly PageResult[], formFactor: FormFactor): string[] {
  const counts = new Map<string, { title: string; pages: number }>();
  for (const { runs } of results) {
    const run = runs.find((candidate) => candidate.formFactor === formFactor);
    const counted = new Set<string>();
    for (const category of run ? categories : []) {
      for (const failing of run ? failingAudits(run.lhr, category) : []) {
        if (counted.has(failing.id)) {
          continue;
        }
        counted.add(failing.id);
        const entry = counts.get(failing.id) ?? { title: failing.title, pages: 0 };
        entry.pages += 1;
        counts.set(failing.id, entry);
      }
    }
  }
  const common = [...counts.values()].sort((left, right) => right.pages - left.pages);
  return common.length === 0
    ? ["No non-perfect scored audits."]
    : common.map(({ title, pages }) => `- ${cell(title)}: ${pages} of ${results.length} pages`);
}

function warningFrequency(results: readonly PageResult[], formFactor: FormFactor): string[] {
  const counts = new Map<string, number>();
  for (const { runs } of results) {
    const lhr = runs.find((candidate) => candidate.formFactor === formFactor)?.lhr;
    if (!lhr) {
      continue;
    }
    const warnings = new Set(lhr.runWarnings ?? []);
    if (lhr.runtimeError) {
      warnings.add(`Runtime error: ${lhr.runtimeError.code}`);
    }
    for (const audit of diagnosticAudits(lhr)) {
      if (audit.warnings?.length || audit.errorMessage || audit.scoreDisplayMode === "error") {
        warnings.add(`${audit.id}: ${audit.title}`);
      }
    }
    for (const warning of warnings) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1);
    }
  }
  const entries = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) {
    return ["No recorded warnings or errors."];
  }
  const lines = entries
    .slice(0, 20)
    .map(([warning, count]) => `- ${cell(warning)}: ${count} of ${results.length} pages`);
  if (entries.length > 20) {
    lines.push(`- ${entries.length - 20} warning groups omitted; see research.json.`);
  }
  return lines;
}

function siteSummary(section: SiteSection, formFactors: readonly FormFactor[]): string[] {
  const { domain, origin, results } = section;
  const lines = [`## ${domain}`, "", `Audited ${results.length} pages at ${origin}.`, ""];
  for (const formFactor of formFactors) {
    lines.push(
      `### ${domain} ${formFactor}`,
      "",
      `| Page | Perf | A11y | Best practices | SEO | ${metrics.map(([, label]) => label).join(" | ")} |`,
      `| --- | ${[...categories, ...metrics].map(() => "---").join(" | ")} |`,
    );
    for (const { route, runs } of results) {
      const run = runs.find((candidate) => candidate.formFactor === formFactor);
      const cells = run ? [...scoreRow(run.lhr), ...metricRow(run.lhr)] : [];
      lines.push(`| [\`${route}\`](pages/${domain}/${slug(route)}.md) | ${cells.join(" | ")} |`);
    }
    lines.push(
      "",
      `Most common ${domain} ${formFactor} non-perfect audits:`,
      "",
      ...commonIssues(results, formFactor),
      "",
      `Warning and error frequency for ${domain} ${formFactor}:`,
      "",
      ...warningFrequency(results, formFactor),
      "",
    );
  }
  return lines;
}

export function summaryReport(
  runId: string,
  production: boolean,
  sections: readonly SiteSection[],
  formFactors: readonly FormFactor[],
): string {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const lines = [
    `# Lighthouse report ${runId}`,
    "",
    `Generated ${new Date().toISOString()} ${production ? "against production" : "against local builds"} with runner checkout commit \`${commit}\`. The runner checkout does not identify the deployed revision. Scores below 90 are bold.`,
    "",
    "[Structured research context](research.json)",
    "",
    ...sections.flatMap((section) => siteSummary(section, formFactors)),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

function readRunRecord(path: string): RunRecord {
  const record: RunRecord = JSON.parse(readFileSync(path, "utf8"));
  return record;
}

export function runIndex(reportsDirectory: string): string {
  const entries = readdirSync(reportsDirectory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(reportsDirectory, entry.name, "run.json")),
    )
    .map((entry) => readRunRecord(join(reportsDirectory, entry.name, "run.json")))
    .toSorted((left, right) => right.id.localeCompare(left.id));
  const lines = [
    "# Lighthouse reports",
    "",
    "Newest first. Each run keeps its own folder.",
    "",
    "| Run | Sites | Pages | Form factors | Failed audits |",
    "| --- | --- | --- | --- | --- |",
    ...entries.map(
      (entry) =>
        `| [${entry.id}](${entry.id}/README.md) | ${entry.sites} | ${entry.pages} | ${entry.formFactors.join(", ")} | ${entry.failed} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}
