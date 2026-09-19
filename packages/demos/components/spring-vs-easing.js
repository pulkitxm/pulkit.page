import { animate } from "motion";
import { html, refs } from "../runtime/ui.js";

const springTransition = { damping: 15, mass: 1, stiffness: 200, type: "spring" };
const easeTransition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";

export function mount(root) {
  let phase = "start";
  const timers = new Set();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-8 p-8">
    <div class="flex w-full max-w-md flex-col gap-6">
      <div class="flex items-center gap-4">
        <span class="w-24 font-medium text-neutral-600 text-sm dark:text-neutral-300">Ease-out</span>
        <div data-ref="track" class="relative h-12 flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <div
            data-ref="ease"
            class="absolute top-1/2 left-2 h-8 w-8 -translate-y-1/2 rounded-full bg-neutral-400 dark:bg-neutral-500"
          ></div>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span class="w-24 font-medium text-neutral-600 text-sm dark:text-neutral-300">Spring</span>
        <div class="relative h-12 flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <div
            data-ref="spring"
            class="absolute top-1/2 left-2 h-8 w-8 -translate-y-1/2 rounded-full bg-orange-500"
          ></div>
        </div>
      </div>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-300">The spring overshoots and settles naturally. The ease-out follows a fixed curve.</p>
  </div>`;
  const { track, ease, spring } = refs(root);
  animate(spring, { x: 0 }, { duration: 0 });

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function getMaxDistance() {
    const ballSize = 32;
    const padding = 8;
    return track.offsetWidth - ballSize - padding * 2;
  }

  function animateTo(target, nextPhase) {
    const maxDistance = getMaxDistance();
    if (maxDistance <= 0) {
      return;
    }
    const distance = target === "end" ? maxDistance : 0;
    ease.style.transition = easeTransition;
    ease.style.transform = target === "end" ? `translateX(${maxDistance}px)` : "translateX(0)";
    animate(spring, { x: distance }, springTransition);
    phase = nextPhase;
  }

  later(() => animateTo("end", "end"), 100);

  return {
    destroy() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    },
    replay() {
      if (phase === "end") {
        animateTo("start", "start");
        later(() => animateTo("end", "end"), 700);
      } else {
        animateTo("end", "end");
      }
    },
  };
}
