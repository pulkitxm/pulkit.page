import { setupImageCarousel } from "../components/image-carousel.ts";
import { forEachElement } from "../lib/dom.ts";

forEachElement("[data-carousel]", HTMLElement, setupImageCarousel);
