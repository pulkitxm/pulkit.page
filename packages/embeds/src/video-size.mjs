import { readFileSync } from "node:fs";
import { assetFile } from "@pulkit/theme/files";

const fixedPoint = 65536;
const containers = new Set(["moov", "trak"]);
const sizes = new Map();

function boxType(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
}

function trackSize(view, offset, end) {
  const version = view.getUint8(offset + 8);
  const base = offset + 12 + (version === 1 ? 32 : 20) + 8 + 8 + 36;
  if (base + 8 > end) {
    return;
  }
  const width = Math.round(view.getUint32(base) / fixedPoint);
  const height = Math.round(view.getUint32(base + 4) / fixedPoint);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function findTrackSize(view, start, end) {
  let offset = start;
  while (offset + 8 <= end) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > end) {
      return;
    }
    const type = boxType(view, offset);
    if (containers.has(type)) {
      const nested = findTrackSize(view, offset + 8, offset + size);
      if (nested) {
        return nested;
      }
    }
    if (type === "tkhd") {
      const found = trackSize(view, offset, offset + size);
      if (found) {
        return found;
      }
    }
    offset += size;
  }
}

export function localVideoSize(src) {
  const file = assetFile(src);
  if (!file) {
    return;
  }
  if (!sizes.has(src)) {
    const data = readFileSync(file);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    sizes.set(src, findTrackSize(view, 0, data.byteLength));
  }
  return sizes.get(src);
}
