import { animate } from "motion";
import { buttonClass, html, refs } from "../runtime/ui.js";

const BALL_SIZE = 48;
const transition = { damping: 20, mass: 1, stiffness: 200, type: "spring" };

function mountsBehindCodePanel(root) {
  const frame = JSON.parse(root.getRootNode().host?.dataset.frame ?? "{}");
  return (frame.focusCode ?? true) && window.innerWidth < 1024;
}

export function mount(root) {
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
      <span class="absolute bottom-3 left-1/2 -translate-x-1/2 text-neutral-400 text-xs">Click anywhere to move</span>
    </button>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-300">Click rapidly. The ball preserves its velocity when redirected, no abrupt stops or restarts.</p>
  </div>`;
  const { container, ball } = refs(root);

  const hidden = mountsBehindCodePanel(root);
  const width = hidden ? 0 : container.offsetWidth;
  const height = hidden ? 0 : container.offsetHeight;
  animate(ball, { x: width / 2 - BALL_SIZE / 2, y: height / 2 - BALL_SIZE / 2 }, { duration: 0 });

  container.addEventListener("click", (event) => {
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
}
