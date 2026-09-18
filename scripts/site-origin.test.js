import { expect, test } from "bun:test";
import { generationDirectory, resolveSiteOrigin } from "./site-origin.mjs";

test("production reads CNAME and follows domain changes", () => {
  expect(resolveSiteOrigin({}, () => "portfolio.example\n")).toBe("https://portfolio.example");
  expect(resolveSiteOrigin({ NODE_ENV: "production" }, () => "changed.example\n")).toBe(
    "https://changed.example",
  );
  expect(() => resolveSiteOrigin({}, () => "https://bad.example/path")).toThrow("CNAME");
});
test("development and custom environments resolve their own origins", () => {
  expect(resolveSiteOrigin({ NODE_ENV: "development" })).toBe("http://127.0.0.1:3000");
  expect(resolveSiteOrigin({ NODE_ENV: "development", PORT: "4178" })).toBe(
    "http://127.0.0.1:4178",
  );
  expect(resolveSiteOrigin({ NODE_ENV: "staging", SITE_URL: "https://preview.example/" })).toBe(
    "https://preview.example",
  );
  expect(resolveSiteOrigin({ NODE_ENV: "production", SITE_URL: "https://custom.example" })).toBe(
    "https://custom.example",
  );
  expect(() => resolveSiteOrigin({ NODE_ENV: "staging" })).toThrow("SITE_URL is required");
  expect(() => resolveSiteOrigin({ NODE_ENV: "development", PORT: "0" })).toThrow("resolved PORT");
});
test("invalid overrides fail rather than leaking credentials or dropping paths", () => {
  for (const SITE_URL of [
    "example.com",
    "ftp://example.com",
    `https://${["user", "pass"].join(":")}@example.com`,
    "https://example.com/path",
    "https://example.com/?query=1",
    "https://example.com/#fragment",
  ]) {
    expect(() => resolveSiteOrigin({ SITE_URL })).toThrow("SITE_URL");
  }
});
test("environment output is isolated from committed production pages", () => {
  expect(generationDirectory({})).toBe("pages");
  expect(generationDirectory({ NODE_ENV: "development" })).toBe("dist");
  expect(generationDirectory({ SITE_URL: "https://preview.example" })).toBe("dist");
  expect(generationDirectory({ SITE_OUTPUT_DIR: "dist/dev-4178" })).toBe("dist/dev-4178");
  expect(() => generationDirectory({ SITE_OUTPUT_DIR: "../outside" })).toThrow("SITE_OUTPUT_DIR");
  expect(() => generationDirectory({ SITE_OUTPUT_DIR: "pages", NODE_ENV: "development" })).toThrow(
    "reserved for production",
  );
});
