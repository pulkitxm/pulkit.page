import { type AnimationPlaybackControls, animate } from "motion";
import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  let isAnimated = false;
  const scheduler = createScheduler();
  const looping = scheduler.slot();
  root.innerHTML = html`<div class="space-y-6">
    <div class="flex gap-2">
      ${button({ className: "w-24", label: "Animate", attrs: 'data-ref="play"' })}
      ${button({ variant: "outline", className: "w-24", label: "Loop", attrs: 'data-ref="loop"' })}
    </div>
    <div class="flex items-center gap-4">
      <span class="w-20 font-medium text-neutral-900 text-sm dark:text-neutral-100">Linear</span>
      <div data-ref="linear" class="h-12 w-12 rounded bg-neutral-400 dark:bg-neutral-500" style="transform: translateX(0px); transition: transform 500ms linear"></div>
    </div>
    <div class="flex items-center gap-4">
      <span class="w-20 font-medium text-neutral-900 text-sm dark:text-neutral-100">Ease-out</span>
      <div data-ref="easeOut" class="h-12 w-12 rounded bg-neutral-500 dark:bg-neutral-400" style="transform: translateX(0px); transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1)"></div>
    </div>
    <div class="flex items-center gap-4">
      <span class="w-20 font-medium text-neutral-900 text-sm dark:text-neutral-100">Spring</span>
      <div data-ref="spring" class="h-12 w-12 rounded bg-neutral-600 dark:bg-neutral-300"></div>
    </div>
  </div>`;
  const play = ref(root, "play", HTMLButtonElement);
  const loop = ref(root, "loop", HTMLButtonElement);
  const linear = ref(root, "linear", HTMLDivElement);
  const easeOut = ref(root, "easeOut", HTMLDivElement);
  const spring = ref(root, "spring", HTMLDivElement);
  let springControls: AnimationPlaybackControls | null = null;

  function setAnimated(next: boolean) {
    isAnimated = next;
    play.textContent = isAnimated ? "Reset" : "Animate";
    const transform = `translateX(${isAnimated ? 200 : 0}px)`;
    linear.style.transform = transform;
    easeOut.style.transform = transform;
    springControls = animate(
      spring,
      { x: isAnimated ? 200 : 0 },
      { damping: 20, stiffness: 300, type: "spring" },
    );
  }

  play.addEventListener("click", () => setAnimated(!isAnimated));
  loop.addEventListener("click", () => {
    if (looping.active) {
      looping.cancel();
    } else {
      looping.interval(() => setAnimated(!isAnimated), 600);
    }
    const isLooping = looping.active;
    loop.className = buttonClass({ variant: isLooping ? "default" : "outline", className: "w-24" });
    loop.textContent = isLooping ? "Stop" : "Loop";
  });
  scheduler.add(() => springControls?.stop());

  return { destroy: scheduler.dispose };
};
