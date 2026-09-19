import process from "node:process";
import { builtRoutes } from "@pulkit/shared/built-site";
import { type Browser, chromium } from "playwright";
import { preview } from "vite";
import { auditsSiteFlows, buildDirectory } from "../browser/audit-config.ts";
import { auditLinks, auditPages } from "../browser/page-audit.ts";
import { report, reportedProblems } from "../browser/problems.ts";
import { auditSiteFlows } from "../browser/site-flows.ts";
import { localServerUrl } from "../lib/server.ts";
import { readSite } from "../site/site-inventory.ts";

const { pages, site } = readSite("http://localhost");
const collections = pages.filter((page) => page.index).map((page) => page.route);
const navigationTarget =
  site.navigation?.find((item) => item.href.startsWith("/"))?.href ??
  pages.find((page) => page.route !== "/")?.route ??
  "/";

const server = await preview({
  configFile: false,
  appType: "mpa",
  logLevel: "silent",
  preview: { host: "127.0.0.1", port: 0 },
});
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const origin = localServerUrl(server.resolvedUrls).replace(/\/$/, "");
  const paths = builtRoutes(buildDirectory);
  if (paths.length === 0) {
    report("build", "The build must contain pages");
  }
  const documents = await auditPages(browser, origin, paths);
  auditLinks(documents, origin);
  if (auditsSiteFlows) {
    await auditSiteFlows(browser, origin, paths, { collections, navigationTarget });
  }
} finally {
  await browser?.close();
  await server.close();
}
const problems = reportedProblems();
if (problems.length > 0) {
  console.error(`\n${problems.length} browser problems:\n${problems.join("\n")}`);
  process.exitCode = 1;
}
