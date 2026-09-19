import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, cn, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const inputClass = "w-48 rounded-lg border-2 border-red-500 px-3 py-2 text-sm";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();

  function setShaking(shaking: boolean) {
    input.className = cn(inputClass, shaking && "animate-shake");
  }

  function triggerShake() {
    setShaking(true);
    scheduler.later(() => setShaking(false), 300);
  }

  function build(): HTMLInputElement {
    root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
      ${button({
        className:
          "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300",
        label: "Trigger shake",
        attrs: 'data-ref="trigger"',
      })}
      <div class="relative">
        <input data-ref="input" type="text" placeholder="Enter something invalid" class="${inputClass}">
      </div>
      <style>
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 300ms ease-in-out;
        }
      </style>
    </div>`;
    ref(root, "trigger", HTMLButtonElement).addEventListener("click", triggerShake);
    return ref(root, "input", HTMLInputElement);
  }

  let input = build();

  return {
    replay() {
      input = build();
      triggerShake();
    },
    destroy: scheduler.dispose,
  };
};
