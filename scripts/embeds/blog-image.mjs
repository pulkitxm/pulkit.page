const maxHeightClasses = { 620: "max-h-[620px]" };

export const mediaScript = "/assets/embeds/blog-media.js";
export const mediaStyle = "/assets/embeds/photoswipe.css";

export function zoomLink({ src, width, height, className, image }, escapeHtml) {
  return `<a href="${escapeHtml(src)}" class="${className}" data-media-zoom data-width="${width}" data-height="${height}">${image}</a>`;
}

export function render({ src, width, height, alt, caption, maxHeight }, { assets, escapeHtml }) {
  assets.style(mediaStyle);
  assets.script(mediaScript);
  const heightClass = maxHeight === undefined ? undefined : maxHeightClasses[maxHeight];
  if (maxHeight !== undefined && !heightClass) {
    throw new Error(`Unsupported blog-image maxHeight: ${maxHeight}`);
  }
  const imageClass = [
    "block cursor-zoom-in rounded-lg border border-line",
    heightClass ? `h-auto w-auto max-w-full ${heightClass}` : "h-auto w-full",
  ].join(" ");
  const image = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" class="${imageClass}" loading="lazy" decoding="async">`;
  const link = zoomLink(
    {
      src,
      width,
      height,
      className: heightClass ? "block max-w-full" : "block w-full",
      image,
    },
    escapeHtml,
  );
  const figcaption = caption
    ? `<figcaption class="text-center text-muted text-sm">${escapeHtml(caption)}</figcaption>`
    : "";
  return `<figure class="mx-0 my-6 flex flex-col items-center gap-2">${link}${figcaption}</figure>`;
}
