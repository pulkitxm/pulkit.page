import { lightboxScript, localImageSize } from "../lightbox.mjs";
import { renderCarousel } from "./blog-gallery.mjs";
import { mediaScript, mediaStyle, zoomLink } from "./blog-image.mjs";

const gridColumns = {
  1: "grid-cols-1",
  2: "grid-cols-1 min-[48rem]:grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function render({ images, columns = 2, label = "Image carousel" }, context) {
  const resolved = images.map((src) => ({ src, ...localImageSize(src) }));
  if (resolved.length > 2) {
    const slides = resolved.map((image, index) => ({ ...image, alt: `Slide ${index + 1}` }));
    const carousel = renderCarousel(slides, { frame: "plain", label }, context);
    return `<div class="mt-0 mb-6 flex items-center justify-center"><div class="relative mx-auto w-full max-w-[64rem]"><div class="mx-auto w-full max-w-[48rem]">${carousel}</div></div></div>`;
  }
  const { assets, escapeHtml } = context;
  const columnClass = gridColumns[columns];
  if (!columnClass) {
    throw new Error(`Unsupported image-grid columns: ${columns}`);
  }
  assets.style(mediaStyle);
  assets.script(lightboxScript);
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
