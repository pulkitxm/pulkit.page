import { button, cn, html, refs } from "../runtime/ui.js";

const inputClass = "w-48 rounded-lg border-2 border-red-500 px-3 py-2 text-sm";

export function mount(root) {
  const timers = new Set();
  let input = null;

  function setShaking(shaking) {
    input.className = cn(inputClass, shaking && "animate-shake");
  }

  function triggerShake() {
    setShaking(true);
    const timer = setTimeout(() => {
      timers.delete(timer);
      setShaking(false);
    }, 300);
    timers.add(timer);
  }

  function build() {
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
    const elements = refs(root);
    input = elements.input;
    elements.trigger.addEventListener("click", triggerShake);
  }

  build();

  return {
    replay() {
      build();
      triggerShake();
    },
    destroy() {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    },
  };
}
