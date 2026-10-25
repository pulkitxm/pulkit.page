import { extname } from "node:path";

const imageExtensions = new Set([
  ".avif",
  ".webp",
  ".svg",
  ".png",
  ".apng",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".jxl",
  ".ico",
]);
const videoExtensions = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
  ".mpg",
  ".mpeg",
  ".ogv",
  ".3gp",
]);
const compatibilityImages = new Map([
  ["packages/theme/assets/apple-touch-icon.png", { format: "png", edge: 180, bytes: 32 * 1024 }],
  ["packages/theme/assets/favicon-32.png", { format: "png", edge: 32, bytes: 8 * 1024 }],
  ["packages/theme/og/portrait.jpg", { format: "jpeg", edge: 512, bytes: 64 * 1024 }],
]);

export function mediaKind(file: string): "image" | "video" | undefined {
  const extension = extname(file).toLowerCase();
  if (imageExtensions.has(extension)) {
    return "image";
  }
  return videoExtensions.has(extension) ? "video" : undefined;
}

export function imagePolicy(file: string, animated = false) {
  const compatibility = compatibilityImages.get(file);
  if (compatibility) {
    return { ...compatibility, animated: false };
  }
  if (extname(file).toLowerCase() === ".svg") {
    return { format: "svg", edge: Number.POSITIVE_INFINITY, bytes: 64 * 1024, animated: false };
  }
  return {
    format: "modern",
    edge: animated ? 1280 : 2048,
    bytes: (animated ? 1024 : 512) * 1024,
    animated,
  };
}

export function videoPolicy(file: string) {
  const preview = file.endsWith("-preview.mp4");
  return {
    edge: preview ? 480 : 1920,
    shortEdge: preview ? 480 : 1080,
    bytes: preview ? 512 * 1024 : 20 * 1024 * 1024,
    fps: preview ? 24 : 60,
    seconds: preview ? 6 : 120,
    bitrate: preview ? 1_000_000 : 4_000_000,
    preview,
  };
}
