import { readFileSync } from "node:fs";
import { assetFile } from "@pulkit/theme/files";
import { imageSize } from "image-size";
import type { EscapeHtml, PageAssets, Size } from "../types.ts";

export const lightboxScript = "/assets/embeds/lightbox.js";
export const lightboxStyle = "/assets/embeds/photoswipe.css";
const sizes = new Map<string, Size>();

export function localImageSize(src: string): Size | undefined {
  const file = assetFile(src);
  if (!file) {
    return;
  }
  const cached = sizes.get(src);
  if (cached) {
    return cached;
  }
  const { width, height } = imageSize(readFileSync(file));
  const size = { width, height };
  sizes.set(src, size);
  return size;
}

interface Zoomable {
  src: string;
  image: string;
  className?: string;
  assets: PageAssets;
  escapeHtml: EscapeHtml;
}

export function zoomable({ src, image, className = "", assets, escapeHtml }: Zoomable): string {
  const size = localImageSize(src);
  assets.style(lightboxStyle);
  assets.script(lightboxScript);
  const dimensions = size ? ` data-width="${size.width}" data-height="${size.height}"` : "";
  const label = /\balt=""/.test(image) ? '<span class="sr-only">Open image</span>' : "";
  return `<a href="${escapeHtml(src)}" class="${className}" data-media-zoom${dimensions}>${image}${label}</a>`;
}
