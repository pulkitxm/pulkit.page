import { animate, type Transition } from "motion";
import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const BALL_SIZE = 48;
const transition: Transition = { damping: 20, mass: 1, stiffness: 200, type: "spring" };

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
    <button
      type="button"
      data-ref="container"
      class="${buttonClass({
        variant: "outline",
        className:
          "relative h-64 w-full max-w-md cursor-pointer rounded-lg border-2 border-neutral-300 border-dashed bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900",
      })}"
    >
      <div
        data-ref="ball"
        class="absolute rounded-full bg-orange-500 shadow-lg"
        style="height: ${BALL_SIZE}px; left: 0px; top: 0px; width: ${BALL_SIZE}px"
      ></div>
      <span class="absolute bottom-3 left-1/2 -translate-x-1/2 text-neutral-500 dark:text-neutral-400 text-xs">Click anywhere to move</span>
    </button>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-300">Click rapidly. The ball preserves its velocity when redirected, no abrupt stops or restarts.</p>
  </div>`;
  const container = ref(root, "container", HTMLButtonElement);
  const ball = ref(root, "ball", HTMLDivElement);

  let moved = false;
  const center = () => {
    if (moved || container.offsetWidth === 0) {
      return;
    }
    animate(
      ball,
      {
        x: container.clientWidth / 2 - BALL_SIZE / 2,
        y: container.clientHeight / 2 - BALL_SIZE / 2,
      },
      { duration: 0 },
    );
  };
  const observer = new ResizeObserver(center);
  observer.observe(container);
  scheduler.add(() => observer.disconnect());
  center();

  container.addEventListener("click", (event) => {
    moved = true;
    const rect = container.getBoundingClientRect();
    animate(
      ball,
      {
        x: event.clientX - rect.left - BALL_SIZE / 2,
        y: event.clientY - rect.top - BALL_SIZE / 2,
      },
      transition,
    );
  });

  return { destroy: scheduler.dispose };
};
