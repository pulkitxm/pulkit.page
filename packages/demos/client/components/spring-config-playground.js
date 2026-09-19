import { attachSpring, motionValue } from "motion";
import { rangeField } from "../lib/layout.ts";
import { button, html, refs } from "../runtime/ui.ts";

let instance = 0;

export function mount(root) {
  instance += 1;
  const id = `spring-config-${instance}`;
  const config = { stiffness: 300, damping: 20, mass: 1 };
  const timers = new Set();
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
  const elements = refs(root);
  const { box, animateButton, resetButton, code } = elements;

  const x = motionValue(0);
  const springX = motionValue(0);
  let detach = attachSpring(springX, x, { ...config });
  springX.on("change", (value) => {
    box.style.transform = value === 0 ? "none" : `translateX(${value}px)`;
  });

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function setAnimating(value) {
    animateButton.disabled = value;
  }

  function render() {
    code.textContent = `{ type: "spring", stiffness: ${config.stiffness}, damping: ${config.damping}, mass: ${config.mass} }`;
  }

  root.addEventListener("input", (event) => {
    const key = event.target.dataset.key;
    if (!key) {
      return;
    }
    config[key] = Number(event.target.value);
    elements[`${key}Value`].textContent = config[key];
    detach();
    detach = attachSpring(springX, x, { ...config });
    render();
  });

  animateButton.addEventListener("click", () => {
    setAnimating(true);
    x.set(0);
    later(() => {
      x.set(200);
      later(() => setAnimating(false), 2000);
    }, 50);
  });

  resetButton.addEventListener("click", () => {
    x.set(0);
    setAnimating(false);
  });

  render();

  return {
    destroy() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      detach();
      springX.destroy();
      x.destroy();
    },
  };
}
