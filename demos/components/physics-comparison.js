import { animate } from "motion";
import { button, buttonClass, html, refs } from "../runtime/ui.js";

export function mount(root) {
  let isAnimated = false;
  let interval = null;
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
  const { play, loop, linear, easeOut, spring } = refs(root);
  let springControls = null;

  function setAnimated(next) {
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

  function stopLoop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  play.addEventListener("click", () => setAnimated(!isAnimated));
  loop.addEventListener("click", () => {
    if (interval) {
      stopLoop();
    } else {
      interval = setInterval(() => setAnimated(!isAnimated), 600);
    }
    const isLooping = interval !== null;
    loop.className = buttonClass({ variant: isLooping ? "default" : "outline", className: "w-24" });
    loop.textContent = isLooping ? "Stop" : "Loop";
  });

  return {
    destroy() {
      stopLoop();
      springControls?.stop();
    },
  };
}
