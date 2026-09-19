import { Pause, Play } from "lucide";
import { buttonClass, html, icon, refs } from "../runtime/ui.ts";

export function mount(root) {
  let paused = false;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Pause and resume the animation. The element picks up exactly where it left off.</p>
    <div class="relative h-16 w-72 overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
      <div
        data-ref="ball"
        class="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-sky-500"
        style="animation: demo-bounce-x 2s cubic-bezier(0.645, 0.045, 0.355, 1) infinite alternate; animation-play-state: running"
      ></div>
    </div>
    <style>
      @keyframes demo-bounce-x {
        0% { left: 8px; }
        100% { left: calc(100% - 48px); }
      }
    </style>
    <button type="button" data-ref="toggle" class="${buttonClass({ variant: "secondary", size: "sm" })}"></button>
    <p class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">animation-play-state toggles between running and paused. This is something CSS transitions cannot do.</p>
  </div>`;
  const { ball, toggle } = refs(root);

  function render() {
    ball.style.animationPlayState = paused ? "paused" : "running";
    toggle.innerHTML = paused
      ? `${icon(Play, "mr-1.5 size-3.5")}Resume`
      : `${icon(Pause, "mr-1.5 size-3.5")}Pause`;
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    render();
  });
  render();
}
