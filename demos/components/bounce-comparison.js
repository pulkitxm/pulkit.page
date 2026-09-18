import { animate } from "motion";
import { button, html } from "../runtime/ui.js";

const cards = [
  {
    label: "No Bounce",
    description: "Professional, controlled",
    bounce: 0,
    stiffness: 400,
    damping: 30,
  },
  {
    label: "Subtle Bounce",
    description: "Adds life, not distracting",
    bounce: 0.15,
    stiffness: 400,
    damping: 18,
  },
  {
    label: "Excessive Bounce",
    description: "Playful, attention-grabbing",
    bounce: 0.4,
    stiffness: 400,
    damping: 8,
  },
];

function card({ label, description, bounce }) {
  return html`<div class="flex flex-col items-center gap-3">
    <span class="font-mono text-[10px] text-neutral-400">bounce: ${bounce}</span>
    <div class="relative flex h-32 w-32 items-end justify-center rounded-lg bg-neutral-100 pb-4 dark:bg-neutral-800">
      <div data-box class="h-10 w-10 rounded-lg bg-orange-500 shadow-md"></div>
    </div>
    <div class="text-center">
      <p class="font-medium text-neutral-800 text-sm dark:text-neutral-200">${label}</p>
      <p class="text-neutral-600 text-xs dark:text-neutral-300">${description}</p>
    </div>
  </div>`;
}

export function mount(root) {
  let isActive = false;
  const timers = new Set();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
    <div class="flex flex-wrap items-start justify-center gap-6">${cards.map(card)}</div>
    ${button({ className: "w-32", label: "Animate", attrs: "data-animate" })}
    <p class="max-w-md text-center text-neutral-600 text-xs dark:text-neutral-300">For most UI, subtle or no bounce is appropriate. Reserve high bounce for playful contexts.</p>
  </div>`;
  const boxes = [...root.querySelectorAll("[data-box]")];

  function setActive(value) {
    if (value === isActive) {
      return;
    }
    isActive = value;
    boxes.forEach((box, index) => {
      const { damping, stiffness } = cards[index];
      animate(box, { y: isActive ? -60 : 0 }, { damping, mass: 1, stiffness, type: "spring" });
    });
  }

  root.querySelector("[data-animate]").addEventListener("click", () => {
    setActive(true);
    const timer = setTimeout(() => {
      timers.delete(timer);
      setActive(false);
    }, 800);
    timers.add(timer);
  });

  return {
    destroy() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    },
  };
}
