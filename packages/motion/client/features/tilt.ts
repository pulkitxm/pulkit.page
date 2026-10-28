import { elements, finePointer, reducedMotion } from "../lib/env.ts";

export function startTilt(selector: string): void {
  if (!finePointer() || reducedMotion()) {
    return;
  }
  for (const card of elements(selector, HTMLElement)) {
    card.dataset.tilt = "";
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      card.dataset.tilting = "";
      card.style.setProperty("--glare-x", `${x * 100}%`);
      card.style.setProperty("--glare-y", `${y * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateZ(0)`;
    });
    card.addEventListener("pointerleave", () => {
      delete card.dataset.tilting;
      card.style.transform = "";
    });
  }
}
