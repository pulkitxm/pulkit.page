import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { errorMessage } from "@pulkit/shared/failures";
import sharp from "sharp";
import { imagePolicy, mediaKind, videoPolicy } from "./policy.ts";
import { frameRate, hasFastStart, probeVideo } from "./video.ts";

async function imageFailures(file: string, policyPath: string): Promise<string[]> {
  const metadata = await sharp(readFileSync(file), { animated: true }).metadata();
  const animated = (metadata.pages ?? 1) > 1;
  const policy = imagePolicy(policyPath, animated);
  const extension = extname(file);
  const modern =
    (extension === ".webp" && metadata.format === "webp") ||
    (extension === ".avif" &&
      metadata.format === "heif" &&
      metadata.compression === "av1" &&
      !animated);
  const failures: string[] = [];
  if (policy.format === "modern" ? !modern : metadata.format !== policy.format) {
    failures.push(
      "use WebP or AVIF for raster images, animated WebP for image animations, or SVG for vectors",
    );
  }
  if (animated && !policy.animated) {
    failures.push("this image must be a still image");
  }
  if (statSync(file).size > policy.bytes) {
    failures.push(`exceeds ${policy.bytes / 1024} KiB`);
  }
  const height = metadata.pageHeight ?? metadata.height;
  if (!metadata.width || !height) {
    failures.push("missing image dimensions");
  } else if (Math.max(metadata.width, height) > policy.edge) {
    failures.push(`exceeds ${policy.edge} px on the longest edge`);
  }
  if (
    animated &&
    ((metadata.pages ?? 0) > 600 || (metadata.delay ?? []).reduce((a, b) => a + b, 0) > 30_000)
  ) {
    failures.push(
      "image animations must be at most 600 frames and 30 seconds; use MP4 for longer animations",
    );
  }
  if (metadata.orientation && metadata.orientation !== 1) {
    failures.push("bake image orientation into pixels");
  }
  return failures;
}

function videoFailures(file: string, policyPath: string): string[] {
  if (extname(file) !== ".mp4") {
    return ["use MP4 with H.264 video and AAC audio"];
  }
  const policy = videoPolicy(policyPath);
  const data = probeVideo(file);
  const video = data.streams.filter((entry) => entry.codec_type === "video");
  const audio = data.streams.filter((entry) => entry.codec_type === "audio");
  const failures: string[] = [];
  if (
    !data.format.format_name?.split(",").includes("mp4") ||
    video.length !== 1 ||
    video[0]?.codec_name !== "h264"
  ) {
    failures.push("requires an MP4 container with exactly one H.264 video stream");
  }
  const stream = video[0];
  if (stream?.pix_fmt !== "yuv420p") {
    failures.push("requires yuv420p pixel format for browser playback");
  }
  const width = stream?.width ?? 0;
  const height = stream?.height ?? 0;
  if (
    !width ||
    !height ||
    Math.max(width, height) > policy.edge ||
    Math.min(width, height) > policy.shortEdge
  ) {
    failures.push(
      `requires at most ${policy.edge} x ${policy.shortEdge} px, in either orientation`,
    );
  }
  const fps = frameRate(stream?.avg_frame_rate);
  if (!Number.isFinite(fps) || fps <= 0 || fps > policy.fps + 0.01) {
    failures.push(`requires at most ${policy.fps} fps`);
  }
  const seconds = Number(data.format.duration);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > policy.seconds + 0.05) {
    failures.push(`requires a duration of at most ${policy.seconds} seconds`);
  }
  const bytes = statSync(file).size;
  if (bytes > policy.bytes) {
    failures.push(`exceeds ${policy.bytes / 1024} KiB`);
  }
  if ((bytes * 8) / seconds > policy.bitrate) {
    failures.push(`exceeds ${policy.bitrate / 1_000_000} Mbps average bitrate`);
  }
  if (
    audio.length > 1 ||
    audio.some((entry) => entry.codec_name !== "aac") ||
    (policy.preview && audio.length > 0)
  ) {
    failures.push(
      policy.preview ? "previews must have no audio stream" : "use at most one AAC audio stream",
    );
  }
  if (data.streams.length !== video.length + audio.length) {
    failures.push("remove subtitle, attachment, and data streams");
  }
  if (stream?.side_data_list?.some((entry) => entry.rotation)) {
    failures.push("bake video rotation into pixels");
  }
  if (!hasFastStart(file)) {
    failures.push("move MP4 playback metadata before media data with +faststart");
  }
  return failures;
}

export async function validateMedia(file: string, policyPath = file): Promise<string[]> {
  try {
    const kind = mediaKind(file);
    if (!kind) {
      return [`${file}: unsupported media extension`];
    }
    const failures =
      kind === "image" ? await imageFailures(file, policyPath) : videoFailures(file, policyPath);
    return failures.map((failure) => `${file}: ${failure}`);
  } catch (error) {
    return [`${file}: ${errorMessage(error)}`];
  }
}
