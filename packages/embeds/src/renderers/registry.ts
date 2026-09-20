import type { EmbedRenderer } from "../types.ts";
import { render as blogGallery } from "./blog-gallery.ts";
import { render as blogImage } from "./blog-image.ts";
import { render as cmdKey } from "./cmd-key.ts";
import { render as contactLinks } from "./contact-links.ts";
import { render as documentTabs } from "./document-tabs.ts";
import { render as documentViewer } from "./document-viewer.ts";
import { render as image } from "./image.ts";
import { render as imageGrid } from "./image-grid.ts";
import { render as imagePopup } from "./image-popup.ts";
import { render as infoTip } from "./info-tip.ts";
import { render as installTabs } from "./install-tabs.ts";
import { render as math } from "./math.ts";
import { render as repliesCarousel } from "./replies-carousel.ts";
import { render as techBadges } from "./tech-badges.ts";
import { render as tweet } from "./tweet.ts";
import { render as tweetEmbed } from "./tweet-embed.ts";
import { render as youtubeEmbed } from "./youtube-embed.ts";

export const renderers: ReadonlyMap<string, EmbedRenderer> = new Map([
  ["blog-gallery", blogGallery],
  ["blog-image", blogImage],
  ["cmd-key", cmdKey],
  ["contact-links", contactLinks],
  ["document-tabs", documentTabs],
  ["document-viewer", documentViewer],
  ["image", image],
  ["image-grid", imageGrid],
  ["image-popup", imagePopup],
  ["info-tip", infoTip],
  ["install-tabs", installTabs],
  ["math", math],
  ["replies-carousel", repliesCarousel],
  ["tech-badges", techBadges],
  ["tweet", tweet],
  ["tweet-embed", tweetEmbed],
  ["youtube-embed", youtubeEmbed],
]);
