import { expect, test } from "bun:test";
import { formatDuration } from "./duration.ts";

test("formats elapsed time using appropriate units", () => {
  expect(formatDuration(0)).toBe("0 ms");
  expect(formatDuration(999)).toBe("999 ms");
  expect(formatDuration(1234)).toBe("1.23 s");
  expect(formatDuration(61_234)).toBe("1 min 1.2 s");
  expect(formatDuration(3_661_234)).toBe("1 h 1 min 1.2 s");
});
