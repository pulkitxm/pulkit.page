import { button, html } from "../runtime/ui.js";

const trackClass =
  "relative h-24 w-32 rounded-lg border-2 border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";
const triggerClass = "rounded px-3 py-1.5 text-xs";

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-8 p-6">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Hover and unhover quickly. The transition reverses smoothly; the keyframe jumps back.</p>
    <div class="flex flex-wrap items-center justify-center gap-10">
      <div class="flex flex-col items-center gap-3">
        <div class="${trackClass}">
          <div data-ref="transitionDot" class="absolute top-1/2 left-2 h-8 w-8 -translate-y-1/2 rounded-full bg-blue-500" style="transform: translateX(0); transition: transform 0.5s ease"></div>
        </div>
        ${button({ attrs: 'data-ref="transitionTrigger"', className: triggerClass, label: "Hover me (transition)", size: "sm", variant: "secondary" })}
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="${trackClass}">
          <div data-ref="keyframeDot" class="absolute top-1/2 left-2 h-8 w-8 -translate-y-1/2 rounded-full bg-amber-500" style="animation: none"></div>
        </div>
        ${button({ attrs: 'data-ref="keyframeTrigger"', className: triggerClass, label: "Hover me (keyframe)", size: "sm", variant: "secondary" })}
      </div>
    </div>
    <style>
      @keyframes slideRight {
        to { transform: translateX(72px); }
      }
    </style>
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">Transitions are interruptible: unhover mid-way and they smoothly reverse. Keyframe animations run to completion.</p>
  </div>`;
  const find = (name) => root.querySelector(`[data-ref="${name}"]`);
  const transitionDot = find("transitionDot");
  const keyframeDot = find("keyframeDot");
  const transitionTrigger = find("transitionTrigger");
  const keyframeTrigger = find("keyframeTrigger");
  transitionTrigger.addEventListener("mouseenter", () => {
    transitionDot.style.transform = "translateX(72px)";
  });
  transitionTrigger.addEventListener("mouseleave", () => {
    transitionDot.style.transform = "translateX(0)";
  });
  keyframeTrigger.addEventListener("mouseenter", () => {
    keyframeDot.style.animation = "slideRight 0.5s ease forwards";
  });
  keyframeTrigger.addEventListener("mouseleave", () => {
    keyframeDot.style.animation = "none";
  });
}
