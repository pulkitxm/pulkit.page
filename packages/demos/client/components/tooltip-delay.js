import { animate } from "motion";
import { buttonClass, html } from "../runtime/ui.ts";

const buttons = [
  {
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    label: "Home",
  },
  { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", label: "Search" },
  {
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    label: "Settings",
  },
  { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label: "Profile" },
];

export function mount(root) {
  let hasOpened = false;
  let isFirstTooltip = true;
  let timeout;
  let frame;
  let active = null;

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <div class="flex gap-1 rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800">
      ${buttons.map(
        (item, index) => html`<div data-slot="${index}" class="relative">
          <button type="button" data-index="${index}" class="${buttonClass({ size: "icon", variant: "ghost" })}" aria-label="${item.label}">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="${item.icon}" />
            </svg>
          </button>
        </div>`,
      )}
    </div>
    <div class="flex flex-col items-center gap-2">
      <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Hover over each icon</p>
      <p class="max-w-xs text-center text-neutral-600 text-xs dark:text-neutral-400">First tooltip waits 400ms. After that, moving between icons shows tooltips instantly.</p>
    </div>
  </div>`;
  const slots = [...root.querySelectorAll("[data-slot]")];

  function show(index) {
    if (active?.index === index) {
      return;
    }
    hide();
    const element = document.createElement("div");
    element.className =
      "absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-white text-xs dark:bg-neutral-100 dark:text-neutral-900";
    element.innerHTML = `${buttons[index].label}<div class="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-neutral-900 dark:border-b-neutral-100"></div>`;
    slots[index].append(element);
    active = { element, index };
    if (isFirstTooltip) {
      animate(element, { opacity: 0, y: 4 }, { duration: 0 });
      animate(element, { opacity: 1, y: 0 }, { duration: 0.15 });
    }
  }

  function hide() {
    if (!active) {
      return;
    }
    const { element } = active;
    active = null;
    animate(element, { opacity: 0, y: 4 }, { duration: isFirstTooltip ? 0.15 : 0 }).then(() =>
      element.remove(),
    );
  }

  function handleMouseEnter(index) {
    clearTimeout(timeout);
    if (hasOpened) {
      show(index);
    } else {
      timeout = setTimeout(() => {
        show(index);
        frame = requestAnimationFrame(() => {
          hasOpened = true;
          isFirstTooltip = false;
        });
      }, 400);
    }
  }

  function handleMouseLeave() {
    clearTimeout(timeout);
    hide();
  }

  for (const element of root.querySelectorAll("[data-index]")) {
    element.addEventListener("mouseenter", () => handleMouseEnter(Number(element.dataset.index)));
    element.addEventListener("mouseleave", handleMouseLeave);
  }

  return {
    destroy() {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    },
  };
}
