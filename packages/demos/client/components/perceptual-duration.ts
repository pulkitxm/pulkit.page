import { animate } from "motion";
import { listenWindow, ref } from "../lib/dom.ts";
import { rangeField } from "../lib/layout.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

interface SpringConfig {
  duration: number;
  bounce: number;
}

type ConfigKey = keyof SpringConfig;

const ballSize = 40;
const padding = 16;
let instance = 0;

function isConfigKey(value: string | undefined): value is ConfigKey {
  return value === "duration" || value === "bounce";
}

function frameFocusesCode(host: Node): boolean {
  const frame: unknown = JSON.parse(
    (host instanceof HTMLElement ? host.dataset.frame : undefined) ?? "{}",
  );
  const focusCode =
    typeof frame === "object" && frame !== null && "focusCode" in frame
      ? frame.focusCode
      : undefined;
  return Boolean(focusCode ?? true);
}

function mountsBehindCodePanel(root: HTMLElement): boolean {
  const rootNode = root.getRootNode();
  const host = rootNode instanceof ShadowRoot ? rootNode.host : rootNode;
  return frameFocusesCode(host) && window.innerWidth < 1024;
}

export const mount: DemoMount = (root) => {
  instance += 1;
  const id = `perceptual-duration-${instance}`;
  const config: SpringConfig = { duration: 0.5, bounce: 0.2 };
  let isAtEnd = false;
  let animationDistance = 0;
  const scheduler = createScheduler();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
    <div class="w-full max-w-sm space-y-4">
      ${rangeField({ id: `${id}-duration`, label: "Duration", key: "duration", value: 0.5, min: 0.1, max: 1.5, step: 0.05, unit: "s" })}
      ${rangeField({ id: `${id}-bounce`, label: "Bounce", key: "bounce", value: 0.2, min: 0, max: 0.5, step: 0.05, unit: "" })}
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
  const container = ref(root, "container", HTMLDivElement);
  const box = ref(root, "box", HTMLDivElement);
  const animateButton = ref(root, "animateButton", HTMLButtonElement);
  const code = ref(root, "code", HTMLSpanElement);
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
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const key = input.dataset.key;
    if (!isConfigKey(key)) {
      return;
    }
    config[key] = Number(input.value);
    ref(root, `${key}Value`, HTMLSpanElement).textContent = String(config[key]);
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
  scheduler.add(listenWindow("resize", updateDistance));
  render();

  return { destroy: scheduler.dispose };
};
