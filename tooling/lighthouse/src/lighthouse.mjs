import { execFileSync, fork } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { builtRoutes } from "@pulkit/shared/built-site";
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

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "form-factor": { type: "string", default: "both" },
    prod: { type: "boolean", default: false },
    site: { type: "string", multiple: true, default: [] },
    concurrency: {
      type: "string",
      default: String(Math.max(1, Math.floor(availableParallelism() / 2))),
    },
    output: { type: "string", default: "reports/lighthouse" },
  },
});
const formFactors =
  values["form-factor"] === "both" ? ["mobile", "desktop"] : [values["form-factor"]];
if (!formFactors.every((formFactor) => formFactor === "mobile" || formFactor === "desktop")) {
  throw new Error("--form-factor must be mobile, desktop, or both");
}
process.chdir(fileURLToPath(new URL("../../../", import.meta.url)));
const reportsDirectory = values.output;
const runId = `${new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replace(/\.\d+Z$/, "Z")}-${values.prod ? "prod" : "local"}`;
const outputDirectory = join(reportsDirectory, runId);
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error("--concurrency must be a positive integer");
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

function detailLabels(details) {
  const items = details?.items;
  if (Array.isArray(items)) {
    return items.map(itemLabel).filter(Boolean);
  }
  if (details?.type === "checklist" && items) {
    return Object.values(items)
      .filter((check) => check.value === false)
      .map((check) => check.label);
  }
  return [];
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

function startWorker() {
  const worker = fork(fileURLToPath(new URL("worker.mjs", import.meta.url)));
  let settle;
  worker.on("message", (message) => settle?.(message));
  worker.on("exit", (code) => settle?.({ error: `Lighthouse worker exited with code ${code}` }));
  const next = () =>
    new Promise((resolve) => {
      settle = resolve;
    });
  const ready = next();
  return {
    ready,
    run(job) {
      const reply = next();
      worker.send(job);
      return reply;
    },
    stop: () => worker.disconnect(),
  };
}

function pageReport(site, route, pageRuns) {
  const lines = [
    `# Lighthouse: \`${site.domain}${route}\``,
    "",
    "[Back to summary](../../README.md)",
    "",
  ];
  for (const { formFactor, lhr } of pageRuns) {
    lines.push(
      `## ${formFactor}`,
      "",
      `[Full HTML report](../../html/${site.domain}/${slug(route)}-${formFactor}.html)`,
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
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function siteSummary(site, results) {
  const lines = [`## ${site.domain}`, "", `Audited ${results.length} pages at ${site.origin}.`, ""];
  for (const formFactor of formFactors) {
    lines.push(
      `### ${site.domain} ${formFactor}`,
      "",
      `| Page | Perf | A11y | Best practices | SEO | ${metrics.map(([, label]) => label).join(" | ")} |`,
      `| --- | ${[...categories, ...metrics].map(() => "---").join(" | ")} |`,
    );
    const counts = new Map();
    for (const { route, runs } of results) {
      const { lhr } = runs.find((run) => run.formFactor === formFactor);
      const scores = categories.map((category) => score(lhr.categories[category].score));
      const displayValues = metrics.map(([id]) => cell(lhr.audits[id]?.displayValue));
      lines.push(
        `| [\`${route}\`](pages/${site.domain}/${slug(route)}.md) | ${[...scores, ...displayValues].join(" | ")} |`,
      );
      for (const category of categories) {
        for (const failing of failingAudits(lhr, category)) {
          const entry = counts.get(failing.id) ?? { title: failing.title, pages: 0 };
          entry.pages += 1;
          counts.set(failing.id, entry);
        }
      }
    }
    lines.push("", `Most common ${site.domain} ${formFactor} issues:`, "");
    const common = [...counts.values()].sort((left, right) => right.pages - left.pages);
    if (common.length === 0) {
      lines.push("No failing audits.");
    }
    for (const { title, pages } of common) {
      lines.push(`- ${cell(title)}: ${pages} of ${results.length} pages`);
    }
    lines.push("");
  }
  return lines;
}

function runIndex() {
  const entries = readdirSync(reportsDirectory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(reportsDirectory, entry.name, "run.json")),
    )
    .map((entry) =>
      JSON.parse(readFileSync(join(reportsDirectory, entry.name, "run.json"), "utf8")),
    )
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

function summaryReport(siteSections) {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const lines = [
    `# Lighthouse report ${runId}`,
    "",
    `Generated ${new Date().toISOString()} ${values.prod ? "against production" : "against local builds"} at commit \`${commit}\`. Scores below 90 are bold.`,
    "",
    ...siteSections.flatMap(({ site, results }) => siteSummary(site, results)),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

async function sitemapRoutes(origin) {
  const response = await fetch(new URL("/sitemap.xml", origin));
  if (!response.ok) {
    throw new Error(`Could not fetch ${response.url}: HTTP ${response.status}`);
  }
  const text = await response.text();
  return [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map(([, location]) => new URL(location))
    .filter((url) => url.origin === new URL(origin).origin)
    .map((url) => url.pathname);
}

function localRoutes(site) {
  if (!existsSync(join(site.directory, "dist/index.html"))) {
    throw new Error(
      `No build found for ${site.domain}. Run \`bun run build\` first, or pass --prod.`,
    );
  }
  return builtRoutes(join(site.directory, "dist"));
}

function discoverSites() {
  return readdirSync("apps", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join("apps", entry.name, "CNAME")))
    .map((entry) => {
      const directory = join("apps", entry.name);
      const domain = readFileSync(join(directory, "CNAME"), "utf8").trim();
      return { name: entry.name, directory, domain };
    })
    .filter(
      (site) =>
        values.site.length === 0 ||
        values.site.includes(site.name) ||
        values.site.includes(site.domain),
    );
}

const sites = discoverSites();
if (sites.length === 0) {
  throw new Error(`No apps match --site ${values.site.join(", ")}`);
}
const servers = [];
try {
  for (const site of sites) {
    if (values.prod) {
      site.origin = `https://${site.domain}`;
      site.routes = await sitemapRoutes(site.origin);
      continue;
    }
    site.routes = localRoutes(site);
    const server = await preview({
      configFile: false,
      appType: "mpa",
      logLevel: "silent",
      root: site.directory,
      preview: { host: "127.0.0.1", port: 0 },
    });
    servers.push(server);
    site.origin = server.resolvedUrls.local[0];
  }
} catch (error) {
  await Promise.all(servers.map((server) => server.close()));
  throw error;
}

const jobs = sites.flatMap((site) =>
  [...new Set(site.routes)]
    .filter((route) => positionals.length === 0 || positionals.includes(route))
    .toSorted((a, b) => a.localeCompare(b))
    .flatMap((route) => formFactors.map((formFactor) => ({ site, route, formFactor }))),
);
if (jobs.length === 0) {
  await Promise.all(servers.map((server) => server.close()));
  throw new Error(`No routes match ${positionals.join(", ")}`);
}
const total = jobs.length;
const workers = Array.from({ length: Math.min(concurrency, total) }, startWorker);

if (existsSync(outputDirectory)) {
  throw new Error(`Report ${runId} already exists; wait a second and run again`);
}
for (const site of sites) {
  mkdirSync(join(outputDirectory, "pages", site.domain), { recursive: true });
  mkdirSync(join(outputDirectory, "html", site.domain), { recursive: true });
}

const runs = new Map();
const startedAt = performance.now();
let completed = 0;
try {
  await Promise.all(
    workers.map(async (worker) => {
      const started = await worker.ready;
      if (started.error) {
        throw new Error(started.error);
      }
      for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
        const { site, route, formFactor } = job;
        const { lhr, error } = await worker.run({
          url: new URL(route, site.origin).href,
          formFactor,
          categories,
          reportPath: join(
            outputDirectory,
            "html",
            site.domain,
            `${slug(route)}-${formFactor}.html`,
          ),
        });
        if (error) {
          throw new Error(error);
        }
        const key = `${site.domain}${route}`;
        runs.set(key, [...(runs.get(key) ?? []), { formFactor, lhr }]);
        completed += 1;
        console.log(
          `[${completed}/${total}] ${site.domain}${route} ${formFactor}: ${categories.map((category) => score(lhr.categories[category].score).replaceAll("*", "")).join(" / ")}`,
        );
      }
    }),
  );
} finally {
  for (const worker of workers) {
    worker.stop();
  }
  await Promise.all(servers.map((server) => server.close()));
}

const sections = sites.flatMap((site) => {
  const results = site.routes
    .filter((route) => runs.has(`${site.domain}${route}`))
    .sort()
    .map((route) => ({
      route,
      runs: formFactors.map((formFactor) =>
        runs.get(`${site.domain}${route}`).find((run) => run.formFactor === formFactor),
      ),
    }));
  for (const { route, runs: pageRuns } of results) {
    writeFileSync(
      join(outputDirectory, "pages", site.domain, `${slug(route)}.md`),
      pageReport(site, route, pageRuns),
    );
  }
  return results.length === 0 ? [] : [{ site, results }];
});
writeFileSync(join(outputDirectory, "README.md"), summaryReport(sections));
const pageCount = sections.reduce((sum, { results }) => sum + results.length, 0);
const siteNames = sections.map(({ site }) => site.domain).join(" and ");
const failed = sections.flatMap(({ site, results }) =>
  results.flatMap(({ route, runs: pageRuns }) =>
    pageRuns
      .filter(({ lhr }) => lhr.runtimeError)
      .map(
        ({ formFactor, lhr }) =>
          `${site.domain}${route} ${formFactor}: ${lhr.runtimeError.message}`,
      ),
  ),
);
for (const failure of failed) {
  console.error(failure);
}
if (failed.length > 0) {
  process.exitCode = 1;
}
writeFileSync(
  join(outputDirectory, "run.json"),
  `${JSON.stringify({ id: runId, sites: siteNames, pages: pageCount, formFactors, failed: failed.length }, null, 2)}\n`,
);
writeFileSync(join(reportsDirectory, "README.md"), runIndex());
console.log(
  `Audited ${pageCount} pages on ${siteNames} in ${Math.round((performance.now() - startedAt) / 1000)}s.`,
);
console.log(`Report ${runId}: ${join(outputDirectory, "README.md")}`);
console.log(`All reports: ${join(reportsDirectory, "README.md")}`);
