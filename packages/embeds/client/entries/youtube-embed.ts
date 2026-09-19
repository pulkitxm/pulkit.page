import { setupYoutubeEmbed } from "../components/youtube-embed.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-youtube-embed]", HTMLElement, setupYoutubeEmbed);
