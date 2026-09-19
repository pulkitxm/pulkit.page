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
        default: String(Math.max(1, Math.floor(availableParallelism() / 2))),
      },
      output: { type: "string", default: "reports/lighthouse" },
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
  return {
    formFactors,
    production: values.prod,
    sites: values.site,
    routes: positionals,
    concurrency,
    reportsDirectory: values.output,
  };
}
