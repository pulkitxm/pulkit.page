import { setupMediaCarousel } from "../components/blog-media.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-carousel]", HTMLElement, setupMediaCarousel);
