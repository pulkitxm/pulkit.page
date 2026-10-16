import { findElement } from "../lib/dom.ts";

const duration = 1200;
const burst = 6;

function celebrate(anchor: HTMLElement): void {
  if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  for (let index = 0; index < burst; index += 1) {
    const angle = (index / burst) * Math.PI * 2;
    const spark = document.createElement("span");
    spark.className =
      "pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full bg-[#facc15]";
    anchor.append(spark);
    spark
      .animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * 14}px), calc(-50% + ${Math.sin(angle) * 14}px)) scale(0)`,
            opacity: 0,
          },
        ],
        { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      )
      .finished.then(() => spark.remove());
  }
}

export function setupGithubStars(link: HTMLElement): void {
  const total = Number(link.dataset.stars ?? 0);
  const count = findElement(link, "[data-stars-count]", HTMLElement);
  const star = findElement(link, "[data-stars-burst]", HTMLElement);
  if (!(count && star && total > 0)) {
    return;
  }
  const icon = star.querySelector("svg");
  icon?.classList.add("opacity-40");
  count.textContent = "0";
  let started = 0;
  const step = (now: number): void => {
    started ||= now;
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    count.textContent = String(Math.round(total * eased));
    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    icon?.classList.remove("opacity-40");
    celebrate(star);
  };
  requestAnimationFrame(step);
}
