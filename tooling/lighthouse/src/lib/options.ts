import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import type { FormFactor } from "./audit.ts";
import { isFormFactor } from "./audit.ts";

export interface LighthouseOptions {
  formFactors: FormFactor[];
  production: boolean;
  sites: string[];
  routes: string[];
  concurrency: number;
  reportsDirectory: string;
  minimumScore: number;
}

export function readOptions(): LighthouseOptions {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "form-factor": { type: "string", default: "both" },
      prod: { type: "boolean", default: false },
      site: { type: "string", multiple: true, default: [] },
      concurrency: {
        type: "string",
        default: String(Math.min(5, Math.max(1, Math.floor(availableParallelism() / 2)))),
      },
      output: { type: "string", default: "reports/lighthouse" },
      "min-score": { type: "string", default: "0" },
    },
  });
  const requested =
    values["form-factor"] === "both" ? ["mobile", "desktop"] : [values["form-factor"]];
  const formFactors = requested.filter(isFormFactor);
  if (formFactors.length !== requested.length) {
    throw new Error("--form-factor must be mobile, desktop, or both");
  }
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }
  const minimumScore = Number(values["min-score"]);
  if (!Number.isInteger(minimumScore) || minimumScore < 0 || minimumScore > 100) {
    throw new Error("--min-score must be an integer between 0 and 100");
  }
  return {
    minimumScore,
    formFactors,
    production: values.prod,
    sites: values.site,
    routes: positionals,
    concurrency,
    reportsDirectory: values.output,
  };
}
