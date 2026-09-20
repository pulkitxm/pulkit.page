import { expect, test } from "bun:test";
import { sha256Hex } from "@pulkit/shared/hash";
import { resolveAnalytics } from "./analytics.ts";

const key = `phc_${"example".repeat(3)}`;

test("analytics stays off until a project key is supplied", () => {
  expect(resolveAnalytics({})).toBeUndefined();
  expect(resolveAnalytics({ POSTHOG_HOST: "https://eu.i.posthog.com" })).toBeUndefined();
  expect(resolveAnalytics({ POSTHOG_KEY: key })).toEqual({
    key,
    host: "https://us.i.posthog.com",
    debug: false,
    ignore: "",
  });
});
test("the ingestion host and debug flag are configurable", () => {
  expect(
    resolveAnalytics({
      POSTHOG_KEY: key,
      POSTHOG_HOST: "https://eu.i.posthog.com/",
      POSTHOG_DEBUG: "1",
    }),
  ).toEqual({ key, host: "https://eu.i.posthog.com", debug: true, ignore: "" });
  expect(resolveAnalytics({ POSTHOG_KEY: key, POSTHOG_DEBUG: "true" })?.debug).toBe(false);
});
test("malformed keys and hosts fail the build", () => {
  expect(() => resolveAnalytics({ POSTHOG_KEY: "secret" })).toThrow("POSTHOG_KEY");
  expect(() => resolveAnalytics({ POSTHOG_KEY: "phc_short" })).toThrow("POSTHOG_KEY");
  for (const POSTHOG_HOST of [
    "posthog.example",
    "http://posthog.example",
    "https://posthog.example/ingest",
    "https://posthog.example/?token=1",
  ]) {
    expect(() => resolveAnalytics({ POSTHOG_KEY: key, POSTHOG_HOST })).toThrow("POSTHOG_HOST");
  }
});
test("the opt-out key is published as a digest, never as the value itself", () => {
  const analytics = resolveAnalytics({ POSTHOG_KEY: key, POSTHOG_IGNORE_KEY: " pulkit " });
  expect(analytics?.ignore).toBe(sha256Hex("pulkit"));
  expect(analytics?.ignore).not.toContain("pulkit");
  expect(resolveAnalytics({ POSTHOG_KEY: key, POSTHOG_IGNORE_KEY: "  " })?.ignore).toBe("");
});
