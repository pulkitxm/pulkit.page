import { renderDemo } from "@pulkit/demos/render";
import { matchBlockEmbed, matchInlineEmbed, renderEmbed } from "@pulkit/embeds";
import { escapeHtml } from "@pulkit/shared/html";
import type { MarkedExtension } from "marked";
import { safeUrl } from "./html.ts";
import {
  collectionItems,
  type Listing,
  listDirective,
  listingLimit,
  renderListing,
} from "./listings.ts";
import {
  type RenderContext,
  sizeAttributes,
  tokenStore,
  zoomAttributes,
} from "./render-context.ts";

type EmbedMatch = NonNullable<ReturnType<typeof matchBlockEmbed>>;

interface Demo {
  name: string;
  variant: string | undefined;
  html: string;
}

interface CarouselImage {
  alt: string;
  href: string;
}

const carouselButton =
  "cursor-pointer rounded-md border border-line bg-transparent px-2.5 py-1.25 text-inherit [font:inherit] disabled:cursor-default disabled:opacity-40";

function carouselImages(src: string): { raw: string; images: CarouselImage[] } | undefined {
  if (!/^:::carousel\b/.test(src)) {
    return;
  }
  const match = /^:::carousel[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
  const content = match?.[1] ?? "";
  const images = match
    ? [...content.matchAll(/!\[([^\]\n]+)\]\(([^)\s]+)\)/g)].map(([, alt = "", href = ""]) => ({
        alt,
        href,
      }))
    : [];
  if (!match || images.length < 2 || content.replace(/!\[[^\]\n]+\]\([^)\s]+\)/g, "").trim()) {
    throw new Error("Invalid carousel directive; wrap two or more images in :::carousel and :::");
  }
  return { raw: match[0], images };
}

function renderCarousel(images: readonly CarouselImage[], context: RenderContext): string {
  context.assets.script("/assets/embeds/image-carousel.js");
  const slides = images
    .map(
      (image) =>
        `<a class="block w-full shrink-0 cursor-zoom-in snap-center" href="${safeUrl(image.href)}"${zoomAttributes(image.href, context.assets)}><img class="mx-auto block h-auto max-h-[70vh] w-full object-contain" src="${safeUrl(image.href)}" alt="${escapeHtml(image.alt)}"${sizeAttributes(image.href)} loading="lazy"></a>`,
    )
    .join("");
  return `<figure class="mx-0 my-7" data-carousel><section class="flex snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-roledescription="carousel" aria-label="${escapeHtml(`${images[0]?.alt} and ${images.length - 1} more`)}" data-carousel-track>${slides}</section><figcaption class="mt-3 flex items-center justify-center gap-4 text-xs text-muted"><button class="${carouselButton}" type="button" aria-label="Previous image" data-carousel-previous>Prev</button><span aria-live="polite" data-carousel-status>1 / ${images.length}</span><button class="${carouselButton}" type="button" aria-label="Next image" data-carousel-next>Next</button></figcaption></figure>`;
}

export function directiveExtension(context: RenderContext): MarkedExtension {
  const embeds = tokenStore<EmbedMatch>();
  const demos = tokenStore<Demo>();
  const carousels = tokenStore<CarouselImage[]>();
  const listings = tokenStore<Listing>();
  return {
    walkTokens: async (token) => {
      if (token.type === "demo") {
        const demo = demos.read(token);
        demo.html = await renderDemo(demo.name, demo.variant);
      }
    },
    extensions: [
      {
        name: "embed",
        level: "block",
        start: (src) => src.indexOf(":::embed"),
        tokenizer(src) {
          const match = matchBlockEmbed(src);
          return match ? embeds.create("embed", match.raw, match) : undefined;
        },
        renderer(token) {
          const { name, props } = embeds.read(token);
          return renderEmbed(name, props, context.assets, false);
        },
      },
      {
        name: "inlineEmbed",
        level: "inline",
        start: (src) => src.indexOf(":embed["),
        tokenizer(src) {
          const match = matchInlineEmbed(src);
          return match ? embeds.create("inlineEmbed", match.raw, match) : undefined;
        },
        renderer(token) {
          const { name, props } = embeds.read(token);
          return renderEmbed(name, props, context.assets, true);
        },
      },
      {
        name: "demo",
        level: "block",
        start: (src) => src.indexOf(":::demo"),
        tokenizer(src) {
          const match = /^:::demo ([a-z0-9-]+)(?: ([a-z0-9-]+))?\s*(?:\n|$)/.exec(src);
          return match
            ? demos.create("demo", match[0], { name: match[1] ?? "", variant: match[2], html: "" })
            : undefined;
        },
        renderer(token) {
          return demos.read(token).html;
        },
      },
      {
        name: "carousel",
        level: "block",
        start: (src) => src.indexOf(":::carousel"),
        tokenizer(src) {
          const carousel = carouselImages(src);
          return carousel ? carousels.create("carousel", carousel.raw, carousel.images) : undefined;
        },
        renderer(token) {
          return renderCarousel(carousels.read(token), context);
        },
      },
      {
        name: "listing",
        level: "block",
        start: (src) => src.indexOf(":::list"),
        tokenizer(src) {
          const match = listDirective.exec(src);
          if (!match && /^:::list\b/.test(src)) {
            throw new Error("Invalid list directive; use :::list collection limit=5 by-year");
          }
          return match
            ? listings.create("listing", match[0], {
                collection: match[1] ?? "",
                limit: listingLimit(match[2]),
                grouped: Boolean(match[3]),
              })
            : undefined;
        },
        renderer(token) {
          const listing = listings.read(token);
          const { pages, route, site } = context;
          return renderListing(
            collectionItems(pages, route, listing.collection, listing.limit, site),
            listing,
          );
        },
      },
    ],
  };
}
