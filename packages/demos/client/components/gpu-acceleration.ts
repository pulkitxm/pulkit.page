import { ref } from "../lib/dom.ts";
import { caption, stage } from "../lib/layout.ts";
import { simulateMainThreadWork } from "../lib/main-thread.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const idleText = "Click the button to simulate heavy JavaScript work on the main thread.";
const busyText =
  "Main thread is busy. Notice the transform animation stays smooth while the layout animation stutters.";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  const load = scheduler.slot();
  root.innerHTML = stage(
    "gap-6 p-6",
    html`
    ${button({ className: "mb-2", label: "Add Main Thread Load", attrs: 'data-ref="toggle"' })}
    <div class="flex flex-wrap items-center justify-center gap-8">
      <div class="flex flex-col items-center gap-3">
        <div class="relative h-20 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
          <div class="absolute top-0 bottom-0 m-auto h-8 w-8 rounded bg-red-500" style="animation: width-animation 2s ease-in-out infinite alternate"></div>
          <style>
            @keyframes width-animation {
              from { left: 8px; width: 32px; }
              to { left: calc(100% - 40px); width: 32px; }
            }
          </style>
        </div>
        <span class="text-neutral-600 dark:text-neutral-400 text-xs">Using left (layout)</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="relative h-20 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
          <div class="absolute top-0 bottom-0 left-2 m-auto h-8 w-8 rounded bg-green-500" style="animation: transform-animation 2s ease-in-out infinite alternate"></div>
          <style>
            @keyframes transform-animation {
              from { transform: translateX(0); }
              to { transform: translateX(calc(192px - 48px)); }
            }
          </style>
        </div>
        <span class="text-neutral-600 dark:text-neutral-400 text-xs">Using transform (GPU)</span>
      </div>
    </div>
    ${caption(idleText, { width: "max-w-sm", ref: "text" })}
  `,
  );
  const toggle = ref(root, "toggle", HTMLButtonElement);
  const text = ref(root, "text", HTMLParagraphElement);

  toggle.addEventListener("click", () => {
    if (load.active) {
      load.cancel();
    } else {
      load.interval(() => simulateMainThreadWork(5000000), 16);
    }
    const isLoaded = load.active;
    toggle.className = buttonClass({
      variant: isLoaded ? "destructive" : "default",
      className: "mb-2",
    });
    toggle.textContent = isLoaded ? "Stop Main Thread Load" : "Add Main Thread Load";
    text.textContent = isLoaded ? busyText : idleText;
  });

  return { destroy: scheduler.dispose };
};
