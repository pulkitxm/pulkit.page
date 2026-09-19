import { query, ref } from "../lib/dom.ts";
import { stage } from "../lib/layout.ts";
import { createSlider } from "../runtime/slider.ts";
import { html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const sides = ["top", "right", "bottom", "left"] as const;

type Side = (typeof sides)[number];

export const mount: DemoMount = (root) => {
  const values: Record<Side, number> = { bottom: 0, left: 0, right: 0, top: 0 };
  root.innerHTML = stage(
    "gap-5 p-6",
    html`
    <div
      class="relative h-44 w-full max-w-xs rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950"
      aria-hidden="true"
    >
      <div data-ref="shape" class="absolute inset-3 rounded-lg bg-linear-to-br from-sky-500 to-indigo-600 shadow-inner"></div>
    </div>
    <div class="grid w-full max-w-xs gap-3">
      ${sides.map(
        (side) => `<div data-side="${side}" class="flex flex-col gap-1.5">
        <span data-ref="${side}Label" class="font-medium text-neutral-700 text-xs dark:text-neutral-300"></span>
      </div>`,
      )}
    </div>
    <code data-ref="code" class="max-w-full truncate rounded-md bg-neutral-100 px-2 py-1 text-neutral-800 text-xs dark:bg-neutral-800 dark:text-neutral-200"></code>
  `,
  );
  const shape = ref(root, "shape", HTMLDivElement);
  const code = ref(root, "code", HTMLElement);
  const labels = sides.map((side) => ({ side, label: ref(root, `${side}Label`, HTMLSpanElement) }));

  function render() {
    const clipPath = `inset(${values.top}% ${values.right}% ${values.bottom}% ${values.left}%)`;
    shape.style.clipPath = clipPath;
    code.textContent = `clip-path: ${clipPath}`;
    for (const { side, label } of labels) {
      label.textContent = `${side} ${values[side]}%`;
    }
  }

  for (const side of sides) {
    const slider = createSlider({
      max: 45,
      onValueChange: (value) => {
        values[side] = value;
        render();
      },
      step: 1,
      value: 0,
    });
    query(root, `[data-side="${side}"]`, HTMLDivElement).append(slider.element);
  }
  render();
};
