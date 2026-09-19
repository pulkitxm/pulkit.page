import { animate, motionValue } from "motion";
import { button, buttonClass, html, refs } from "../runtime/ui.js";

const transition = { damping: 25, stiffness: 400, type: "spring" };
const toastClass =
  "flex h-12 w-56 items-center justify-between rounded-lg bg-neutral-900 px-4 shadow-lg dark:bg-neutral-100";
const closeClass = buttonClass({
  variant: "ghost",
  size: "icon",
  className:
    "size-6 text-neutral-400 hover:text-neutral-200 dark:text-neutral-600 dark:hover:text-neutral-800",
});

export function mount(root) {
  let counter = 0;
  const toasts = [];
  const timers = new Set();
  root.innerHTML = html`<div class="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
    ${button({ className: "w-32", label: "Add Toast", attrs: 'data-ref="add"' })}
    <div class="relative h-48 w-full max-w-sm">
      <div data-ref="list" class="absolute right-0 bottom-0 flex flex-col-reverse gap-2"></div>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-300">Click rapidly. Spring animations handle layout shifts smoothly. CSS would cause jumps.</p>
  </div>`;
  const { add, list } = refs(root);

  function layoutBox(element) {
    return { left: list.offsetLeft + element.offsetLeft, top: list.offsetTop + element.offsetTop };
  }

  function snapshot() {
    return new Map(
      toasts.map((toast) => {
        const box = layoutBox(toast.element);
        return [
          toast,
          { left: box.left + toast.layoutX.get(), top: box.top + toast.layoutY.get() },
        ];
      }),
    );
  }

  function applyLayout(before) {
    for (const toast of toasts) {
      const previous = before.get(toast);
      if (!previous) {
        continue;
      }
      const box = layoutBox(toast.element);
      const dx = previous.left - box.left;
      const dy = previous.top - box.top;
      if (dx === toast.layoutX.get() && dy === toast.layoutY.get()) {
        continue;
      }
      if (dx !== 0 || toast.layoutX.get() !== 0) {
        toast.layoutX.jump(dx);
        animate(toast.layoutX, 0, transition);
      }
      if (dy !== 0 || toast.layoutY.get() !== 0) {
        toast.layoutY.jump(dy);
        animate(toast.layoutY, 0, transition);
      }
    }
  }

  function remove(toast) {
    const index = toasts.indexOf(toast);
    if (index === -1) {
      return;
    }
    const before = snapshot();
    const { element } = toast;
    const width = Number.parseFloat(getComputedStyle(element).width);
    const height = Number.parseFloat(getComputedStyle(element).height);
    const top = element.offsetTop;
    const left = element.offsetLeft;
    toasts.splice(index, 1);
    Object.assign(element.style, {
      height: `${height}px`,
      left: `${left}px`,
      position: "absolute",
      top: `${top}px`,
      width: `${width}px`,
    });
    applyLayout(before);
    animate(element, { opacity: 0, scale: 0.9 }, { duration: 0.15 }).then(() => element.remove());
  }

  add.addEventListener("click", () => {
    const before = snapshot();
    counter += 1;
    const element = document.createElement("div");
    element.className = toastClass;
    element.innerHTML = html`<span class="font-medium text-neutral-100 text-sm dark:text-neutral-900">Toast ${counter}</span><button type="button" class="${closeClass}">×</button>`;
    const toast = { element, layoutX: motionValue(0), layoutY: motionValue(0) };
    const renderTranslate = () => {
      element.style.translate = `${toast.layoutX.get()}px ${toast.layoutY.get()}px`;
    };
    toast.layoutX.on("change", renderTranslate);
    toast.layoutY.on("change", renderTranslate);
    element.querySelector("button").addEventListener("click", () => remove(toast));
    list.append(element);
    toasts.push(toast);
    applyLayout(before);
    animate(element, { opacity: 0, scale: 0.9, y: 50 }, { duration: 0 });
    animate(element, { opacity: 1, scale: 1, y: 0 }, transition);
    const timer = setTimeout(() => {
      timers.delete(timer);
      remove(toast);
    }, 3000);
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
