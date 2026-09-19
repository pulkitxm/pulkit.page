import { ref } from "../lib/dom.ts";
import { caption, stage } from "../lib/layout.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = stage(
    "gap-8 p-6",
    html`
    <div class="flex flex-wrap items-center justify-center gap-6">
      ${button({
        attrs:
          'style="transition-duration: 0.2s; transition-property: color, background-color, border-color; transition-timing-function: ease"',
        className:
          "border-2 border-blue-500 bg-transparent text-blue-600 hover:bg-blue-500 hover:text-white dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white",
        label: "Hover me",
        variant: "outline",
      })}
      ${button({
        attrs:
          'data-ref="multi" style="transition: 0.2s ease; transition-property: color, background-color"',
        className:
          "rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300",
        label: "Multiple properties",
      })}
    </div>
    ${caption("Same duration and easing for multiple properties: use shorthand plus transition-property for consistency.")}
  `,
  );
  const multi = ref(root, "multi", HTMLButtonElement);
  multi.addEventListener("mouseenter", () => {
    multi.style.backgroundColor = "rgb(34 197 94)";
    multi.style.color = "white";
  });
  multi.addEventListener("mouseleave", () => {
    multi.style.backgroundColor = "";
    multi.style.color = "";
  });
};
