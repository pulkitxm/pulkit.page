import { findElement, requireElement } from "../lib/dom.ts";

export function setupImageCarousel(carousel: HTMLElement): void {
  const track = findElement(carousel, "[data-carousel-track]", HTMLElement);
  if (!track) {
    return;
  }
  const previous = requireElement(carousel, "[data-carousel-previous]", HTMLButtonElement);
  const next = requireElement(carousel, "[data-carousel-next]", HTMLButtonElement);
  const status = requireElement(carousel, "[data-carousel-status]", HTMLElement);
  const total = track.children.length;
  const current = (): number => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
  const show = (index: number): void => {
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };
  const update = (): void => {
    const index = current();
    status.textContent = `${index + 1} / ${total}`;
    previous.disabled = index === 0;
    next.disabled = index === total - 1;
  };
  previous.addEventListener("click", () => show(Math.max(current() - 1, 0)));
  next.addEventListener("click", () => show(Math.min(current() + 1, total - 1)));
  track.addEventListener("scroll", update, { passive: true });
  update();
}
