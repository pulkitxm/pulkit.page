import { statSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";
import { errorMessage, failWith } from "@pulkit/shared/failures";
import { optimizeMedia } from "../lib/media/optimize.ts";

const arguments_ = process.argv.slice(2);
if (arguments_.includes("--help") || arguments_.length === 0) {
  console.log(
    "Usage: bun run media:optimize [--format webp|avif] <file> [file...]\nOptimizes only supplied files. Format changes create siblings; update references and remove originals after review.\nRequires FFmpeg (ffmpeg and ffprobe) for video.",
  );
  process.exit(arguments_.includes("--help") ? 0 : 1);
}
let format: "avif" | "webp" | undefined;
const files: string[] = [];
const remaining = arguments_.values();
for (const argument of remaining) {
  if (argument === "--format") {
    const selected = remaining.next().value;
    if (selected !== "avif" && selected !== "webp") {
      failWith("--format must be webp or avif");
    }
    format = selected;
  } else if (argument.startsWith("--")) {
    failWith(`Unknown option: ${argument}`);
  } else {
    files.push(relative(process.cwd(), resolve(argument)));
  }
}
if (files.length === 0) {
  failWith("Supply at least one file to optimize");
}
for (const file of files) {
  try {
    const before = statSync(file).size;
    const output = await optimizeMedia(file, format);
    console.log(`${file} -> ${output}: ${before} -> ${statSync(output).size} bytes`);
    if (file !== output) {
      console.log(`Update references to ${output}, then remove ${file} after review.`);
    }
  } catch (error) {
    failWith(`${file}: ${errorMessage(error)}`);
  }
}
