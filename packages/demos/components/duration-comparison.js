import { animate } from "motion";
import { button, html } from "../runtime/ui.js";

const menuItems = ["Dashboard", "Analytics", "Settings", "Help"];
const menus = [
  { duration: 0.18, label: "180ms" },
  { duration: 0.4, label: "400ms" },
];

export function mount(root) {
  const isOpen = [false, false];
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
  const panels = [...root.querySelectorAll("[data-menu]")];

  function target(index) {
    return {
      opacity: isOpen[index] ? 1 : 0,
      scale: isOpen[index] ? 1 : 0.95,
      y: isOpen[index] ? 0 : -8,
    };
  }

  function render(index, transition) {
    panels[index].style.pointerEvents = isOpen[index] ? "auto" : "none";
    animate(panels[index], target(index), transition);
  }

  function toggleMenu(index) {
    const other = index === 0 ? 1 : 0;
    const previous = [...isOpen];
    isOpen[index] = !isOpen[index];
    isOpen[other] = false;
    for (const menuIndex of [0, 1]) {
      if (previous[menuIndex] !== isOpen[menuIndex]) {
        render(menuIndex, { duration: menus[menuIndex].duration, ease: [0.16, 1, 0.3, 1] });
      }
    }
  }

  root.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      toggleMenu(Number(toggle.dataset.toggle));
    }
  });
  render(0, { duration: 0 });
  render(1, { duration: 0 });
}
