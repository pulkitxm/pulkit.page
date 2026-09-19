import { reducedMotionQuery } from "@pulkit/shared/motion";
import { setupRepliesCarousel } from "../components/replies-carousel.ts";
import { forEachElement } from "../lib/dom.ts";

const reducedMotion = reducedMotionQuery();

forEachElement("[data-replies-carousel]", HTMLElement, (root) =>
  setupRepliesCarousel(root, reducedMotion),
);
