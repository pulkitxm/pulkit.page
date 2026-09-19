import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function repositoryFiles(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file && existsSync(file));
}

function isKnownBinary(file: string, bytes: Buffer): boolean {
  const header = bytes.subarray(0, 16).toString("latin1");
  const first = bytes[0] ?? -1;
  const second = bytes[1] ?? -1;
  return (
    (/\.webp$/i.test(file) && header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") ||
    (/\.gif$/i.test(file) && /^GIF8[79]a/.test(header)) ||
    (/\.ttf$/i.test(file) && bytes.length >= 12 && bytes.readUInt32BE(0) === 65_536) ||
    (/\.woff2?$/i.test(file) && /^wOF[2F]/.test(header)) ||
    (/\.pdf$/i.test(file) && header.startsWith("%PDF-")) ||
    (/\.png$/i.test(file) && first === 137 && header.slice(1, 4) === "PNG") ||
    (/\.jpe?g$/i.test(file) && first === 255 && second === 216) ||
    (/\.mp4$/i.test(file) && header.slice(4, 8) === "ftyp") ||
    (/\.mp3$/i.test(file) && (header.startsWith("ID3") || (first === 255 && second >= 224)))
  );
}

export function readRepositoryText(file: string): string | null {
  if (lstatSync(file).isSymbolicLink()) {
    throw new Error(`${file}: symlinks are forbidden`);
  }
  const bytes = readFileSync(file);
  if (isKnownBinary(file, bytes)) {
    return null;
  }
  if (bytes.includes(0)) {
    throw new Error(`${file}: unsupported binary or non-UTF-8 text`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
