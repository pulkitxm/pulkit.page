import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();

  function setVisible(visible: boolean) {
    panel.style.opacity = visible ? "1" : "0";
    panel.style.transform = visible ? "translateY(0)" : "translateY(10px)";
  }

  function build(): HTMLDivElement {
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
    ref(root, "trigger", HTMLButtonElement).addEventListener("click", () => {
      setVisible(false);
      scheduler.later(() => setVisible(true), 100);
    });
    return ref(root, "panel", HTMLDivElement);
  }

  let panel = build();
  scheduler.later(() => setVisible(true), 300);

  return {
    replay() {
      panel = build();
      scheduler.later(() => setVisible(true), 100);
    },
    destroy: scheduler.dispose,
  };
};
