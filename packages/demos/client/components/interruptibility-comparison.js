import { animate } from "motion";
import { button, html, refs } from "../runtime/ui.ts";

const BALL_SIZE = 32;
const springTransition = { damping: 20, stiffness: 200, type: "spring" };

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-4">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Click rapidly in each box and compare how they handle interruptions</p>
    <div class="flex flex-wrap items-center justify-center gap-6">
      <div class="flex flex-col items-center gap-2">
        ${button({
          variant: "outline",
          className:
            "relative h-32 w-48 cursor-pointer rounded-lg border-2 border-red-300 border-dashed bg-red-50 dark:border-red-800 dark:bg-red-950/30",
          label: `<div data-ref="cssBall" class="absolute rounded-full bg-red-500" style="height: ${BALL_SIZE}px; left: 80px; top: 48px; transition: left 400ms ease-out, top 400ms ease-out; width: ${BALL_SIZE}px"></div>`,
          attrs: 'data-ref="cssBox"',
        })}
        <span class="text-neutral-600 dark:text-neutral-400 text-xs">CSS Transition</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        ${button({
          variant: "outline",
          className:
            "relative h-32 w-48 cursor-pointer rounded-lg border-2 border-green-300 border-dashed bg-green-50 dark:border-green-800 dark:bg-green-950/30",
          label: `<div data-ref="springBall" class="absolute rounded-full bg-green-500" style="height: ${BALL_SIZE}px; left: 0px; top: 0px; width: ${BALL_SIZE}px"></div>`,
          attrs: 'data-ref="springBox"',
        })}
        <span class="text-neutral-600 dark:text-neutral-400 text-xs">Spring Animation</span>
      </div>
    </div>
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">CSS transitions restart from scratch when interrupted. Spring animations preserve velocity and curve naturally to the new target.</p>
  </div>`;
  const { cssBox, cssBall, springBox, springBall } = refs(root);
  const springControls = [];

  animate(springBall, { x: 80, y: 48 }, { duration: 0 });

  function position(box, event) {
    const rect = box.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - BALL_SIZE / 2,
      y: event.clientY - rect.top - BALL_SIZE / 2,
    };
  }

  cssBox.addEventListener("click", (event) => {
    const { x, y } = position(cssBox, event);
    cssBall.style.left = `${x}px`;
    cssBall.style.top = `${y}px`;
  });

  springBox.addEventListener("click", (event) => {
    const { x, y } = position(springBox, event);
    springControls.push(animate(springBall, { x, y }, springTransition));
  });

  return {
    destroy() {
      for (const control of springControls) {
        control.stop();
      }
    },
  };
}
