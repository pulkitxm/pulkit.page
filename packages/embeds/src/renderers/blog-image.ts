import { lightboxScript, lightboxStyle, localImageSize } from "../lib/lightbox.ts";
import { zoomLink } from "../lib/media.ts";
import { optionalNumber, optionalString, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const maxHeightClasses: Readonly<Record<number, string>> = { 620: "max-h-[620px]" };

export const render: EmbedRenderer = (props, { assets, escapeHtml }) => {
  const src = readString(props, "src", "blog-image");
  const maxHeight = optionalNumber(props, "maxHeight", "blog-image");
  const caption = optionalString(props, "caption", "blog-image");
  assets.style(lightboxStyle);
  assets.script(lightboxScript);
  const measured = localImageSize(src);
  const shownWidth = optionalNumber(props, "width", "blog-image") ?? measured?.width;
  const shownHeight = optionalNumber(props, "height", "blog-image") ?? measured?.height;
  const heightClass = maxHeight === undefined ? undefined : maxHeightClasses[maxHeight];
  if (maxHeight !== undefined && !heightClass) {
    throw new Error(`Unsupported blog-image maxHeight: ${maxHeight}`);
  }
  const imageClass = [
    "block cursor-zoom-in rounded-lg border border-line",
    heightClass ? `h-auto w-auto max-w-full ${heightClass}` : "h-auto w-full",
  ].join(" ");
  const image = `<img src="${escapeHtml(src)}" alt="${escapeHtml(props.alt)}" width="${shownWidth}" height="${shownHeight}" class="${imageClass}" loading="lazy" decoding="async">`;
  const link = zoomLink(
    {
      src,
      width: shownWidth,
      height: shownHeight,
      className: heightClass ? "block max-w-full" : "block w-full",
      image,
    },
    escapeHtml,
  );
  const figcaption = caption
    ? `<figcaption class="text-center text-muted text-sm">${escapeHtml(caption)}</figcaption>`
    : "";
  return `<figure class="mx-0 my-6 flex flex-col items-center gap-2">${link}${figcaption}</figure>`;
};
