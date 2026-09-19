import { html } from "../runtime/ui.js";

const gap = "1rem";
const duration = "8s";
const repeat = 4;
const text = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Animi, in! ";

function marqueeTrack(easing, className) {
  const child = `<span class="whitespace-nowrap font-medium">${text}</span>`;
  return html`<style>
      @keyframes marquee-${easing} {
        from { transform: translateX(0); }
        to { transform: translateX(calc(-100% - ${gap})); }
      }
      .marquee-${easing} {
        display: flex;
        animation: marquee-${easing} ${duration} ${easing} infinite;
      }
    </style><div class="${className}">${Array.from({ length: repeat }, () => `<div class="flex shrink-0" style="gap: ${gap}">${child}</div>`)}</div>`;
}

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <div class="flex w-full max-w-md flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-neutral-600 text-xs dark:text-neutral-300">Linear (correct)</span>
        <div class="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 py-3 dark:border-neutral-700 dark:bg-neutral-800">${marqueeTrack("linear", "marquee-linear")}</div>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-neutral-600 text-xs dark:text-neutral-300">Ease-in-out (wrong)</span>
        <div class="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 py-3 dark:border-neutral-700 dark:bg-neutral-800">${marqueeTrack("ease-in-out", "marquee-ease-in-out")}</div>
      </div>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-sm dark:text-neutral-300">Marquees flow continuously. Easing makes it feel like it's "trying to get somewhere."</p>
  </div>`;
}
