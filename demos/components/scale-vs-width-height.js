import { Star } from "lucide";
import { createSwapButton } from "../runtime/swap-button.js";
import { button, html, icon, refs } from "../runtime/ui.js";

const baseW = 140;
const baseH = 44;
const grownW = 182;
const grownH = 57;

export function mount(root) {
  let scaled = false;
  const label = `${icon(Star, "size-4 shrink-0")}<span>Button</span>`;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-8 p-6">
    <div class="flex flex-col gap-8 sm:flex-row sm:gap-16">
      <div class="flex w-50 flex-col items-center gap-4">
        <p class="font-medium text-neutral-700 text-sm dark:text-neutral-300">Using width + height</p>
        <div data-ref="sized" class="flex h-16 w-50 items-center justify-center">
          ${button({
            className:
              "flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white transition-colors duration-300 hover:bg-amber-500",
            label,
          })}
        </div>
        <p class="text-neutral-500 text-xs dark:text-neutral-400">Both dimensions, still layout</p>
      </div>
      <div class="flex w-50 flex-col items-center gap-4">
        <p class="font-medium text-neutral-700 text-sm dark:text-neutral-300">Using scale</p>
        <div data-ref="scaledBox" class="flex h-16 w-50 items-center justify-center">
          ${button({
            className:
              "flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 font-medium text-white transition-transform duration-300 hover:bg-teal-500",
            label,
          })}
        </div>
        <p class="text-neutral-500 text-xs dark:text-neutral-400">Everything scales together</p>
      </div>
    </div>
    <div data-ref="slot" class="contents"></div>
  </div>`;
  const { sized, scaledBox, slot } = refs(root);
  const sizedButton = sized.firstElementChild;
  const scaleButton = scaledBox.firstElementChild;

  function render() {
    sizedButton.style.height = scaled ? `${grownH}px` : `${baseH}px`;
    sizedButton.style.width = scaled ? `${grownW}px` : `${baseW}px`;
    scaleButton.style.transform = scaled ? "scale(1.3)" : "scale(1)";
  }

  const swap = createSwapButton({
    variant: "outline",
    size: "sm",
    label1: "Grow",
    label2: "Reset",
    onClick: () => {
      scaled = !scaled;
      swap.swapped = scaled;
      render();
    },
  });
  slot.replaceWith(swap.element);
  render();
}
