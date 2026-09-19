import { writeFileSync } from "node:fs";
import process from "node:process";
import { errorMessage } from "@pulkit/shared/failures";
import { launch } from "chrome-launcher";
import type { Flags } from "lighthouse";
import lighthouse, { desktopConfig } from "lighthouse";
import type { AuditJob, WorkerReply } from "../lib/audit.ts";
import { isAuditJob } from "../lib/audit.ts";

const logLevels = ["silent", "error", "warn", "info", "verbose"] as const;
const logLevel: Flags["logLevel"] =
  logLevels.find((level) => level === process.env.LIGHTHOUSE_LOG) ?? "error";
const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });

function reply(message: WorkerReply): void {
  process.send?.(message);
}

async function audit({ url, formFactor, categories, reportPath }: AuditJob): Promise<void> {
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: "html", logLevel, onlyCategories: categories },
      formFactor === "desktop" ? desktopConfig : undefined,
    );
    if (!result) {
      throw new Error(`Lighthouse returned no result for ${url}`);
    }
    writeFileSync(reportPath, [result.report].flat().join(""));
    reply({ lhr: result.lhr });
  } catch (error) {
    reply({ error: `${url} ${formFactor}: ${errorMessage(error)}` });
  }
}

process.on("message", async (message: unknown) => {
  if (isAuditJob(message)) {
    await audit(message);
  }
});

process.once("disconnect", async () => {
  await chrome.kill();
  process.exit(0);
});

reply({ ready: true });
