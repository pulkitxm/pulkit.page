import { animate } from "motion";
import { html, refs } from "../runtime/ui.js";

const launcherItems = ["Open File", "Run Command", "Search Symbol"];

export function mount(root) {
  let withAnimation = true;
  let isOpen = false;
  let pressCount = 0;
  let panel = null;
  let exiting = false;
  let panelAnimation;

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-4">
    <div class="relative h-64 w-72 overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
      <div class="flex items-center justify-between border-neutral-300 border-b bg-neutral-200 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
        <span class="font-medium text-neutral-900 text-sm dark:text-neutral-100">Quick Launcher</span>
        <div class="flex gap-1">
          <div class="size-2 rounded-full bg-neutral-400"></div>
          <div class="size-2 rounded-full bg-neutral-400"></div>
          <div class="size-2 rounded-full bg-neutral-400"></div>
        </div>
      </div>
      <div data-ref="placeholder" class="flex h-full items-center justify-center pb-10">
        <span class="text-neutral-600 text-sm dark:text-neutral-400">Press J or K to toggle</span>
      </div>
    </div>
    <div class="flex flex-col items-center gap-2">
      <div class="flex gap-4 text-xs">
        <span class="rounded bg-neutral-200 px-2 py-1 font-mono dark:bg-neutral-700">J = animated</span>
        <span class="rounded bg-neutral-200 px-2 py-1 font-mono dark:bg-neutral-700">K = instant</span>
      </div>
      <p data-ref="question" class="max-w-xs text-center text-neutral-600 text-xs dark:text-neutral-400" hidden></p>
    </div>
  </div>`;
  const { placeholder, question } = refs(root);

  function transition() {
    return withAnimation ? { duration: 0.15, ease: [0.16, 1, 0.3, 1] } : { duration: 0 };
  }

  function createPanel() {
    const element = document.createElement("div");
    element.className =
      "absolute inset-x-0 top-10 mx-2 mt-2 rounded-md border border-neutral-300 bg-white p-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800";
    element.innerHTML = html`<input
        type="text"
        placeholder="Search..."
        class="mb-2 w-full rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-sm outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
      />
      <div class="space-y-1">
        ${launcherItems.map(
          (item) =>
            `<div class="rounded px-2 py-1 text-neutral-700 text-sm hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700">${item}</div>`,
        )}
      </div>`;
    return element;
  }

  function open() {
    if (panel && exiting) {
      exiting = false;
      panelAnimation?.stop();
      panelAnimation = animate(panel, { opacity: 1, y: 0 }, transition());
      return;
    }
    panel = createPanel();
    placeholder.before(panel);
    if (withAnimation) {
      animate(panel, { opacity: 0, y: -8 }, { duration: 0 });
      panelAnimation = animate(panel, { opacity: 1, y: 0 }, transition());
    }
  }

  function close() {
    if (!panel) {
      return;
    }
    const element = panel;
    exiting = true;
    panelAnimation?.stop();
    panelAnimation = animate(
      element,
      withAnimation ? { opacity: 0, y: -8 } : { opacity: 0 },
      transition(),
    );
    panelAnimation.then(() => {
      if (panel === element && exiting) {
        element.remove();
        panel = null;
        exiting = false;
      }
    });
  }

  function toggle(animated) {
    withAnimation = animated;
    isOpen = !isOpen;
    pressCount += 1;
    placeholder.hidden = isOpen;
    if (isOpen) {
      open();
    } else {
      close();
    }
    question.hidden = pressCount <= 5;
    question.textContent = `After ${pressCount} toggles, which feels faster for repeated use?`;
  }

  function handleKeyDown(event) {
    if (event.key === "j" || event.key === "J") {
      toggle(true);
    } else if (event.key === "k" || event.key === "K") {
      toggle(false);
    }
  }

  globalThis.addEventListener("keydown", handleKeyDown);

  return {
    destroy() {
      globalThis.removeEventListener("keydown", handleKeyDown);
      panelAnimation?.stop();
    },
  };
}
