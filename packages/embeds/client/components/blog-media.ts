import EmblaCarousel from "embla-carousel";
import { findElement, findElements } from "../lib/dom.ts";
import { onArrowKey } from "../lib/events.ts";

export function setupMediaCarousel(root: HTMLElement): void {
  const viewport = findElement(root, "[data-carousel-viewport]", HTMLElement);
  if (!viewport) {
    return;
  }
  const embla = EmblaCarousel(viewport, { align: "start", loop: true });
  const dots = findElements(root, "[data-carousel-dot]", HTMLElement);
  const update = (): void => {
    const selected = embla.selectedScrollSnap();
    dots.forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === selected));
    });
  };
  embla.on("select", update);
  embla.on("reInit", update);
  findElement(root, "[data-carousel-previous]", HTMLElement)?.addEventListener("click", () =>
    embla.scrollPrev(),
  );
  findElement(root, "[data-carousel-next]", HTMLElement)?.addEventListener("click", () =>
    embla.scrollNext(),
  );
  for (const dot of dots) {
    dot.addEventListener("click", () => embla.scrollTo(Number(dot.dataset.carouselDot)));
  }
  onArrowKey(
    root,
    (direction) => {
      if (direction < 0) {
        embla.scrollPrev();
      } else {
        embla.scrollNext();
      }
    },
    true,
  );
  update();
}
