import { expect, test } from "bun:test";
import { pairedDifference, summarize } from "./statistics.ts";

test("summaries retain spread and do not turn missing measurements into zero", () => {
  expect(summarize([])).toBeNull();
  expect(summarize([1, 2, 3, 4, 100])).toEqual({
    n: 5,
    median: 3,
    p25: 2,
    p75: 4,
    min: 1,
    max: 100,
  });
});

test("paired intervals use within-round differences and require enough paired samples", () => {
  expect(pairedDifference([1, 2], [2, 3])).toBeNull();
  expect(pairedDifference([1, 10, 100, 1000, 10000], [6, 15, 105, 1005, 10005])).toEqual({
    n: 5,
    median: 5,
    lower: 5,
    upper: 5,
  });
});
