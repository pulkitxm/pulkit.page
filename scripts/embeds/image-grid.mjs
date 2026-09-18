import { readFileSync } from "node:fs";
import { renderCarousel } from "./blog-gallery.mjs";
import { mediaScript, mediaStyle, zoomLink } from "./blog-image.mjs";

const gridColumns = {
  1: "grid-cols-1",
  2: "grid-cols-1 min-[48rem]:grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function webpSize(bytes) {
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  return undefined;
}

function imageSize(src) {
  if (!src.startsWith("/assets/")) {
    throw new Error(`image-grid image must come from /assets/: ${src}`);
  }
  const bytes = readFileSync(src.slice(1));
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const size = webpSize(bytes);
    if (size) {
      return size;
    }
  }
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  throw new Error(`Unsupported image-grid image format: ${src}`);
}

export function render({ images, columns = 2 }, context) {
  const resolved = images.map((src) => ({ src, ...imageSize(src) }));
  if (resolved.length > 2) {
    const slides = resolved.map((image, index) => ({ ...image, alt: `Slide ${index + 1}` }));
    const carousel = renderCarousel(slides, { frame: "plain", label: "Image carousel" }, context);
    return `<div class="mt-0 mb-6 flex items-center justify-center"><div class="relative mx-auto w-full max-w-[64rem]"><div class="mx-auto w-full max-w-[48rem]">${carousel}</div></div></div>`;
  }
  const { assets, escapeHtml } = context;
  const columnClass = gridColumns[columns];
  if (!columnClass) {
    throw new Error(`Unsupported image-grid columns: ${columns}`);
  }
  assets.style(mediaStyle);
  assets.script(mediaScript);
  const items = resolved
    .map((image, index) =>
      zoomLink(
        {
          ...image,
          className: "mx-auto block w-full max-w-[48rem]",
          image: `<img src="${escapeHtml(image.src)}" alt="Image ${index + 1}" width="${image.width}" height="${image.height}" class="mx-auto block h-auto w-full max-w-[48rem] cursor-zoom-in rounded-lg" loading="lazy" decoding="async">`,
        },
        escapeHtml,
      ),
    )
    .join("");
  return `<div class="mx-auto mt-0 mb-6 grid max-w-[48rem] gap-4 ${columnClass}">${items}</div>`;
}
