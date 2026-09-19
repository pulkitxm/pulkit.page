import { ref } from "../lib/dom.ts";
import { caption, stage } from "../lib/layout.ts";
import { button } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = stage(
    "gap-6 p-6",
    `${button({
      attrs: 'data-ref="card"',
      className:
        "relative h-40 w-64 cursor-pointer overflow-hidden rounded-xl border-neutral-200 bg-neutral-50 p-0 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-900",
      label: `<div class="flex h-full flex-col p-4">
        <span class="font-semibold text-neutral-800 dark:text-neutral-200">Project title</span>
        <div data-ref="reveal" class="mt-2 flex flex-1 flex-col justify-end" style="opacity: 0; transform: translateY(100%); transition: transform 0.25s ease, opacity 0.2s ease">
          <p class="text-wrap text-neutral-600 text-sm dark:text-neutral-300">Description revealed on hover using transform and opacity transitions.</p>
        </div>
      </div>`,
      variant: "outline",
    })}${caption(
      "Hover the card. The description slides up and fades in with transform and opacity only.",
      { width: "max-w-xs" },
    )}`,
  );
  const card = ref(root, "card", HTMLButtonElement);
  const reveal = ref(root, "reveal", HTMLDivElement);
  card.addEventListener("mouseenter", () => {
    reveal.style.opacity = "1";
    reveal.style.transform = "translateY(0)";
  });
  card.addEventListener("mouseleave", () => {
    reveal.style.opacity = "0";
    reveal.style.transform = "translateY(100%)";
  });
};
