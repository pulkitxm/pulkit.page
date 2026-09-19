import { query, ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  let flipped = false;
  const scheduler = createScheduler();
  const replayFlip = scheduler.slot();

  function build() {
    root.innerHTML = `<div class="flex size-full items-center justify-center p-6">${button({
      variant: "ghost",
      size: "icon",
      className: "size-40 cursor-pointer border-0 bg-transparent p-0 hover:bg-transparent",
      label: `<div data-ref="inner" class="relative size-full" style="transform: rotateY(0deg); transform-style: preserve-3d; transition: transform 600ms ease-out"><div class="absolute inset-0 flex items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 font-bold text-white shadow-lg" style="backface-visibility: hidden">Front</div><div class="absolute inset-0 flex items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 font-bold text-white shadow-lg" style="backface-visibility: hidden; transform: rotateY(180deg)">Back</div></div>`,
      attrs: 'style="perspective: 1000px"',
    })}</div>`;
    const inner = ref(root, "inner", HTMLDivElement);
    const render = () => {
      inner.style.transform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
    };
    query(root, "button", HTMLButtonElement).addEventListener("click", () => {
      flipped = !flipped;
      render();
    });
    render();
    return render;
  }

  build();

  return {
    replay() {
      replayFlip.cancel();
      flipped = false;
      const render = build();
      replayFlip.later(() => {
        flipped = true;
        render();
      }, 100);
    },
    destroy: scheduler.dispose,
  };
};
