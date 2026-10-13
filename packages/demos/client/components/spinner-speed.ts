import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { html, icon } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const spinners = [
  { duration: "1.5s", feel: "Feels sluggish", label: "1.5s rotation" },
  { duration: "0.6s", feel: "Feels active", label: "0.6s rotation" },
];

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Same wait time, different perceived speed</p>
    <div class="flex items-center gap-12">
      ${spinners.map(
        (spinner) => html`<div class="flex flex-col items-center gap-3">
          <div class="flex size-16 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
            ${icon(faCircleNotch, "size-8 animate-spin text-blue-600", `style="animation-duration: ${spinner.duration}"`)}
          </div>
          <span class="text-neutral-600 text-xs dark:text-neutral-400">${spinner.label}</span>
          <span class="text-neutral-500 dark:text-neutral-400 text-xs">${spinner.feel}</span>
        </div>`,
      )}
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-xs dark:text-neutral-400">A faster spinner creates the illusion that your app is working harder, even though the actual load time is identical.</p>
  </div>`;
};
