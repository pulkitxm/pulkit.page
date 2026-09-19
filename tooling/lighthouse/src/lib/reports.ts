import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "lighthouse";
import type { FormFactor } from "./audit.ts";
import { categories, metrics } from "./audit.ts";
import { categoryOf, cell, detailLabels, failingAudits, score, slug } from "./format.ts";

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

function auditLines(lhr: Result): string[] {
  const lines: string[] = [];
  for (const category of categories) {
    const audits = failingAudits(lhr, category);
    if (audits.length === 0) {
      continue;
    }
    lines.push(`### ${categoryOf(lhr, category).title}`, "");
    for (const failing of audits) {
      const detail = failing.displayValue ? `: ${cell(failing.displayValue)}` : "";
      lines.push(
        `- **${cell(failing.title)}** (score ${Math.round((failing.score ?? 0) * 100)})${detail}`,
      );
      const items = detailLabels(failing.details);
      for (const item of items.slice(0, 5)) {
        lines.push(`  - \`${cell(item).slice(0, 160).replaceAll("`", "'")}\``);
      }
      if (items.length > 5) {
        lines.push(`  - and ${items.length - 5} more`);
      }
    }
    lines.push("");
  }
  return lines;
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
      `[Full HTML report](../../html/${domain}/${slug(route)}-${formFactor}.html)`,
      "",
    );
    if (lhr.runtimeError) {
      lines.push(`Runtime error: ${lhr.runtimeError.message}`, "");
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
      ...auditLines(lhr),
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function commonIssues(results: readonly PageResult[], formFactor: FormFactor): string[] {
  const counts = new Map<string, { title: string; pages: number }>();
  for (const { runs } of results) {
    const run = runs.find((candidate) => candidate.formFactor === formFactor);
    for (const category of run ? categories : []) {
      for (const failing of run ? failingAudits(run.lhr, category) : []) {
        const entry = counts.get(failing.id) ?? { title: failing.title, pages: 0 };
        entry.pages += 1;
        counts.set(failing.id, entry);
      }
    }
  }
  const common = [...counts.values()].sort((left, right) => right.pages - left.pages);
  return common.length === 0
    ? ["No failing audits."]
    : common.map(({ title, pages }) => `- ${cell(title)}: ${pages} of ${results.length} pages`);
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
      `Most common ${domain} ${formFactor} issues:`,
      "",
      ...commonIssues(results, formFactor),
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
    `Generated ${new Date().toISOString()} ${production ? "against production" : "against local builds"} at commit \`${commit}\`. Scores below 90 are bold.`,
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
