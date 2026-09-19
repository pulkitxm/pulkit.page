import { animate } from "motion";
import { queryAll, ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const boxes = [
  { className: "size-8 rounded bg-blue-500", distance: 60, duration: 0.2, label: "Small: 200ms" },
  {
    className: "size-16 rounded bg-blue-500",
    distance: 80,
    duration: 0.35,
    label: "Medium: 350ms",
  },
  { className: "size-24 rounded bg-blue-500", distance: 100, duration: 0.5, label: "Large: 500ms" },
];

export const mount: DemoMount = (root) => {
  let animated = false;
  const scheduler = createScheduler();
  const pending = scheduler.slot();

  function build() {
    root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
      <button type="button" data-ref="toggle" class="${buttonClass()}">Animate</button>
      <div class="flex items-end gap-8">
        ${boxes.map(
          (box, index) => html`<div class="flex flex-col items-center gap-2">
            <div data-box="${index}" class="${box.className}"></div>
            <span class="text-neutral-600 text-xs dark:text-neutral-400">${box.label}</span>
          </div>`,
        )}
      </div>
      <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-400">Bigger elements carry more visual weight. They feel more natural with longer durations, like heavier objects in the physical world.</p>
    </div>`;
    ref(root, "toggle", HTMLButtonElement).addEventListener("click", () => setAnimated(!animated));
  }

  function setAnimated(value: boolean) {
    animated = value;
    ref(root, "toggle", HTMLButtonElement).textContent = animated ? "Reset" : "Animate";
    for (const element of queryAll(root, "[data-box]", HTMLDivElement)) {
      const box = boxes[Number(element.dataset.box)];
      if (box) {
        animate(
          element,
          { x: animated ? box.distance : 0 },
          { duration: box.duration, ease: [0.16, 1, 0.3, 1] },
        );
      }
    }
  }

  build();

  return {
    destroy: scheduler.dispose,
    replay() {
      pending.cancel();
      animated = false;
      build();
      pending.later(() => setAnimated(true), 100);
    },
  };
};
