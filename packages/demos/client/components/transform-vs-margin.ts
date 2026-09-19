import { ref } from "../lib/dom.ts";
import { createSwapButton } from "../runtime/swap-button.ts";
import { html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-8 p-6">
    <div class="flex flex-col gap-8 sm:flex-row sm:gap-16">
      <div data-ref="marginColumn" class="flex flex-col items-center gap-4">
        <p class="font-medium text-neutral-700 text-sm dark:text-neutral-300">Using margin-left</p>
        <div class="flex h-32 w-48 flex-wrap gap-2 rounded-lg border border-neutral-300 bg-neutral-100 p-3 dark:border-neutral-700 dark:bg-neutral-900">
          <div data-ref="marginBox" class="flex h-10 w-16 items-center justify-center rounded bg-red-500 text-white text-xs transition-transform duration-300" style="margin-left: 0px">Box</div>
          <div class="flex h-10 w-16 items-center justify-center rounded bg-blue-500 text-white text-xs">Box 2</div>
        </div>
      </div>
      <div data-ref="transformColumn" class="flex flex-col items-center gap-4">
        <p class="font-medium text-neutral-700 text-sm dark:text-neutral-300">Using transform</p>
        <div class="flex h-32 w-48 flex-wrap gap-2 rounded-lg border border-neutral-300 bg-neutral-100 p-3 dark:border-neutral-700 dark:bg-neutral-900">
          <div data-ref="transformBox" class="flex h-10 w-16 items-center justify-center rounded bg-emerald-500 text-white text-xs transition-transform duration-300" style="transform: translateX(0)">Box</div>
          <div class="flex h-10 w-16 items-center justify-center rounded bg-blue-500 text-white text-xs">Box 2</div>
        </div>
      </div>
    </div>
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">Margin affects layout and pushes sibling elements. Transform only changes visual position.</p>
  </div>`;
  const marginBox = ref(root, "marginBox", HTMLDivElement);
  const transformBox = ref(root, "transformBox", HTMLDivElement);

  const marginButton = createSwapButton({
    variant: "outline",
    size: "sm",
    label1: "Move with margin",
    label2: "Reset",
    onClick: () => {
      marginButton.swapped = !marginButton.swapped;
      marginBox.style.marginLeft = marginButton.swapped ? "80px" : "0px";
    },
  });
  const transformButton = createSwapButton({
    variant: "outline",
    size: "sm",
    label1: "Move with transform",
    label2: "Reset",
    onClick: () => {
      transformButton.swapped = !transformButton.swapped;
      transformBox.style.transform = transformButton.swapped ? "translateX(112%)" : "translateX(0)";
    },
  });
  ref(root, "marginColumn", HTMLDivElement).append(marginButton.element);
  ref(root, "transformColumn", HTMLDivElement).append(transformButton.element);
};
