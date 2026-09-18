import { render as blogGallery } from "./blog-gallery.mjs";
import { render as blogImage } from "./blog-image.mjs";
import { render as cmdKey } from "./cmd-key.mjs";
import { render as image } from "./image.mjs";
import { render as imageGrid } from "./image-grid.mjs";
import { render as imagePopup } from "./image-popup.mjs";
import { render as infoTip } from "./info-tip.mjs";
import { render as installTabs } from "./install-tabs.mjs";
import { render as math } from "./math.mjs";
import { render as repliesCarousel } from "./replies-carousel.mjs";
import { render as tweet } from "./tweet.mjs";
import { render as tweetEmbed } from "./tweet-embed.mjs";
import { render as youtubeEmbed } from "./youtube-embed.mjs";

export const components = {
  "blog-gallery": { render: blogGallery },
  "blog-image": { render: blogImage },
  "cmd-key": { render: cmdKey },
  image: { render: image },
  "image-grid": { render: imageGrid },
  "image-popup": { render: imagePopup },
  "info-tip": { render: infoTip },
  "install-tabs": { render: installTabs },
  math: { render: math },
  "replies-carousel": { render: repliesCarousel },
  tweet: { render: tweet },
  "tweet-embed": { render: tweetEmbed },
  "youtube-embed": { render: youtubeEmbed },
};
