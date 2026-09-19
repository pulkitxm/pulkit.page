import { mediaScript, mediaStyle, zoomLink } from "./blog-image.mjs";
import { lightboxScript } from "./lightbox.mjs";

const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="pointer-events-none size-4 shrink-0"';
const arrowLeft = `<svg ${iconAttributes}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
const arrowRight = `<svg ${iconAttributes}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
const navigationClass =
  "absolute top-1/2 inline-flex size-8 p-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-[#000]/50 text-[#fff] shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)] transition-[color,background-color,box-shadow] duration-150 hover:bg-[#000]/75 focus-visible:outline-2 focus-visible:outline-offset-2";
const slideFrames = {
  bordered: "relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-line",
  plain: "relative aspect-[16/9] w-full overflow-hidden rounded-lg",
};
const backdropClasses = {
  bordered:
    "absolute inset-0 h-full w-full scale-110 select-none object-cover blur-[12px] brightness-50",
  plain:
    "absolute inset-0 h-full w-full scale-110 select-none object-cover object-[top_left] blur-[12px] brightness-50",
};

export function renderCarousel(images, { frame, label }, { assets, escapeHtml }) {
  assets.style(mediaStyle);
  assets.script(lightboxScript);
  assets.script(mediaScript);
  const slides = images
    .map((image, index) => {
      const backdrop = `<img src="${escapeHtml(image.src)}" alt="" aria-hidden="true" width="${image.width}" height="${image.height}" class="${backdropClasses[frame]}" loading="lazy" decoding="async">`;
      const foreground = `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" class="block h-full w-full select-none object-contain" loading="lazy" decoding="async">`;
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

export function render({ images }, context) {
  const carousel = renderCarousel(images, { frame: "bordered", label: "Image gallery" }, context);
  return `<div class="my-8 flex items-center justify-center"><div class="relative mx-auto w-full max-w-[48rem]">${carousel}</div></div>`;
}
