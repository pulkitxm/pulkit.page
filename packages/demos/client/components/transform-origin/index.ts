import { ChevronDown } from "lucide";
import { type Cancel, ref } from "../../lib/dom.ts";
import { createScheduler } from "../../lib/scheduler.ts";
import { createSlider } from "../../runtime/slider.ts";
import { html, icon } from "../../runtime/ui.ts";
import type { DemoMount } from "../../types.ts";
import { createSelect, presenceStyles, type SelectOption, triggerClass } from "./select.ts";

interface DotPosition {
  left: string;
  top: string;
}

const origins: readonly SelectOption[] = [
  { label: "Center", value: "center" },
  { label: "Top Left", value: "top left" },
  { label: "Top Right", value: "top right" },
  { label: "Bottom Left", value: "bottom left" },
  { label: "Bottom Right", value: "bottom right" },
];

const dotPositions: Readonly<Record<string, DotPosition>> = {
  "top left": { left: "0%", top: "0%" },
  "top right": { left: "100%", top: "0%" },
  "bottom left": { left: "0%", top: "100%" },
  "bottom right": { left: "100%", top: "100%" },
};

const centerDot: DotPosition = { left: "50%", top: "50%" };

export const mount: DemoMount = (root) => {
  let selectedOrigin = "center";
  let rotatePerc = 0;
  let animate = false;
  const scheduler = createScheduler();
  let cleanupSelect: Cancel = () => {};
  let renderCurrent = () => {};

  function build() {
    cleanupSelect();
    root.innerHTML = html`<style>${presenceStyles}</style><div class="flex size-full flex-col items-center justify-center gap-6 p-6">
      <div class="relative flex h-48 w-48 items-center justify-center">
        <div class="absolute inset-0 rounded-lg border-2 border-neutral-300 border-dashed dark:border-neutral-700"></div>
        <div data-ref="box" class="relative flex size-24 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 font-medium text-sm text-white shadow-lg transition-transform duration-500 ease-out">
          <span data-ref="dot" class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 shadow-md ring-2 ring-white"></span>
        </div>
      </div>
      <div class="flex w-full max-w-md flex-row items-center gap-3">
        <div data-ref="selectColumn" class="flex min-w-0 flex-1 flex-col gap-1.5">
          <label class="text-neutral-600 text-xs dark:text-neutral-400" for="transform-origin-select">Transform origin</label>
          <button type="button" role="combobox" aria-autocomplete="none" aria-expanded="false" dir="ltr" data-state="closed" data-slot="select-trigger" data-size="default" id="transform-origin-select" data-ref="trigger" class="${triggerClass}"><span data-slot="select-value" data-ref="valueText" style="pointer-events: none;"></span>${icon(ChevronDown, "size-4 opacity-50")}</button>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <label data-ref="rotationLabel" class="text-neutral-600 text-xs dark:text-neutral-400" for="rotation-slider"></label>
          <div data-ref="sliderSlot" class="flex h-9 items-center"></div>
        </div>
      </div>
      <p class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">The yellow dot shows the origin point. Notice how the rotation pivots around it.</p>
    </div>`;
    const box = ref(root, "box", HTMLDivElement);
    const dot = ref(root, "dot", HTMLSpanElement);
    const valueText = ref(root, "valueText", HTMLSpanElement);
    const rotationLabel = ref(root, "rotationLabel", HTMLLabelElement);
    const slider = createSlider({
      min: 0,
      max: 100,
      step: 1,
      value: rotatePerc,
      onValueChange: (next) => {
        rotatePerc = next;
        render();
      },
    });
    slider.element.id = "rotation-slider";
    ref(root, "sliderSlot", HTMLDivElement).append(slider.element);
    cleanupSelect = createSelect({
      trigger: ref(root, "trigger", HTMLButtonElement),
      options: origins,
      value: selectedOrigin,
      scheduler,
      onValueChange: (value) => {
        selectedOrigin = value;
        animate = false;
        render();
        scheduler.later(() => {
          animate = true;
          render();
        }, 100);
      },
    });

    function render() {
      const origin = origins.find((entry) => entry.value === selectedOrigin);
      const position = dotPositions[selectedOrigin] ?? centerDot;
      const rotateDeg = rotatePerc * (360 / 100);
      box.style.transform = animate ? `rotate(${rotateDeg}deg)` : "rotate(0deg)";
      box.style.transformOrigin = selectedOrigin;
      dot.style.left = position.left;
      dot.style.top = position.top;
      valueText.textContent = origin?.label ?? "";
      rotationLabel.textContent = `Rotation: ${rotatePerc}%`;
    }

    renderCurrent = render;
    render();
  }

  function animateSoon(delay: number) {
    scheduler.later(() => {
      animate = true;
      renderCurrent();
    }, delay);
  }

  scheduler.add(() => cleanupSelect());
  build();
  animateSoon(500);

  return {
    replay() {
      animate = false;
      build();
      animateSoon(100);
    },
    destroy: scheduler.dispose,
  };
};
