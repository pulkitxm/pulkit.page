import { animate, type Transition } from "motion";
import { closestTarget, queryAll } from "../lib/dom.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const menuItems = ["Dashboard", "Analytics", "Settings", "Help"];
const menus = [
  { duration: 0.18, label: "180ms" },
  { duration: 0.4, label: "400ms" },
] as const;
const menuIndexes = [0, 1] as const;

type MenuIndex = (typeof menuIndexes)[number];

function isMenuIndex(value: number): value is MenuIndex {
  return menuIndexes.some((index) => index === value);
}

export const mount: DemoMount = (root) => {
  const isOpen: [boolean, boolean] = [false, false];
  root.innerHTML = html`<div class="flex size-full items-center justify-center gap-8 p-4">
    ${menus.map(
      (menu, index) => html`<div class="flex flex-col items-center gap-3">
        <div class="relative">
          ${button({ attrs: `data-toggle="${index}"`, label: "Menu", variant: "outline" })}
          <div
            data-menu="${index}"
            class="absolute top-full left-0 mt-2 w-40 origin-top rounded-lg border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
            style="opacity: 0; pointer-events: none; transform: translateY(-8px) scale(0.95)"
          >
            ${menuItems.map((item) =>
              button({
                attrs: `data-toggle="${index}"`,
                className: "w-full justify-start px-4 py-2 font-normal text-sm",
                label: item,
                variant: "ghost",
              }),
            )}
          </div>
        </div>
        <span class="text-neutral-600 text-xs dark:text-neutral-400">${menu.label}</span>
      </div>`,
    )}
  </div>`;
  const panels = queryAll(root, "[data-menu]", HTMLDivElement);

  function render(index: MenuIndex, transition: Transition) {
    const panel = panels[index];
    if (!panel) {
      return;
    }
    const open = isOpen[index];
    panel.style.pointerEvents = open ? "auto" : "none";
    animate(panel, { opacity: open ? 1 : 0, scale: open ? 1 : 0.95, y: open ? 0 : -8 }, transition);
  }

  function toggleMenu(index: MenuIndex) {
    const other = index === 0 ? 1 : 0;
    const previous = [...isOpen];
    isOpen[index] = !isOpen[index];
    isOpen[other] = false;
    for (const menuIndex of menuIndexes) {
      if (previous[menuIndex] !== isOpen[menuIndex]) {
        render(menuIndex, { duration: menus[menuIndex].duration, ease: [0.16, 1, 0.3, 1] });
      }
    }
  }

  root.addEventListener("click", (event) => {
    const toggle = closestTarget(event, "[data-toggle]", HTMLElement);
    const index = Number(toggle?.dataset.toggle);
    if (toggle && isMenuIndex(index)) {
      toggleMenu(index);
    }
  });
  render(0, { duration: 0 });
  render(1, { duration: 0 });
};
