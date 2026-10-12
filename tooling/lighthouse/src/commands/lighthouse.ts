import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { repositoryRoot } from "@pulkit/shared/repository";
import type { PreviewServer } from "vite";
import { preview } from "vite";
import type { FormFactor } from "../lib/audit.ts";
import { categories } from "../lib/audit.ts";
import { categoryOf, score, slug } from "../lib/format.ts";
import { readOptions } from "../lib/options.ts";
import type { PageRun, SiteSection } from "../lib/reports.ts";
import { pageReport, runIndex, summaryReport } from "../lib/reports.ts";
import type { Site } from "../lib/sites.ts";
import { discoverSites, localRoutes, sitemapRoutes } from "../lib/sites.ts";
import { startWorker } from "../lib/worker-pool.ts";

interface AuditedSite extends Site {
  origin: string;
  routes: string[];
}

interface PendingJob {
  site: AuditedSite;
  route: string;
  formFactor: FormFactor;
}

const options = readOptions();
process.chdir(repositoryRoot);
const { formFactors, production, reportsDirectory } = options;
const runId = `${new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replace(/\.\d+Z$/, "Z")}-${production ? "prod" : "local"}`;
const outputDirectory = join(reportsDirectory, runId);

async function closeAll(running: readonly PreviewServer[]): Promise<void> {
  await Promise.all(running.map((server) => server.close()));
}

async function auditedSites(started: PreviewServer[]): Promise<AuditedSite[]> {
  const discovered = discoverSites(options.sites);
  if (discovered.length === 0) {
    throw new Error(`No apps match --site ${options.sites.join(", ")}`);
  }
  const audited: AuditedSite[] = [];
  try {
    for (const site of discovered) {
      if (production) {
        const origin = `https://${site.domain}`;
        audited.push({ ...site, origin, routes: await sitemapRoutes(origin) });
        continue;
      }
      const routes = localRoutes(site);
      const server = await preview({
        configFile: false,
        appType: "mpa",
        logLevel: "silent",
        root: site.directory,
        preview: { host: "127.0.0.1", port: 0 },
      });
      started.push(server);
      audited.push({ ...site, origin: server.resolvedUrls?.local[0] ?? "", routes });
    }
  } catch (error) {
    await closeAll(started);
    throw error;
  }
  return audited;
}

const servers: PreviewServer[] = [];
const sites = await auditedSites(servers);
const jobs: PendingJob[] = sites.flatMap((site) =>
  [...new Set(site.routes)]
    .filter((route) => options.routes.length === 0 || options.routes.includes(route))
    .toSorted((a, b) => a.localeCompare(b))
    .flatMap((route) => formFactors.map((formFactor) => ({ site, route, formFactor }))),
);
if (jobs.length === 0) {
  await closeAll(servers);
  throw new Error(`No routes match ${options.routes.join(", ")}`);
}
const total = jobs.length;
const workers = Array.from({ length: Math.min(options.concurrency, total) }, startWorker);

if (existsSync(outputDirectory)) {
  throw new Error(`Report ${runId} already exists; wait a second and run again`);
}
for (const site of sites) {
  mkdirSync(join(outputDirectory, "pages", site.domain), { recursive: true });
  mkdirSync(join(outputDirectory, "html", site.domain), { recursive: true });
}

const runs = new Map<string, PageRun[]>();
const startedAt = performance.now();
let completed = 0;
try {
  await Promise.all(
    workers.map(async (worker) => {
      const started = await worker.ready;
      if ("error" in started) {
        throw new Error(started.error);
      }
      for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
        const { site, route, formFactor } = job;
        const reply = await worker.run({
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
        if ("error" in reply) {
          throw new Error(reply.error);
        }
        if (!("lhr" in reply)) {
          throw new Error(`Lighthouse worker sent no result for ${site.domain}${route}`);
        }
        const { lhr } = reply;
        const key = `${site.domain}${route}`;
        runs.set(key, [...(runs.get(key) ?? []), { formFactor, lhr }]);
        completed += 1;
        console.log(
          `[${completed}/${total}] ${site.domain}${route} ${formFactor}: ${categories.map((category) => score(categoryOf(lhr, category).score).replaceAll("*", "")).join(" / ")}`,
        );
      }
    }),
  );
} finally {
  for (const worker of workers) {
    worker.stop();
  }
  await closeAll(servers);
}

const sections: SiteSection[] = sites.flatMap((site) => {
  const results = site.routes
    .filter((route) => runs.has(`${site.domain}${route}`))
    .sort()
    .map((route) => {
      const pageRuns = runs.get(`${site.domain}${route}`) ?? [];
      return {
        route,
        runs: formFactors.flatMap((formFactor) =>
          pageRuns.filter((run) => run.formFactor === formFactor).slice(0, 1),
        ),
      };
    });
  for (const { route, runs: pageRuns } of results) {
    writeFileSync(
      join(outputDirectory, "pages", site.domain, `${slug(route)}.md`),
      pageReport(site.domain, route, pageRuns),
    );
  }
  return results.length === 0 ? [] : [{ domain: site.domain, origin: site.origin, results }];
});
writeFileSync(
  join(outputDirectory, "README.md"),
  summaryReport(runId, production, sections, formFactors),
);
const pageCount = sections.reduce((sum, { results }) => sum + results.length, 0);
const siteNames = sections.map(({ domain }) => domain).join(" and ");
const failed = sections.flatMap(({ domain, results }) =>
  results.flatMap(({ route, runs: pageRuns }) =>
    pageRuns.flatMap(({ formFactor, lhr }) =>
      lhr.runtimeError ? [`${domain}${route} ${formFactor}: ${lhr.runtimeError.message}`] : [],
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
writeFileSync(join(reportsDirectory, "README.md"), runIndex(reportsDirectory));
console.log(
  `Audited ${pageCount} pages on ${siteNames} in ${Math.round((performance.now() - startedAt) / 1000)}s.`,
);
console.log(`Report ${runId}: ${join(outputDirectory, "README.md")}`);
console.log(`All reports: ${join(reportsDirectory, "README.md")}`);
