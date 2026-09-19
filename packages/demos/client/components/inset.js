import { createSlider } from "../runtime/slider.ts";
import { html, refs } from "../runtime/ui.ts";

const sides = ["top", "right", "bottom", "left"];

export function mount(root) {
  const values = { bottom: 0, left: 0, right: 0, top: 0 };
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-5 p-6">
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
  </div>`;
  const elements = refs(root);

  function render() {
    const clipPath = `inset(${values.top}% ${values.right}% ${values.bottom}% ${values.left}%)`;
    elements.shape.style.clipPath = clipPath;
    elements.code.textContent = `clip-path: ${clipPath}`;
    for (const side of sides) {
      elements[`${side}Label`].textContent = `${side} ${values[side]}%`;
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
    root.querySelector(`[data-side="${side}"]`).append(slider.element);
  }
  render();
}
