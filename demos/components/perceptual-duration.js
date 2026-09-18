import { animate } from "motion";
import { button, html, refs } from "../runtime/ui.js";

const sliderLabel = "font-medium text-neutral-700 text-xs dark:text-neutral-300";
const sliderValue = "font-mono text-neutral-600 text-xs dark:text-neutral-300";
const sliderInput =
  "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900 dark:bg-neutral-700 dark:accent-neutral-100";

let instance = 0;

function slider({ id, label, key, value, min, max, step, unit = "" }) {
  return html`<div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label for="${id}" class="${sliderLabel}">${label}</label>
      <span class="${sliderValue}"><span data-ref="${key}Value">${value}</span>${unit}</span>
    </div>
    <input id="${id}" data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" class="${sliderInput}" />
  </div>`;
}

function mountsBehindCodePanel(root) {
  const frame = JSON.parse(root.getRootNode().host?.dataset.frame ?? "{}");
  return (frame.focusCode ?? true) && window.innerWidth < 1024;
}

export function mount(root) {
  instance += 1;
  const id = `perceptual-duration-${instance}`;
  const config = { duration: 0.5, bounce: 0.2 };
  let isAtEnd = false;
  let animationDistance = 0;
  const ballSize = 40;
  const padding = 16;
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
    <div class="w-full max-w-sm space-y-4">
      ${slider({ id: `${id}-duration`, label: "Duration", key: "duration", value: 0.5, min: 0.1, max: 1.5, step: 0.05, unit: "s" })}
      ${slider({ id: `${id}-bounce`, label: "Bounce", key: "bounce", value: 0.2, min: 0, max: 0.5, step: 0.05 })}
    </div>
    <div data-ref="container" class="relative h-16 w-full max-w-sm rounded-lg bg-neutral-100 dark:bg-neutral-800">
      <div data-ref="box" class="absolute top-1/2 left-4 h-10 w-10 -translate-y-1/2 rounded-lg bg-orange-500 shadow-lg"></div>
    </div>
    ${button({ className: "w-32", label: "Animate", attrs: 'data-ref="animateButton"' })}
    <div class="rounded-md bg-neutral-100 p-3 font-mono text-xs dark:bg-neutral-800">
      <span class="text-neutral-600 dark:text-neutral-300">transition:</span>
      <span data-ref="code" class="text-orange-600 dark:text-orange-400"></span>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-300">Apple's approach: define springs with perceptual duration and bounce instead of stiffness/damping.</p>
  </div>`;
  const elements = refs(root);
  const { container, box, animateButton, code } = elements;
  let target = 0;

  function sync() {
    const next = isAtEnd ? animationDistance : 0;
    if (next === target) {
      return;
    }
    target = next;
    animate(
      box,
      { x: target },
      { bounce: config.bounce, duration: config.duration, type: "spring" },
    );
  }

  function render() {
    code.textContent = `{ type: "spring", duration: ${config.duration}, bounce: ${config.bounce} }`;
  }

  function updateDistance() {
    animationDistance = container.offsetWidth - ballSize - padding * 2;
    sync();
  }

  root.addEventListener("input", (event) => {
    const key = event.target.dataset.key;
    if (!key) {
      return;
    }
    config[key] = Number(event.target.value);
    elements[`${key}Value`].textContent = config[key];
    render();
  });

  animateButton.addEventListener("click", () => {
    isAtEnd = !isAtEnd;
    sync();
  });

  if (mountsBehindCodePanel(root)) {
    animationDistance = -ballSize - padding * 2;
  } else {
    updateDistance();
  }
  window.addEventListener("resize", updateDistance);
  render();

  return {
    destroy() {
      window.removeEventListener("resize", updateDistance);
    },
  };
}
