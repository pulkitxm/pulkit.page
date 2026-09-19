import { createSlider } from "../runtime/slider.ts";
import { button, html, refs } from "../runtime/ui.ts";

export function mount(root) {
  let skewX = 0;
  let skewY = 0;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
    <div class="relative flex h-32 w-48 items-center justify-center">
      <div class="absolute inset-0 rounded-lg border-2 border-neutral-300 border-dashed dark:border-neutral-700"></div>
      <div data-ref="box" class="flex h-16 w-32 items-center justify-center rounded-lg bg-linear-to-r from-amber-500 to-orange-500 font-medium text-sm text-white shadow-lg transition-transform duration-200">Skewed</div>
    </div>
    <div class="flex w-full max-w-xs flex-col gap-4">
      <div data-ref="xGroup" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-neutral-600 dark:text-neutral-400">skewX</span>
          <span data-ref="xValue" class="font-mono text-neutral-800 dark:text-neutral-200"></span>
        </div>
      </div>
      <div data-ref="yGroup" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-neutral-600 dark:text-neutral-400">skewY</span>
          <span data-ref="yValue" class="font-mono text-neutral-800 dark:text-neutral-200"></span>
        </div>
      </div>
    </div>
    ${button({ variant: "secondary", size: "sm", label: "Reset", attrs: 'data-ref="reset"' })}
  </div>`;
  const { box, xGroup, yGroup, xValue, yValue, reset } = refs(root);

  function render() {
    box.style.transform = `skew(${skewX}deg, ${skewY}deg)`;
    xValue.textContent = `${skewX}deg`;
    yValue.textContent = `${skewY}deg`;
    xSlider.value = skewX;
    ySlider.value = skewY;
  }

  const xSlider = createSlider({
    min: -45,
    max: 45,
    step: 5,
    value: skewX,
    className: "w-full",
    onValueChange: (next) => {
      skewX = next ?? 0;
      render();
    },
  });
  const ySlider = createSlider({
    min: -45,
    max: 45,
    step: 5,
    value: skewY,
    className: "w-full",
    onValueChange: (next) => {
      skewY = next ?? 0;
      render();
    },
  });
  xGroup.append(xSlider.element);
  yGroup.append(ySlider.element);
  reset.addEventListener("click", () => {
    skewX = 0;
    skewY = 0;
    render();
  });
  render();
}
