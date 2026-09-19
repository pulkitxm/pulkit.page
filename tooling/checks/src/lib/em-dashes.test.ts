import { expect, test } from "bun:test";
import { emDashLines } from "./em-dashes.ts";

test("detects em dashes in prose and code without banning ordinary hyphens", () => {
  const dash = String.fromCodePoint(0x2014);
  expect(emDashLines(["one-two", `three${dash}four`, `${dash}five`].join("\n"))).toEqual([2, 3]);
  expect(emDashLines("one-two")).toEqual([]);
});
