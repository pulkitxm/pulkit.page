import { expect, test } from "bun:test";
import { resolveAnalytics } from "./analytics.ts";

const key = `phc_${"example".repeat(3)}`;

test("analytics stays off until a project key is supplied", () => {
  expect(resolveAnalytics({})).toBeUndefined();
  expect(resolveAnalytics({ POSTHOG_HOST: "https://eu.i.posthog.com" })).toBeUndefined();
  expect(resolveAnalytics({ POSTHOG_KEY: key })).toEqual({
    key,
    host: "https://us.i.posthog.com",
    debug: false,
  });
});
test("the ingestion host and debug flag are configurable", () => {
  expect(
    resolveAnalytics({
      POSTHOG_KEY: key,
      POSTHOG_HOST: "https://eu.i.posthog.com/",
      POSTHOG_DEBUG: "1",
    }),
  ).toEqual({ key, host: "https://eu.i.posthog.com", debug: true });
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
