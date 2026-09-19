import { availableParallelism } from "node:os";
import process from "node:process";

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const buildDirectory = "dist";
export const themeKey = "portfolio-theme";
export const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
export const themeDependentRules = ["color-contrast", "link-in-text-block"];
export const blockingImpacts: ReadonlySet<string> = new Set(["moderate", "serious", "critical"]);

const desktop: Viewport = { name: "desktop", width: 1440, height: 900 };
const mobile: Viewport = { name: "mobile", width: 390, height: 844 };
export const defaultViewport = desktop;

const selectedViewport = process.env.BROWSER_VIEWPORT;
export const auditedViewports = [desktop, mobile].filter(
  (viewport) => !selectedViewport || viewport.name === selectedViewport,
);
if (auditedViewports.length === 0) {
  throw new Error(`Unknown BROWSER_VIEWPORT ${selectedViewport}`);
}

const [shardIndex = Number.NaN, shardCount = Number.NaN] = (process.env.BROWSER_SHARD ?? "1/1")
  .split("/")
  .map(Number);
if (!(shardIndex >= 1 && shardIndex <= shardCount)) {
  throw new Error(`Invalid BROWSER_SHARD ${process.env.BROWSER_SHARD}`);
}

export function ownsPath(index: number): boolean {
  return index % shardCount === shardIndex - 1;
}

export const auditsSiteFlows = auditedViewports.includes(mobile) && shardIndex === shardCount;

export const workersPerViewport = Math.max(
  1,
  Math.floor(availableParallelism() / auditedViewports.length),
);
