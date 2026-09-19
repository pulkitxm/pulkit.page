import { button, buttonClass, html, refs } from "../runtime/ui.js";

const idleText = "Click the button to simulate heavy JavaScript work on the main thread.";
const busyText =
  "Main thread is busy. Notice the transform animation stays smooth while the layout animation stutters.";

export function mount(root) {
  let interval = null;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
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
    <p data-ref="text" class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">${idleText}</p>
  </div>`;
  const { toggle, text } = refs(root);

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  toggle.addEventListener("click", () => {
    if (interval) {
      stop();
    } else {
      interval = setInterval(() => {
        let sum = 0;
        for (let i = 0; i < 5000000; i++) {
          sum += Math.sqrt(i) * Math.sin(i);
        }
        return sum;
      }, 16);
    }
    const isLoaded = interval !== null;
    toggle.className = buttonClass({
      variant: isLoaded ? "destructive" : "default",
      className: "mb-2",
    });
    toggle.textContent = isLoaded ? "Stop Main Thread Load" : "Add Main Thread Load";
    text.textContent = isLoaded ? busyText : idleText;
  });

  return { destroy: stop };
}
