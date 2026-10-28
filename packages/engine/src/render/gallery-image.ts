import { escapeHtml } from "@pulkit/shared/html";
import { safeUrl } from "./html.ts";
import { sizeAttributes } from "./render-context.ts";

export function galleryImage(src: string, alt: string, priority = false): string {
  const source = safeUrl(src);
  const dimensions = sizeAttributes(src);
  const loading = priority ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<img class="pointer-events-none absolute inset-0 m-0 block size-full scale-110 select-none object-cover blur-[16px] brightness-50" src="${source}" alt="" aria-hidden="true"${dimensions} ${priority ? 'loading="eager"' : 'loading="lazy"'} decoding="async" data-gallery-backdrop><img class="relative m-0 block size-full object-contain transition-opacity duration-300 group-hover:opacity-90" src="${source}" alt="${escapeHtml(alt)}"${dimensions} ${loading} decoding="async" data-gallery-image>`;
}
