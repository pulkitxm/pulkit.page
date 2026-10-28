import { elements, reducedMotion } from "../lib/env.ts";
import { onVisible } from "../lib/observe.ts";
import { scrollState } from "../lib/scroll.ts";
import { onTick } from "../lib/ticker.ts";

export function startMarquee(): void {
  if (reducedMotion()) {
    return;
  }
  for (const marquee of elements("[data-marquee]", HTMLElement)) {
    const track = marquee.querySelector<HTMLElement>("[data-marquee-track]");
    if (!track) {
      continue;
    }
    let visible = false;
    let offset = 0;
    let skew = 0;
    let direction = 1;
    onVisible(marquee, (state) => {
      visible = state;
    });
    onTick((_, delta) => {
      if (!visible) {
        return;
      }
      const { velocity } = scrollState();
      if (velocity !== 0) {
        direction = Math.sign(velocity);
      }
      const speed = 0.06 + Math.min(2.4, Math.abs(velocity) * 0.035);
      const half = track.scrollWidth / 2;
      offset = (offset - speed * delta * direction) % half;
      if (offset > 0) {
        offset -= half;
      }
      skew += (Math.max(-12, Math.min(12, velocity * 0.6)) - skew) * 0.12;
      track.style.transform = `translate3d(${offset}px, 0, 0) skewX(${-skew}deg)`;
    });
  }
}
