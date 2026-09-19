import { button } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = `<div class="flex size-full items-center justify-center p-6">${button({
    className:
      "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300",
    label: "Press me",
    attrs: 'style="transition: transform 150ms ease-out"',
  })}</div>`;
};
