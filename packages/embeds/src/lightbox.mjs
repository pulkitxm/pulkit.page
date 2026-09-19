import { readFileSync } from "node:fs";
import { assetFile } from "@pulkit/theme/files";
import { imageSize } from "image-size";

export const lightboxScript = "/assets/embeds/lightbox.js";
export const lightboxStyle = "/assets/embeds/photoswipe.css";
const sizes = new Map();

export function localImageSize(src) {
  const file = assetFile(src);
  if (!file) {
    return;
  }
  if (!sizes.has(src)) {
    const { width, height } = imageSize(readFileSync(file));
    sizes.set(src, { width, height });
  }
  return sizes.get(src);
}

export function zoomable({ src, image, className = "", assets, escapeHtml }) {
  const size = localImageSize(src);
  assets.style(lightboxStyle);
  assets.script(lightboxScript);
  const dimensions = size ? ` data-width="${size.width}" data-height="${size.height}"` : "";
  const label = /\balt=""/.test(image) ? '<span class="sr-only">Open image</span>' : "";
  return `<a href="${escapeHtml(src)}" class="${className}" data-media-zoom${dimensions}>${image}${label}</a>`;
}
