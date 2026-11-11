import { createHash } from "node:crypto";

interface RawReview {
  video_sha256: string;
  observations_sha256: string;
}
interface CaptureRecord {
  assets: { "demo.mp4": { sha256: string; bytes: number } };
  runtime: unknown;
}
function hash(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function verifyCaptureInput(
  video: Uint8Array,
  observations: Uint8Array,
  existing: CaptureRecord | null,
  review?: RawReview,
): { input_video_sha256: string; observations_sha256: string } {
  const videoHash = hash(video);
  const observationsHash = hash(observations);
  if (existing) {
    if (
      existing.assets?.["demo.mp4"]?.sha256 !== videoHash ||
      existing.assets["demo.mp4"].bytes !== video.byteLength ||
      JSON.stringify(existing.runtime) !==
        JSON.stringify(JSON.parse(Buffer.from(observations).toString()))
    ) {
      throw new Error("Previously captured recording or observations changed before promotion");
    }
  } else if (
    review?.video_sha256 !== videoHash ||
    review.observations_sha256 !== observationsHash
  ) {
    throw new Error("Raw recording and observations need exact independently reviewed hashes");
  }
  return { input_video_sha256: videoHash, observations_sha256: observationsHash };
}

export function normalizeCaptureNotices(source: string): {
  notices: string;
  source_notices_sha256: string;
  notices_sha256: string;
  notices_normalization: string;
} {
  const notices = source.replaceAll("\r\n", "\n");
  return {
    notices,
    source_notices_sha256: hash(Buffer.from(source)),
    notices_sha256: hash(Buffer.from(notices)),
    notices_normalization: "CRLF to LF line endings only; license and attribution text unchanged",
  };
}
