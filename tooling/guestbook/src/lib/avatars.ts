import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { guestbookEntry } from "@pulkit/shared/guestbook";
import sharp from "sharp";
import { repositoryRoot } from "./store.ts";

const maximumDownloadBytes = 5 * 1024 * 1024;

export async function downloadAvatar(url: string | null, id: string): Promise<string | null> {
  if (!url) {
    return null;
  }
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !/^(avatars\.githubusercontent\.com|lh[\d]+\.googleusercontent\.com)$/.test(parsed.hostname)
  ) {
    throw new Error(`Unsupported avatar host for ${id}`);
  }
  const asset = `/assets/guestbook/${id}.webp`;
  guestbookEntry.shape.avatar.parse(asset);
  const path = resolve(repositoryRoot, `apps/page${asset}`);
  if (existsSync(path)) {
    return asset;
  }
  const response = await fetch(parsed, { signal: AbortSignal.timeout(20000), redirect: "error" });
  if (!response.ok) {
    console.warn(`Avatar unavailable for ${id}: HTTP ${response.status}`);
    return null;
  }
  if (Number(response.headers.get("content-length")) > maximumDownloadBytes) {
    throw new Error(`Avatar download too large for ${id}`);
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (!response.body) {
    throw new Error(`Empty avatar response for ${id}`);
  }
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maximumDownloadBytes) {
      throw new Error(`Avatar download too large for ${id}`);
    }
    chunks.push(chunk);
  }
  const image = await sharp(Buffer.concat(chunks), { limitInputPixels: 16000000 })
    .rotate()
    .resize(64, 64, { fit: "cover" })
    .webp({ quality: 45, effort: 6 })
    .toBuffer();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, image);
  return asset;
}
