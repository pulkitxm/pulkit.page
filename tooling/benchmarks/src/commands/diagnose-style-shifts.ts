import { join, resolve } from "node:path";
import process from "node:process";
import { root } from "../styles/config.ts";
import { diagnoseShifts } from "../styles/shift-diagnostics.ts";

await diagnoseShifts(resolve(process.argv[2] ?? join(root, "reports/style-benchmark")));
