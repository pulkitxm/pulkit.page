import { elements } from "../lib/env.ts";
import { onScroll, scrollToTop } from "../lib/scroll.ts";

const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function startChrome(): void {
  const clocks = elements("[data-clock]", HTMLTimeElement);
  const tick = () => {
    const now = new Date();
    for (const clock of clocks) {
      clock.textContent = `${time.format(now)} IST`;
      clock.dateTime = now.toISOString();
    }
  };
  tick();
  setInterval(tick, 15000);
  for (const link of elements("[data-to-top]", HTMLAnchorElement)) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToTop();
    });
  }
  const [progress] = elements("[data-progress]", HTMLElement);
  if (progress) {
    onScroll(({ progress: amount }) => {
      progress.style.transform = `scaleX(${amount})`;
    });
  }
}
