import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";

export function repositoryFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file && existsSync(file));
}

export function readRepositoryText(file) {
  if (lstatSync(file).isSymbolicLink()) {
    throw new Error(`${file}: symlinks are forbidden`);
  }
  const bytes = readFileSync(file);
  const header = bytes.subarray(0, 16).toString("latin1");
  const knownBinary =
    (/\.webp$/i.test(file) && header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") ||
    (/\.gif$/i.test(file) && /^GIF8[79]a/.test(header)) ||
    (/\.ttf$/i.test(file) && bytes.length >= 12 && bytes.readUInt32BE(0) === 65536) ||
    (/\.woff2?$/i.test(file) && /^wOF[2F]/.test(header)) ||
    (/\.pdf$/i.test(file) && header.startsWith("%PDF-")) ||
    (/\.png$/i.test(file) && bytes[0] === 137 && header.slice(1, 4) === "PNG") ||
    (/\.jpe?g$/i.test(file) && bytes[0] === 255 && bytes[1] === 216) ||
    (/\.mp4$/i.test(file) && header.slice(4, 8) === "ftyp") ||
    (/\.mp3$/i.test(file) && (header.startsWith("ID3") || (bytes[0] === 255 && bytes[1] >= 224)));
  if (knownBinary) {
    return null;
  }
  if (bytes.includes(0)) {
    throw new Error(`${file}: unsupported binary or non-UTF-8 text`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
