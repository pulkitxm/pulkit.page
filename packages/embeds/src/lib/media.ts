import type { EmbedProps, EscapeHtml, PageAssets } from "../types.ts";
import { lightboxScript, lightboxStyle } from "./lightbox.ts";
import { optionalString } from "./props.ts";

const mediaScript = "/assets/embeds/blog-media.js";

export interface ZoomLink {
  src: string;
  width: number | undefined;
  height: number | undefined;
  className: string;
  image: string;
}

export function galleryPriority(props: EmbedProps): boolean {
  const loading = optionalString(props, "loading", "image gallery");
  if (loading !== undefined && loading !== "lazy" && loading !== "eager") {
    throw new Error(`Unsupported gallery loading: ${loading}`);
  }
  return loading === "eager";
}

export function loadingAttributes(eager: boolean): string {
  return eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
}

export function zoomLink(
  { src, width, height, className, image }: ZoomLink,
  escapeHtml: EscapeHtml,
): string {
  return `<a href="${escapeHtml(src)}" class="${className}" data-media-zoom data-width="${width}" data-height="${height}">${image}</a>`;
}

export function addMediaAssets(assets: PageAssets): void {
  assets.style(lightboxStyle);
  assets.script(lightboxScript);
  assets.script(mediaScript);
}
