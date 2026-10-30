import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Artifact, BuildSample, HostActivity, NavigationSample, Profile } from "./config.ts";
import { variants } from "./config.ts";
import type { ParityResult } from "./parity.ts";
import { pairedDifference, summarize } from "./statistics.ts";

interface Measurements {
  metadata: {
    startedAt: string;
    commit: string;
    inputHash: string;
    cssHash: string;
    runs: number;
    warmups: number;
    host: Record<string, unknown>;
    browsers: Record<string, string>;
    environment: { engine: string; profile: Profile }[];
  };
  builds: BuildSample[];
  samples: NavigationSample[];
  hostActivity?: HostActivity[];
}

export const metricLabels: Record<string, string> = {
  ttfbMs: "TTFB (ms)",
  fcpMs: "First contentful paint (ms)",
  lcpMs: "Largest contentful paint (ms)",
  loadMs: "Load event (ms)",
  domContentLoadedMs: "DOMContentLoaded (ms)",
  observedBlockingMs: "Observed blocking, FCP to cutoff (ms)",
  styleMs: "Style recalculation (ms)",
  layoutMs: "Layout work (ms)",
  scriptMs: "Script execution (ms)",
  taskMs: "Main-thread task work (ms)",
  jsHeapMiB: "JS heap snapshot (MiB)",
  cls: "Layout shift score",
  serverBodyBytes: "Response body bytes",
  themePaintMs: "Theme update presentation proxy (ms)",
  clickEventMs: "Single lab interaction event duration (ms)",
  styleFlushMs: "Forced style flush, average (ms)",
};

export function reportData(output: string, filename = "measurements.json") {
  const measured: Measurements = JSON.parse(readFileSync(join(output, filename), "utf8"));
  const parity: ParityResult[] = JSON.parse(readFileSync(join(output, "parity.json"), "utf8"));
  const artifacts = variants.map((variant) => {
    const artifact: Artifact = JSON.parse(
      readFileSync(join(output, "variants", variant.id, "artifact.json"), "utf8"),
    );
    return {
      ...variant,
      htmlBytes: artifact.htmlBytes,
      htmlGzip: artifact.htmlGzip,
      htmlBrotli: artifact.htmlBrotli,
      cssBytes: artifact.cssBytes,
      cssGzip: artifact.cssGzip,
      cssRules: artifact.cssRules,
      classTokens: artifact.classTokens,
      coldHtmlCssGzip: artifact.htmlGzip + (variant.id === "external" ? artifact.cssGzip : 0),
    };
  });
  const builds = variants.map((variant) => {
    const rows = measured.builds.filter((row) => row.variant === variant.id);
    return {
      variant: variant.id,
      pipeline: summarize(rows.map((row) => row.wallMs)),
      process: summarize(rows.map((row) => row.processMs)),
      stages: Object.fromEntries(
        ["tailwind", "transform", "bundle", "optimize"].map((stage) => [
          stage,
          summarize(
            rows.flatMap((row) => {
              const value = row.stages[stage];
              return typeof value === "number" ? [value] : [];
            }),
          ),
        ]),
      ),
    };
  });
  const groups = measured.metadata.environment.flatMap(({ engine, profile }) =>
    ["cold", "warm"].flatMap((cache) =>
      variants.map((variant) => {
        const key = `${engine}:${profile.id}`;
        const rows = measured.samples.filter(
          (row) =>
            row.profile === key &&
            row.cache === cache &&
            row.variant === variant.id &&
            row.errors.length === 0,
        );
        const metrics = Object.fromEntries(
          Object.keys(metricLabels).map((metric) => [
            metric,
            summarize(
              rows.flatMap((row) => {
                const value = row.metrics[metric];
                return typeof value === "number" && Number.isFinite(value) ? [value] : [];
              }),
            ),
          ]),
        );
        return { profile: key, cache, variant: variant.id, metrics };
      }),
    ),
  );
  const comparisons = groups.flatMap((group) =>
    ["utilities", "composed", "pruned"].flatMap((reference) =>
      Object.keys(metricLabels).map((metric) => {
        const baseline = measured.samples.filter(
          (row) =>
            row.profile === group.profile &&
            row.cache === group.cache &&
            row.variant === reference &&
            row.errors.length === 0,
        );
        const paired = baseline.flatMap((row) => {
          const candidate = measured.samples.find(
            (other) =>
              other.profile === row.profile &&
              other.cache === row.cache &&
              other.round === row.round &&
              other.variant === group.variant &&
              other.errors.length === 0,
          );
          const a = row.metrics[metric];
          const b = candidate?.metrics[metric];
          return typeof a === "number" && typeof b === "number" ? [[a, b] as const] : [];
        });
        return {
          profile: group.profile,
          cache: group.cache,
          variant: group.variant,
          reference,
          metric,
          interval: pairedDifference(
            paired.map(([a]) => a),
            paired.map(([, b]) => b),
          ),
        };
      }),
    ),
  );
  const summary = {
    metadata: measured.metadata,
    artifacts,
    builds,
    groups,
    comparisons,
    parity: {
      checks: parity.length,
      failures: parity.filter((row) => !row.passed).length,
      saturatedRadiusDifferences: parity.reduce(
        (sum, row) => sum + (row.saturatedRadiusDifferences ?? 0),
        0,
      ),
      largestPixelDifference: Math.max(...parity.map((row) => row.pixelMean ?? 0)),
    },
    sampleErrors: measured.samples.filter((row) => row.errors.length > 0),
    hostActivity: summarize(
      (measured.hostActivity ?? [])
        .filter((row) => row.round >= 0)
        .map((row) => row.cpuBusyPercent),
    ),
  };
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const keys = [...new Set(measured.samples.flatMap((row) => Object.keys(row.metrics)))].sort();
  const rows = [
    ["profile", "variant", "cache", "round", ...keys],
    ...measured.samples.map((row) => [
      row.profile,
      row.variant,
      row.cache,
      row.round,
      ...keys.map((key) => row.metrics[key] ?? ""),
    ]),
  ];
  writeFileSync(
    join(output, "measurements.csv"),
    `${rows.map((row) => row.join(",")).join("\n")}\n`,
  );
  return summary;
}
