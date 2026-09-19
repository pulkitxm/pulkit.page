import { animate, hover } from "motion";
import { button, html, refs } from "../runtime/ui.ts";

const springTransition = { damping: 17, stiffness: 400, type: "spring" };

export function mount(root) {
  root.innerHTML = html`<div class="mt-6 flex flex-col gap-8 p-6">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="font-medium text-neutral-900 text-sm dark:text-neutral-100">Zone 1: No Animation (Accepted)</p>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">✓</span>
      </div>
      ${button({ variant: "secondary", label: "Instant Change" })}
      <p class="text-neutral-600 text-xs dark:text-neutral-400">Your brain says: "It's a computer, things change instantly. Normal."</p>
    </div>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="font-medium text-neutral-900 text-sm dark:text-neutral-100">Zone 2: Linear Animation (Uncanny)</p>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">⚠️</span>
      </div>
      ${button({
        variant: "secondary",
        className:
          "bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500",
        label: "Linear Motion",
        attrs: 'data-ref="linear" style="transition: all 300ms linear"',
      })}
      <p class="text-neutral-600 text-xs dark:text-neutral-400">Your brain says: "Wait... it moved. But something feels mechanical and wrong. Like a robot trying to act human."</p>
    </div>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="font-medium text-neutral-900 text-sm dark:text-neutral-100">Zone 3: Spring Animation (Natural)</p>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">✓</span>
      </div>
      <button data-ref="spring" class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-neutral-700 px-4 py-2 font-medium text-sm text-white hover:bg-neutral-800 active:scale-95 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300" type="button">Spring Motion</button>
      <p class="text-neutral-600 text-xs dark:text-neutral-400">Your brain says: "That feels right. It's responsive, has weight, and follows physics. Natural."</p>
    </div>
  </div>`;
  const { linear, spring } = refs(root);

  linear.addEventListener("mouseenter", (event) => {
    event.target.style.transform = "scale(1.05)";
  });
  linear.addEventListener("mouseleave", (event) => {
    event.target.style.transform = "scale(1)";
  });

  const cancelHover = hover(spring, () => {
    animate(spring, { scale: 1.05 }, springTransition);
    return () => animate(spring, { scale: 1 }, springTransition);
  });

  return { destroy: cancelHover };
}
