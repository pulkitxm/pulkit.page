import { execFileSync, fork } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
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
    origin: { type: "string" },
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
const outputDirectory = values.output;
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error("--concurrency must be a positive integer");
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

function startWorker() {
  const worker = fork(fileURLToPath(new URL("lighthouse-worker.mjs", import.meta.url)));
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

function builtRoutes() {
  if (!existsSync("dist/index.html")) {
    throw new Error("No built site found. Run `bun run build` first, or pass --origin.");
  }
  return routes("dist");
}

const available = values.origin ? await sitemapRoutes(values.origin) : builtRoutes();
const selected = [...new Set(available)]
  .filter((route) => positionals.length === 0 || positionals.includes(route))
  .sort();
if (selected.length === 0) {
  throw new Error(`No routes match ${positionals.join(", ") || "the site"}`);
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
const jobs = selected.flatMap((route) => formFactors.map((formFactor) => ({ route, formFactor })));
const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, startWorker);

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(join(outputDirectory, "pages"), { recursive: true });
mkdirSync(join(outputDirectory, "html"), { recursive: true });

const runsByRoute = new Map(selected.map((route) => [route, []]));
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
        const { route, formFactor } = job;
        const { lhr, error } = await worker.run({
          url: new URL(route, origin).href,
          formFactor,
          categories,
          reportPath: join(outputDirectory, "html", `${slug(route)}-${formFactor}.html`),
        });
        if (error) {
          throw new Error(error);
        }
        runsByRoute.get(route).push({ formFactor, lhr });
        completed += 1;
        console.log(
          `[${completed}/${selected.length * formFactors.length}] ${route} ${formFactor}: ${categories.map((category) => score(lhr.categories[category].score).replaceAll("*", "")).join(" / ")}`,
        );
      }
    }),
  );
} finally {
  for (const worker of workers) {
    worker.stop();
  }
  await server?.close();
}

const results = selected.map((route) => ({
  route,
  runs: formFactors.map((formFactor) =>
    runsByRoute.get(route).find((run) => run.formFactor === formFactor),
  ),
}));
for (const { route, runs } of results) {
  writeFileSync(join(outputDirectory, "pages", `${slug(route)}.md`), pageReport(route, runs));
}
writeFileSync(join(outputDirectory, "README.md"), summaryReport(results, origin));
const failed = results.flatMap(({ route, runs }) =>
  runs
    .filter(({ lhr }) => lhr.runtimeError)
    .map(({ formFactor, lhr }) => `${route} ${formFactor}: ${lhr.runtimeError.message}`),
);
for (const failure of failed) {
  console.error(failure);
}
if (failed.length > 0) {
  process.exitCode = 1;
}
console.log(
  `Audited ${results.length} pages in ${Math.round((performance.now() - startedAt) / 1000)}s. Summary: ${join(outputDirectory, "README.md")}`,
);
