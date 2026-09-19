import { ref } from "../lib/dom.ts";
import { buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

interface Personality {
  description: string;
  duration: string;
  easing: string;
  id: string;
  title: string;
}

const personalities: readonly Personality[] = [
  {
    description: "Safe, predictable, professional",
    duration: "300ms",
    easing: "ease-out",
    id: "standard",
    title: "Standard",
  },
  {
    description: "Quick, responsive, modern",
    duration: "200ms",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    id: "snappy",
    title: "Snappy",
  },
  {
    description: "Playful, energetic, attention-grabbing",
    duration: "400ms",
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    id: "bouncy",
    title: "Bouncy",
  },
];

const cardClass = buttonClass({
  variant: "outline",
  size: "card",
  className: "rounded-lg border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
});

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center p-4 sm:p-6">
    <div class="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
      ${personalities.map(
        (
          card,
        ) => `<button type="button" class="${cardClass}" data-ref="${card.id}" style="transform: translateY(0); transition: transform ${card.duration} ${card.easing}">
        <h4 class="font-medium text-neutral-900 dark:text-neutral-100">${card.title}</h4>
        <code class="mt-1 block break-words text-neutral-600 text-xs dark:text-neutral-300">${card.easing}</code>
        <p class="mt-2 text-neutral-600 text-sm dark:text-neutral-300">${card.description}</p>
      </button>`,
      )}
    </div>
    <p class="mt-4 text-center text-neutral-600 text-xs sm:mt-6 sm:text-sm dark:text-neutral-300">Hover over each card to feel the different easing personalities</p>
  </div>`;
  for (const card of personalities) {
    const element = ref(root, card.id, HTMLButtonElement);
    element.addEventListener("mouseenter", () => {
      element.style.transform = "translateY(-8px)";
    });
    element.addEventListener("mouseleave", () => {
      element.style.transform = "translateY(0)";
    });
  }
};
