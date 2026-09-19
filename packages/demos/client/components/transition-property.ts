import { queryAll } from "../lib/dom.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const boxClass =
  "flex h-20 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800";
const boxLabel = '<span class="text-neutral-600 text-xs dark:text-neutral-300">Hover</span>';

const columns = [
  {
    caption: "Background and transform both transition",
    style: "transform: scale(1); transition: all 0.3s ease",
    title: "transition: all",
  },
  {
    caption: "Only transform transitions; background snaps",
    style: "transform: scale(1); transition: transform 0.3s ease; transition-property: transform",
    title: "Explicit properties",
  },
];

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-8 p-6">
    <div class="flex flex-col gap-8 sm:flex-row sm:gap-16">
      ${columns.map(
        (column) => `<div class="flex flex-col items-center gap-4">
        <p class="font-medium text-neutral-700 text-sm dark:text-neutral-300">${column.title}</p>
        ${button({ attrs: `data-box style="${column.style}"`, className: boxClass, label: boxLabel, variant: "outline" })}
        <span class="max-w-30 text-center text-neutral-500 text-xs dark:text-neutral-400">${column.caption}</span>
      </div>`,
      )}
    </div>
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">With explicit properties you avoid transitioning values you did not intend to animate.</p>
  </div>`;
  for (const box of queryAll(root, "[data-box]", HTMLButtonElement)) {
    box.addEventListener("mouseenter", () => {
      box.style.backgroundColor = "rgb(34 197 94)";
      box.style.transform = "scale(1.1)";
    });
    box.addEventListener("mouseleave", () => {
      box.style.backgroundColor = "";
      box.style.transform = "scale(1)";
    });
  }
};
