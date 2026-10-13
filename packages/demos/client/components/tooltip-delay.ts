import { faGear, faHouse, faMagnifyingGlass, faUser } from "@fortawesome/free-solid-svg-icons";
import { animate } from "motion";
import { queryAll } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { buttonClass, html, icon } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

interface ActiveTooltip {
  element: HTMLDivElement;
  index: number;
}

const buttons = [
  { icon: faHouse, label: "Home" },
  { icon: faMagnifyingGlass, label: "Search" },
  { icon: faGear, label: "Settings" },
  { icon: faUser, label: "Profile" },
];

export const mount: DemoMount = (root) => {
  let hasOpened = false;
  let isFirstTooltip = true;
  let active: ActiveTooltip | undefined;
  const scheduler = createScheduler();
  const delay = scheduler.slot();

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <div class="flex gap-1 rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800">
      ${buttons.map(
        (item, index) => html`<div data-slot="${index}" class="relative">
          <button type="button" data-index="${index}" class="${buttonClass({ size: "icon", variant: "ghost" })}" aria-label="${item.label}">
            ${icon(item.icon, "size-5")}
          </button>
        </div>`,
      )}
    </div>
    <div class="flex flex-col items-center gap-2">
      <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Hover over each icon</p>
      <p class="max-w-xs text-center text-neutral-600 text-xs dark:text-neutral-400">First tooltip waits 400ms. After that, moving between icons shows tooltips instantly.</p>
    </div>
  </div>`;
  const slots = queryAll(root, "[data-slot]", HTMLDivElement);

  function show(index: number) {
    if (active?.index === index) {
      return;
    }
    hide();
    const item = buttons[index];
    const slot = slots[index];
    if (!(item && slot)) {
      return;
    }
    const element = document.createElement("div");
    element.className =
      "absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-white text-xs dark:bg-neutral-100 dark:text-neutral-900";
    element.innerHTML = `${item.label}<div class="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-neutral-900 dark:border-b-neutral-100"></div>`;
    slot.append(element);
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
    active = undefined;
    animate(element, { opacity: 0, y: 4 }, { duration: isFirstTooltip ? 0.15 : 0 }).then(() =>
      element.remove(),
    );
  }

  function handleMouseEnter(index: number) {
    delay.cancel();
    if (hasOpened) {
      show(index);
    } else {
      delay.later(() => {
        show(index);
        scheduler.frame(() => {
          hasOpened = true;
          isFirstTooltip = false;
        });
      }, 400);
    }
  }

  function handleMouseLeave() {
    delay.cancel();
    hide();
  }

  for (const element of queryAll(root, "[data-index]", HTMLButtonElement)) {
    element.addEventListener("mouseenter", () => handleMouseEnter(Number(element.dataset.index)));
    element.addEventListener("mouseleave", handleMouseLeave);
  }

  return { destroy: scheduler.dispose };
};
