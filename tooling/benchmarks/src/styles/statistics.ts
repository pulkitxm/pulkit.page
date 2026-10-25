import { median, quantile } from "simple-statistics";

export function summarize(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }
  const samples = [...values];
  return {
    n: samples.length,
    median: median(samples),
    p25: quantile(samples, 0.25),
    p75: quantile(samples, 0.75),
    min: Math.min(...samples),
    max: Math.max(...samples),
  };
}

export function pairedDifference(baseline: readonly number[], candidate: readonly number[]) {
  if (baseline.length !== candidate.length || baseline.length < 5) {
    return null;
  }
  const differences = candidate.map((value, index) => value - (baseline[index] ?? 0));
  let state = 917;
  const resampled = Array.from({ length: 2000 }, () =>
    median(
      Array.from({ length: differences.length }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return differences[Math.floor((state / 4294967296) * differences.length)] ?? 0;
      }),
    ),
  );
  return {
    n: differences.length,
    median: median(differences),
    lower: quantile(resampled, 0.025),
    upper: quantile(resampled, 0.975),
  };
}
