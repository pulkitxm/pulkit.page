import { button, html, refs } from "../runtime/ui.ts";

export function mount(root) {
  const timers = new Set();
  let panel = null;

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function setVisible(visible) {
    panel.style.opacity = visible ? "1" : "0";
    panel.style.transform = visible ? "translateY(0)" : "translateY(10px)";
  }

  function build() {
    root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
      ${button({
        className:
          "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300",
        label: "Trigger slide-in",
        attrs: 'data-ref="trigger"',
      })}
      <div class="relative h-24 w-48 overflow-hidden">
        <div data-ref="panel" class="absolute inset-0 flex items-center justify-center rounded-lg bg-cyan-500 font-medium text-white" style="opacity: 0; transform: translateY(10px); transition: opacity 300ms ease-out, transform 300ms ease-out">Slid in</div>
      </div>
    </div>`;
    const elements = refs(root);
    panel = elements.panel;
    elements.trigger.addEventListener("click", () => {
      setVisible(false);
      later(() => setVisible(true), 100);
    });
  }

  build();
  later(() => setVisible(true), 300);

  return {
    replay() {
      build();
      later(() => setVisible(true), 100);
    },
    destroy() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    },
  };
}
