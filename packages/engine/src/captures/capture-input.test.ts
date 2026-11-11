import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { normalizeCaptureNotices, verifyCaptureInput } from "./capture-input.ts";

const video = Buffer.from("Synthetic recording bytes");
const runtime = { page_errors: [], viewports: [{ width: 390, overflow: 0 }] };
const observations = Buffer.from(`${JSON.stringify(runtime)}\n`);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const record = { assets: { "demo.mp4": { sha256: hash(video), bytes: video.length } }, runtime };

test("rejects changed completed recordings or altered responsive observations", () => {
  expect(verifyCaptureInput(video, observations, record).input_video_sha256).toBe(hash(video));
  expect(() =>
    verifyCaptureInput(Buffer.concat([video, Buffer.from("changed")]), observations, record),
  ).toThrow("changed before promotion");
  const altered = Buffer.from(
    JSON.stringify({ ...runtime, viewports: [{ width: 390, overflow: 10 }] }),
  );
  expect(() => verifyCaptureInput(video, altered, record)).toThrow("changed before promotion");
});
test("raw recovery requires exact reviewed hashes for both source recording and observations", () => {
  expect(() => verifyCaptureInput(video, observations, null)).toThrow("independently reviewed");
  const review = { video_sha256: hash(video), observations_sha256: hash(observations) };
  expect(verifyCaptureInput(video, observations, null, review).observations_sha256).toBe(
    hash(observations),
  );
  expect(() =>
    verifyCaptureInput(video, observations, null, {
      ...review,
      observations_sha256: "a".repeat(64),
    }),
  ).toThrow("independently reviewed");
});

test("normalizes license line endings without changing attribution or terms", () => {
  const source = "Copyright synthetic author\r\nPermission granted.\r\n";
  const normalized = normalizeCaptureNotices(source);
  expect(normalized.notices).toBe("Copyright synthetic author\nPermission granted.\n");
  expect(normalized.source_notices_sha256).toBe(hash(Buffer.from(source)));
  expect(normalized.notices_sha256).toBe(hash(Buffer.from(normalized.notices)));
});
