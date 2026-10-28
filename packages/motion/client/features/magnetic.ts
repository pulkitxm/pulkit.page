import { elements, finePointer, reducedMotion } from "../lib/env.ts";

export function startMagnetic(scope: ParentNode = document): void {
  if (!finePointer() || reducedMotion()) {
    return;
  }
  for (const element of elements("[data-magnetic]", HTMLElement, scope)) {
    const strength = Number(element.dataset.strength ?? 0.32);
    element.addEventListener("pointermove", (event) => {
      const box = element.getBoundingClientRect();
      const x = (event.clientX - (box.left + box.width / 2)) * strength;
      const y = (event.clientY - (box.top + box.height / 2)) * strength;
      element.dataset.attracted = "";
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
    element.addEventListener("pointerleave", () => {
      delete element.dataset.attracted;
      element.style.transform = "";
    });
  }
}
