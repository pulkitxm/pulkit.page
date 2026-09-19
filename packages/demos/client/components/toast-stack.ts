import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

interface Toast {
  element: HTMLButtonElement;
  entered: boolean;
}

const toastHeight = 52;
const gap = 8;
const toastClass = buttonClass({
  className:
    "absolute right-0 bottom-0 left-0 flex h-12 shrink-0 items-center justify-between rounded-lg border-neutral-200 bg-white px-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
  variant: "outline",
});

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-end gap-6 p-4">
    <div data-ref="stack" class="relative w-full max-w-sm grow overflow-hidden"></div>
    ${button({ attrs: 'data-ref="add"', label: "Add toast" })}
    <p class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">Add toasts quickly. With CSS transitions, when a new toast appears, existing ones smoothly shift to their new positions instead of jumping.</p>
  </div>`;
  const stack = ref(root, "stack", HTMLDivElement);
  const toasts: Toast[] = [];
  const scheduler = createScheduler();

  function render() {
    toasts.forEach((toast, index) => {
      const stackY = (toasts.length - 1 - index) * (toastHeight + gap);
      const translateY = -stackY + (toast.entered ? 0 : toastHeight + gap);
      toast.element.style.opacity = toast.entered ? "1" : "0";
      toast.element.style.transform = `translateY(${translateY}px)`;
    });
  }

  function addToast() {
    const index = toasts.length;
    const element = document.createElement("button");
    element.type = "button";
    element.className = toastClass;
    element.style.transition =
      "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out";
    element.style.zIndex = String(index);
    element.innerHTML = `<span class="font-medium text-neutral-800 text-sm dark:text-neutral-200">Toast ${index + 1}</span>`;
    const toast: Toast = { element, entered: false };
    toasts.push(toast);
    stack.append(element);
    render();
    scheduler.frame(() => {
      toast.entered = true;
      render();
    });
  }

  ref(root, "add", HTMLButtonElement).addEventListener("click", addToast);
  addToast();
  return { destroy: scheduler.dispose };
};
