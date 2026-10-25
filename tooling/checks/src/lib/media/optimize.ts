import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { parseFragment, serialize } from "parse5";
import sharp from "sharp";
import { imagePolicy, mediaKind, videoPolicy } from "./policy.ts";
import { validateMedia } from "./validate.ts";
import { frameRate, probeVideo } from "./video.ts";

async function encodeImage(
  input: string,
  output: string,
  format: "avif" | "webp" | "png" | "jpeg",
): Promise<Buffer> {
  const source = readFileSync(input);
  const metadata = await sharp(source, { animated: true }).metadata();
  const animated = (metadata.pages ?? 1) > 1;
  if (animated && format === "avif") {
    throw new Error("AVIF animation encoding is unsupported; use animated WebP or MP4");
  }
  const policy = imagePolicy(output, animated);
  const image = (edge = policy.edge) =>
    sharp(source, { animated }).autoOrient().resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
    });
  if (format === "png") {
    return image().png({ compressionLevel: 9 }).toBuffer();
  }
  if (format === "jpeg") {
    return image().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  }
  if (format === "webp" && metadata.format === "png") {
    const lossless = await image().webp({ lossless: true, effort: 6 }).toBuffer();
    if (lossless.length <= policy.bytes) {
      return lossless;
    }
  }
  const qualities = format === "avif" ? [65, 60] : [85, 80];
  for (const edge of [
    policy.edge,
    Math.round(policy.edge * 0.875),
    Math.round(policy.edge * 0.75),
  ]) {
    for (const quality of qualities) {
      const pipeline = image(edge);
      const bytes = await (format === "avif"
        ? pipeline.avif({ quality, effort: 6, chromaSubsampling: "4:4:4" })
        : pipeline.webp({ quality, effort: 4, smartSubsample: true, mixed: animated })
      ).toBuffer();
      if (bytes.length <= policy.bytes) {
        return bytes;
      }
    }
  }
  throw new Error(
    "Cannot meet the image budget at the quality floor. Crop or simplify the source, or use MP4 for animation.",
  );
}

async function encodeVideo(input: string, output: string, temporary: string): Promise<void> {
  try {
    execFileSync(
      "ffmpeg",
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c",
        "copy",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-movflags",
        "+faststart",
        temporary,
      ],
      { timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] },
    );
    if ((await validateMedia(temporary, output)).length === 0) {
      return;
    }
  } catch {}
  rmSync(temporary, { force: true });
  const policy = videoPolicy(output);
  const source = probeVideo(input);
  const video = source.streams.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) {
    throw new Error("No video stream found");
  }
  const short = policy.shortEdge;
  const long = policy.edge;
  const scale = `scale=w='if(gte(iw,ih),min(iw,${long}),min(iw,${short}))':h='if(gte(iw,ih),min(ih,${short}),min(ih,${long}))':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos:out_range=tv,setsar=1`;
  const fps = frameRate(video.avg_frame_rate);
  const filters = Number.isFinite(fps) && fps > policy.fps ? `${scale},fps=${policy.fps}` : scale;
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", input, "-map", "0:v:0"];
  if (policy.preview) {
    args.push("-an", "-t", String(policy.seconds));
  } else {
    const audio = source.streams.find((stream) => stream.codec_type === "audio");
    args.push("-map", "0:a:0?", "-c:a", audio?.codec_name === "aac" ? "copy" : "aac");
    if (audio?.codec_name !== "aac") {
      args.push("-b:a", "128k");
    }
  }
  args.push(
    "-vf",
    filters,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-color_range",
    "tv",
    "-maxrate",
    "3500k",
    "-bufsize",
    "7000k",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-movflags",
    "+faststart",
    temporary,
  );
  execFileSync("ffmpeg", args, { timeout: 600_000, stdio: ["ignore", "pipe", "pipe"] });
}

export async function optimizeMedia(input: string, format?: "avif" | "webp"): Promise<string> {
  const kind = mediaKind(input);
  if (!kind) {
    throw new Error(`${input}: unsupported media extension`);
  }
  if (kind === "video" && format) {
    throw new Error("--format applies only to images");
  }
  if ((await validateMedia(input)).length === 0 && (!format || extname(input) === `.${format}`)) {
    return input;
  }
  if (extname(input).toLowerCase() === ".svg") {
    const directory = mkdtempSync(join(dirname(input), ".media-"));
    const temporary = join(directory, "optimized.svg");
    try {
      writeFileSync(
        temporary,
        `${serialize(parseFragment(readFileSync(input, "utf8"))).trimEnd()}\n`,
      );
      const failures = await validateMedia(temporary, input);
      if (failures.length > 0) {
        throw new Error(
          "SVG cannot meet its budget through syntax normalization; simplify the vector source",
        );
      }
      renameSync(temporary, input);
      return input;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  const compatibility = imagePolicy(input).format;
  const preserveFormat = compatibility === "png" || compatibility === "jpeg";
  if (preserveFormat && format) {
    throw new Error("Browser icons and social-card inputs must retain their required format");
  }
  let selected: "avif" | "webp" | "png" | "jpeg" =
    format ?? (extname(input) === ".avif" ? "avif" : "webp");
  if (preserveFormat) {
    selected = compatibility;
  }
  let extension = kind === "image" ? `.${selected}` : ".mp4";
  if (preserveFormat) {
    extension = extname(input);
  }
  const output = input.slice(0, -extname(input).length) + extension;
  if (output !== input && existsSync(output)) {
    throw new Error(`${output} already exists; refusing to overwrite another asset`);
  }
  const directory = mkdtempSync(join(dirname(input), ".media-"));
  const temporary = join(directory, `optimized${extension}`);
  try {
    if (kind === "image") {
      writeFileSync(temporary, await encodeImage(input, output, selected));
    } else {
      await encodeVideo(input, output, temporary);
    }
    const failures = await validateMedia(temporary, output);
    if (failures.length > 0) {
      throw new Error(failures.join("\n"));
    }
    if (
      output === input &&
      statSync(temporary).size >= statSync(input).size &&
      (await validateMedia(input)).length === 0
    ) {
      return input;
    }
    renameSync(temporary, output);
    return output;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
