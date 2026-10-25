import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface Stream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  side_data_list?: { rotation?: number }[];
}

export interface Video {
  streams: Stream[];
  format: { duration?: string; format_name?: string };
}

export function probeVideo(file: string): Video {
  try {
    return JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration,format_name:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate:stream_side_data=rotation",
          "-of",
          "json",
          file,
        ],
        { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
  } catch (error) {
    throw new Error(
      "Cannot inspect video. Install FFmpeg (including ffprobe) and provide a readable media file.",
      { cause: error },
    );
  }
}

export function frameRate(value = ""): number {
  const [numerator = 0, denominator = 1] = value.split("/").map(Number);
  return numerator / denominator;
}

export function hasFastStart(file: string): boolean {
  const data = readFileSync(file);
  let offset = 0;
  let movie = false;
  while (offset + 8 <= data.length) {
    let size = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1 && offset + 16 <= data.length) {
      size = Number(data.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = data.length - offset;
    }
    if (!Number.isSafeInteger(size) || size < header || offset + size > data.length) {
      return false;
    }
    if (type === "moov") {
      movie = true;
    }
    if (type === "mdat") {
      return movie;
    }
    offset += size;
  }
  return false;
}
