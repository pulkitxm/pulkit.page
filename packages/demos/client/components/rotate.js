import { createSlider } from "../runtime/slider.ts";
import { button, html, refs } from "../runtime/ui.ts";

const presetClass =
  "rounded-md bg-neutral-200 px-3 py-1.5 text-neutral-800 text-xs transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600";
const presets = [0, 45, 90, 180];

export function mount(root) {
  let rotation = 0;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-8 p-6">
    <div class="relative flex h-40 w-40 items-center justify-center">
      <div class="absolute inset-0 rounded-lg border-2 border-neutral-300 border-dashed dark:border-neutral-700"></div>
      <div data-ref="box" class="flex size-20 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-purple-600 font-mono text-sm text-white shadow-lg transition-transform duration-200"></div>
    </div>
    <div data-ref="controls" class="flex w-full max-w-xs flex-col gap-3">
      <div class="flex items-center justify-between text-sm">
        <span class="text-neutral-600 dark:text-neutral-400">Rotation</span>
        <span data-ref="value" class="font-mono text-neutral-800 dark:text-neutral-200"></span>
      </div>
    </div>
    <div class="flex gap-2">
      ${presets.map((deg) => button({ className: presetClass, label: `${deg}°`, attrs: `data-preset="${deg}"` }))}
    </div>
  </div>`;
  const { box, controls, value } = refs(root);

  function render() {
    box.style.transform = `rotate(${rotation}deg)`;
    box.textContent = `${rotation}°`;
    value.textContent = `${rotation}deg`;
    slider.value = rotation;
  }

  const slider = createSlider({
    min: -180,
    max: 180,
    step: 5,
    value: rotation,
    className: "w-full",
    onValueChange: (next) => {
      rotation = next ?? 0;
      render();
    },
  });
  controls.append(slider.element);

  root.addEventListener("click", (event) => {
    const preset = event.target.closest("[data-preset]")?.dataset.preset;
    if (preset !== undefined) {
      rotation = Number(preset);
      render();
    }
  });
  render();
}
