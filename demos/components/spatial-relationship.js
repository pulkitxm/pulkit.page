import { Settings, X } from "lucide";
import { animate } from "motion";
import { button, cn, html, icon, refs } from "../runtime/ui.js";

const transition = { damping: 25, stiffness: 300, type: "spring" };
const skeleton = (className) =>
  `<div data-slot="skeleton" class="${cn("animate-pulse rounded-md bg-accent", className)}"></div>`;

export function mount(root) {
  let isOpen = false;
  let panel = null;
  let exiting = null;
  root.innerHTML = html`<div data-ref="container" class="relative flex h-full min-h-48 w-full items-center justify-center overflow-hidden">
    ${button({ label: icon(Settings, "size-4"), attrs: 'data-ref="toggle"' })}
  </div>`;
  const { container, toggle } = refs(root);
  const labelNode = document.createTextNode("Open ");
  toggle.append(labelNode, document.createTextNode("Settings"));

  function createPanel() {
    const element = document.createElement("div");
    element.className =
      "absolute top-0 right-0 flex h-full w-52 flex-col border-neutral-300 border-l bg-white dark:border-neutral-700 dark:bg-neutral-900";
    element.innerHTML = html`<div class="flex items-center justify-between border-neutral-300 border-b p-3 dark:border-neutral-700">
        <span class="font-medium text-sm">Settings</span>
        ${button({ variant: "ghost", size: "icon", className: "size-7", label: icon(X, "size-4"), attrs: "data-close" })}
      </div>
      <div class="flex flex-col gap-4 p-4">
        <div class="space-y-2">${skeleton("h-3 w-16 animate-none")}${skeleton("h-8 w-full animate-none")}</div>
        <div class="space-y-2">${skeleton("h-3 w-20 animate-none")}${skeleton("h-8 w-full animate-none")}</div>
        <div class="space-y-2">${skeleton("h-3 w-14 animate-none")}${skeleton("h-8 w-full animate-none")}</div>
      </div>`;
    element.querySelector("[data-close]").addEventListener("click", () => setOpen(false));
    return element;
  }

  function setOpen(next) {
    isOpen = next;
    labelNode.textContent = `${isOpen ? "Close" : "Open"} `;
    if (isOpen) {
      if (panel && exiting) {
        exiting = null;
        animate(panel, { x: 0 }, transition);
        return;
      }
      panel = createPanel();
      container.append(panel);
      animate(panel, { x: "100%" }, { duration: 0 });
      animate(panel, { x: 0 }, transition);
    } else if (panel) {
      const element = panel;
      const controls = animate(element, { x: "100%" }, transition);
      exiting = controls;
      controls.then(() => {
        if (exiting === controls) {
          exiting = null;
          panel = null;
          element.remove();
        }
      });
    }
  }

  toggle.addEventListener("click", () => setOpen(!isOpen));
}
