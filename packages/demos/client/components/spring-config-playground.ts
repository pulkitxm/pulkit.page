import { attachSpring, motionValue } from "motion";
import { ref } from "../lib/dom.ts";
import { rangeField } from "../lib/layout.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

type SpringKey = keyof SpringConfig;

const springKeys: readonly SpringKey[] = ["stiffness", "damping", "mass"];

function isSpringKey(value: string | undefined): value is SpringKey {
  return springKeys.some((key) => key === value);
}

let instance = 0;

export const mount: DemoMount = (root) => {
  instance += 1;
  const id = `spring-config-${instance}`;
  const config: SpringConfig = { stiffness: 300, damping: 20, mass: 1 };
  const scheduler = createScheduler();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
    <div class="w-full max-w-sm space-y-4">
      ${rangeField({ id: `${id}-stiffness`, label: "Stiffness", key: "stiffness", value: 300, min: 50, max: 1000, step: 10 })}
      ${rangeField({ id: `${id}-damping`, label: "Damping", key: "damping", value: 20, min: 1, max: 100, step: 1 })}
      ${rangeField({ id: `${id}-mass`, label: "Mass", key: "mass", value: 1, min: 0.1, max: 5, step: 0.1 })}
    </div>
    <div class="relative h-16 w-full max-w-sm rounded-lg bg-neutral-100 dark:bg-neutral-800">
      <div data-ref="box" class="absolute top-1/2 left-4 h-10 w-10 -translate-y-1/2 rounded-lg bg-orange-500 shadow-lg"></div>
    </div>
    <div class="flex gap-2">
      ${button({ className: "w-24", label: "Animate", attrs: 'data-ref="animateButton"' })}
      ${button({ variant: "outline", className: "w-24", label: "Reset", attrs: 'data-ref="resetButton"' })}
    </div>
    <div class="rounded-md bg-neutral-100 p-3 font-mono text-xs dark:bg-neutral-800">
      <span class="text-neutral-600 dark:text-neutral-300">transition:</span>
      <span data-ref="code" class="text-orange-600 dark:text-orange-400"></span>
    </div>
  </div>`;
  const box = ref(root, "box", HTMLDivElement);
  const animateButton = ref(root, "animateButton", HTMLButtonElement);
  const resetButton = ref(root, "resetButton", HTMLButtonElement);
  const code = ref(root, "code", HTMLSpanElement);

  const x = motionValue(0);
  const springX = motionValue(0);
  let detach = attachSpring(springX, x, { ...config });
  springX.on("change", (value) => {
    box.style.transform = value === 0 ? "none" : `translateX(${value}px)`;
  });
  scheduler.add(() => {
    detach();
    springX.destroy();
    x.destroy();
  });

  function setAnimating(value: boolean) {
    animateButton.disabled = value;
  }

  function render() {
    code.textContent = `{ type: "spring", stiffness: ${config.stiffness}, damping: ${config.damping}, mass: ${config.mass} }`;
  }

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const key = target.dataset.key;
    if (!isSpringKey(key)) {
      return;
    }
    config[key] = Number(target.value);
    ref(root, `${key}Value`, HTMLSpanElement).textContent = String(config[key]);
    detach();
    detach = attachSpring(springX, x, { ...config });
    render();
  });

  animateButton.addEventListener("click", () => {
    setAnimating(true);
    x.set(0);
    scheduler.later(() => {
      x.set(200);
      scheduler.later(() => setAnimating(false), 2000);
    }, 50);
  });

  resetButton.addEventListener("click", () => {
    x.set(0);
    setAnimating(false);
  });

  render();

  return { destroy: scheduler.dispose };
};
