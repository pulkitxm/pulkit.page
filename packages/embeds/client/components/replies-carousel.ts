import { findElement } from "../lib/dom.ts";

const cycleDuration = 45000;

export function setupRepliesCarousel(root: HTMLElement, reducedMotion: MediaQueryList): void {
  const track = findElement(root, "[data-replies-track]", HTMLElement);
  if (!track) {
    return;
  }
  let animation: Animation | undefined;
  const start = (): void => {
    animation?.cancel();
    animation = undefined;
    if (reducedMotion.matches) {
      return;
    }
    animation = track.animate([{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }], {
      duration: cycleDuration,
      easing: "linear",
      iterations: Number.POSITIVE_INFINITY,
    });
  };
  root.addEventListener("mouseenter", () => animation?.pause());
  root.addEventListener("mouseleave", () => animation?.play());
  reducedMotion.addEventListener("change", start);
  start();
}
