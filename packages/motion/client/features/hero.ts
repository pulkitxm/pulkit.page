import { clamp, elements, finePointer, reducedMotion } from "../lib/env.ts";
import { onScroll } from "../lib/scroll.ts";
import { splitText } from "../lib/split.ts";
import { onTick } from "../lib/ticker.ts";

export function startHero(): void {
  const [title] = elements("[data-hero-title]", HTMLElement);
  const [hero] = elements("[data-hero]", HTMLElement);
  if (!(title && hero) || reducedMotion()) {
    return;
  }
  const characters = splitText(title, "chars", false);
  onScroll(({ y }) => {
    const amount = clamp(y / globalThis.innerHeight, 0, 1);
    title.style.transform = `translate3d(0, ${amount * 22}vh, 0) scale(${1 - amount * 0.08})`;
    title.style.opacity = String(1 - amount * 0.85);
    hero.style.setProperty("--hero-progress", amount.toFixed(4));
  });
  if (!finePointer()) {
    return;
  }
  const pointer = { x: -9999, y: -9999 };
  const state = characters.map(() => ({ lift: 0, stretch: 0 }));
  hero.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  hero.addEventListener("pointerleave", () => {
    pointer.x = -9999;
    pointer.y = -9999;
  });
  let boxes: DOMRect[] = [];
  let measuredAt = 0;
  onTick((time) => {
    if (time - measuredAt > 500) {
      boxes = characters.map((character) => character.getBoundingClientRect());
      measuredAt = time;
    }
    characters.forEach((character, index) => {
      const box = boxes[index];
      const current = state[index];
      if (!(box && current)) {
        return;
      }
      const distance = Math.hypot(
        pointer.x - (box.left + box.width / 2),
        pointer.y - (box.top + box.height / 2),
      );
      const influence = clamp(1 - distance / 420, 0, 1) ** 2;
      current.lift += (influence * 46 - current.lift) * 0.12;
      current.stretch += (influence * 0.14 - current.stretch) * 0.12;
      character.style.setProperty("--lift", current.lift.toFixed(2));
      character.style.setProperty("--stretch", current.stretch.toFixed(3));
    });
  });
}
