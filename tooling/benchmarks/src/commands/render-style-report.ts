import { join, resolve } from "node:path";
import process from "node:process";
import { root } from "../styles/config.ts";
import { renderReport } from "../styles/report.ts";

renderReport(
  resolve(process.argv[2] ?? join(root, "reports/style-benchmark")),
  process.argv[3] ?? "measurements.json",
);
