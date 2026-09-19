import type { EmbedContext, Size } from "../types.ts";
import { iconAttributes } from "./icons.ts";
import { addMediaAssets, loadingAttributes, zoomLink } from "./media.ts";

type CarouselFrame = "bordered" | "plain";

export interface CarouselImage extends Partial<Size> {
  src: string;
  alt: unknown;
}

interface CarouselOptions {
  frame: CarouselFrame;
  label: string;
}

const arrowAttributes = `${iconAttributes} class="pointer-events-none size-4 shrink-0"`;
const arrowLeft = `<svg ${arrowAttributes}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
const arrowRight = `<svg ${arrowAttributes}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
const navigationClass =
  "absolute top-1/2 inline-flex size-8 p-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-[#000]/50 text-[#fff] shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)] transition-[color,background-color,box-shadow] duration-150 hover:bg-[#000]/75 focus-visible:outline-2 focus-visible:outline-offset-2";
const slideFrames: Record<CarouselFrame, string> = {
  bordered: "relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-line",
  plain: "relative aspect-[16/9] w-full overflow-hidden rounded-lg",
};
const backdropClasses: Record<CarouselFrame, string> = {
  bordered:
    "absolute inset-0 h-full w-full scale-110 select-none object-cover blur-[12px] brightness-50",
  plain:
    "absolute inset-0 h-full w-full scale-110 select-none object-cover object-[top_left] blur-[12px] brightness-50",
};

export function renderCarousel(
  images: readonly CarouselImage[],
  { frame, label }: CarouselOptions,
  { assets, escapeHtml }: EmbedContext,
): string {
  addMediaAssets(assets);
  const leading = assets.claim("gallery-lcp");
  const slides = images
    .map((image, index) => {
      const priority = loadingAttributes(index === 0 && leading);
      const backdrop = `<img src="${escapeHtml(image.src)}" alt="" aria-hidden="true" width="${image.width}" height="${image.height}" class="${backdropClasses[frame]}"${priority} decoding="async">`;
      const foreground = `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" class="block h-full w-full select-none object-contain"${priority} decoding="async">`;
      const link = zoomLink(
        {
          src: image.src,
          width: image.width,
          height: image.height,
          className: "block h-full w-full cursor-zoom-in",
          image: foreground,
        },
        escapeHtml,
      );
      return `<section aria-roledescription="slide" aria-label="${index + 1} of ${images.length}" class="min-w-0 shrink-0 grow-0 basis-full pl-4" data-carousel-slide><div class="${slideFrames[frame]}">${backdrop}<div class="absolute inset-0 flex items-center justify-center">${link}</div></div></section>`;
    })
    .join("");
  const dots = images
    .map(
      (_, index) =>
        `<button type="button" class="group flex h-6 min-w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0" aria-label="Go to slide ${index + 1}" aria-current="${index === 0}" data-carousel-dot="${index}"><span class="block h-2 w-2 rounded-full bg-[#fff]/50 transition-[width,background-color] duration-150 group-aria-[current=true]:w-4 group-aria-[current=true]:bg-[#fff]"></span></button>`,
    )
    .join("");
  return `<section class="relative w-full" aria-roledescription="carousel" aria-label="${escapeHtml(label)}" data-carousel><div class="overflow-hidden" data-carousel-viewport><div class="-ml-4 flex">${slides}</div></div><button type="button" class="${navigationClass} left-4 min-[48rem]:left-8" data-carousel-previous>${arrowLeft}<span class="sr-only">Previous slide</span></button><button type="button" class="${navigationClass} right-4 min-[48rem]:right-8" data-carousel-next>${arrowRight}<span class="sr-only">Next slide</span></button><div class="absolute right-0 bottom-3 left-0 flex justify-center">${dots}</div></section>`;
}
