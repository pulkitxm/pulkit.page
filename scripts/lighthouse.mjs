import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { preview } from "vite";

const categories = ["performance", "accessibility", "best-practices", "seo"];
const metrics = [
  ["first-contentful-paint", "FCP"],
  ["largest-contentful-paint", "LCP"],
  ["total-blocking-time", "TBT"],
  ["cumulative-layout-shift", "CLS"],
  ["speed-index", "SI"],
];
const hiddenModes = new Set(["notApplicable", "manual", "informative", "error"]);
const outputDirectory = "reports/lighthouse";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "form-factor": { type: "string", default: "both" },
    origin: { type: "string" },
    concurrency: { type: "string", default: "1" },
  },
});
const formFactors =
  values["form-factor"] === "both" ? ["mobile", "desktop"] : [values["form-factor"]];
if (!formFactors.every((formFactor) => formFactor === "mobile" || formFactor === "desktop")) {
  throw new Error("--form-factor must be mobile, desktop, or both");
}
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error("--concurrency must be a positive integer");
}
if (!existsSync("dist/index.html")) {
  throw new Error("No built site found. Run `bun run build` first.");
}

function routes(directory, prefix = "/") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === "assets" || /^dev-[0-9]+$/.test(entry.name)
        ? []
        : routes(join(directory, entry.name), `${prefix}${entry.name}/`);
    }
    return entry.name === "index.html" ? [prefix] : [];
  });
}

function slug(route) {
  return route === "/" ? "home" : route.slice(1, -1).replaceAll("/", "-");
}

function score(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const rounded = Math.round(value * 100);
  return rounded < 90 ? `**${rounded}**` : String(rounded);
}

function cell(text) {
  return String(text ?? "")
    .replaceAll("|", "\\|")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function itemLabel(item) {
  const value =
    item.url ??
    item.source?.url ??
    item.node?.snippet ??
    item.node?.selector ??
    item.label ??
    item.description;
  return typeof value === "string" ? value : undefined;
}

function failingAudits(lhr, category) {
  return lhr.categories[category].auditRefs
    .filter((reference) => reference.group !== "metrics")
    .map((reference) => lhr.audits[reference.id])
    .filter(
      (audit) =>
        audit.score !== null && audit.score < 0.9 && !hiddenModes.has(audit.scoreDisplayMode),
    )
    .sort((left, right) => left.score - right.score);
}

async function audit(url, formFactor, port) {
  const result = await lighthouse(
    url,
    {
      port,
      output: "html",
      logLevel: process.env.LIGHTHOUSE_LOG ?? "error",
      onlyCategories: categories,
    },
    formFactor === "desktop" ? desktopConfig : undefined,
  );
  if (!result) {
    throw new Error(`Lighthouse returned no result for ${url}`);
  }
  return result;
}

function pageReport(route, runs) {
  const lines = [`# Lighthouse: \`${route}\``, "", "[Back to summary](../README.md)", ""];
  for (const { formFactor, lhr } of runs) {
    lines.push(
      `## ${formFactor}`,
      "",
      `[Full HTML report](../html/${slug(route)}-${formFactor}.html)`,
      "",
    );
    if (lhr.runtimeError) {
      lines.push(`Runtime error: ${lhr.runtimeError.message}`, "");
    }
    lines.push(
      `| ${categories.map((category) => lhr.categories[category].title).join(" | ")} |`,
      `| ${categories.map(() => "---").join(" | ")} |`,
      `| ${categories.map((category) => score(lhr.categories[category].score)).join(" | ")} |`,
      "",
      `| ${metrics.map(([, label]) => label).join(" | ")} |`,
      `| ${metrics.map(() => "---").join(" | ")} |`,
      `| ${metrics.map(([id]) => cell(lhr.audits[id]?.displayValue)).join(" | ")} |`,
      "",
    );
    for (const category of categories) {
      const audits = failingAudits(lhr, category);
      if (audits.length === 0) {
        continue;
      }
      lines.push(`### ${lhr.categories[category].title}`, "");
      for (const failing of audits) {
        const detail = failing.displayValue ? `: ${cell(failing.displayValue)}` : "";
        lines.push(
          `- **${cell(failing.title)}** (score ${Math.round(failing.score * 100)})${detail}`,
        );
        const items = (failing.details?.items ?? []).map(itemLabel).filter(Boolean);
        for (const item of items.slice(0, 5)) {
          lines.push(`  - \`${cell(item).slice(0, 160).replaceAll("`", "'")}\``);
        }
        if (items.length > 5) {
          lines.push(`  - and ${items.length - 5} more`);
        }
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function summaryReport(results, origin) {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const lines = [
    "# Lighthouse summary",
    "",
    `Generated ${new Date().toISOString()} against ${origin} at commit \`${commit}\`. Scores below 90 are bold.`,
    "",
  ];
  for (const formFactor of formFactors) {
    lines.push(
      `## ${formFactor}`,
      "",
      `| Page | Perf | A11y | Best practices | SEO | ${metrics.map(([, label]) => label).join(" | ")} |`,
      `| --- | ${[...categories, ...metrics].map(() => "---").join(" | ")} |`,
    );
    const counts = new Map();
    for (const { route, runs } of results) {
      const { lhr } = runs.find((run) => run.formFactor === formFactor);
      const scores = categories.map((category) => score(lhr.categories[category].score));
      const values = metrics.map(([id]) => cell(lhr.audits[id]?.displayValue));
      lines.push(
        `| [\`${route}\`](pages/${slug(route)}.md) | ${[...scores, ...values].join(" | ")} |`,
      );
      for (const category of categories) {
        for (const failing of failingAudits(lhr, category)) {
          const entry = counts.get(failing.id) ?? { title: failing.title, pages: 0 };
          entry.pages += 1;
          counts.set(failing.id, entry);
        }
      }
    }
    lines.push("", `### Most common ${formFactor} issues`, "");
    const common = [...counts.values()].sort((left, right) => right.pages - left.pages);
    if (common.length === 0) {
      lines.push("No failing audits.");
    }
    for (const { title, pages } of common) {
      lines.push(`- ${cell(title)}: ${pages} of ${results.length} pages`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

const selected = routes("dist")
  .filter((route) => positionals.length === 0 || positionals.includes(route))
  .sort();
if (selected.length === 0) {
  throw new Error(`No built routes match ${positionals.join(", ")}`);
}

const server = values.origin
  ? undefined
  : await preview({
      configFile: false,
      appType: "mpa",
      logLevel: "silent",
      preview: { host: "127.0.0.1", port: 0 },
    });
const origin = values.origin ?? server.resolvedUrls.local[0];
const browsers = await Promise.all(
  Array.from({ length: Math.min(concurrency, selected.length) }, () =>
    launch({ chromeFlags: ["--headless=new", "--no-sandbox"] }),
  ),
);

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(join(outputDirectory, "pages"), { recursive: true });
mkdirSync(join(outputDirectory, "html"), { recursive: true });

const results = [];
const queue = [...selected];
const startedAt = performance.now();
try {
  await Promise.all(
    browsers.map(async (browser) => {
      for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
        const runs = [];
        for (const formFactor of formFactors) {
          const { lhr, report } = await audit(
            new URL(route, origin).href,
            formFactor,
            browser.port,
          );
          writeFileSync(join(outputDirectory, "html", `${slug(route)}-${formFactor}.html`), report);
          runs.push({ formFactor, lhr });
          console.log(
            `${route} ${formFactor}: ${categories.map((category) => score(lhr.categories[category].score).replaceAll("*", "")).join(" / ")}`,
          );
        }
        writeFileSync(join(outputDirectory, "pages", `${slug(route)}.md`), pageReport(route, runs));
        results.push({ route, runs });
      }
    }),
  );
} finally {
  await Promise.all(browsers.map((browser) => browser.kill()));
  await server?.close();
}

results.sort((left, right) => left.route.localeCompare(right.route));
writeFileSync(join(outputDirectory, "README.md"), summaryReport(results, origin));
console.log(
  `Audited ${results.length} pages in ${Math.round((performance.now() - startedAt) / 1000)}s. Summary: ${join(outputDirectory, "README.md")}`,
);
