import { writeFileSync } from "node:fs";
import process from "node:process";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });

process.on("message", async ({ url, formFactor, categories, reportPath }) => {
  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "html",
        logLevel: process.env.LIGHTHOUSE_LOG ?? "error",
        onlyCategories: categories,
      },
      formFactor === "desktop" ? desktopConfig : undefined,
    );
    if (!result) {
      throw new Error(`Lighthouse returned no result for ${url}`);
    }
    writeFileSync(reportPath, result.report);
    process.send({ lhr: result.lhr });
  } catch (error) {
    process.send({ error: `${url} ${formFactor}: ${error.message}` });
  }
});

process.once("disconnect", async () => {
  await chrome.kill();
  process.exit(0);
});

process.send({ ready: true });
