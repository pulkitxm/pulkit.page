import { renderCarousel } from "../lib/carousel.ts";
import { optionalNumber, readRecords, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

export const render: EmbedRenderer = (props, context) => {
  const images = readRecords(props, "images", "blog-gallery").map((image) => ({
    src: readString(image, "src", "blog-gallery"),
    width: optionalNumber(image, "width", "blog-gallery"),
    height: optionalNumber(image, "height", "blog-gallery"),
    alt: image.alt,
  }));
  const carousel = renderCarousel(images, { frame: "bordered", label: "Image gallery" }, context);
  return `<div class="my-8 flex items-center justify-center"><div class="relative mx-auto w-full max-w-[48rem]">${carousel}</div></div>`;
};
