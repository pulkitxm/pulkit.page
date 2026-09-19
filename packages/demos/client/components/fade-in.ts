import { stage } from "../lib/layout.ts";
import { html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = stage(
    "gap-8 p-6",
    html`
    <div
      class="flex size-24 items-center justify-center rounded-xl bg-blue-500 font-semibold text-white"
      style="animation: demo-fade-in 1s ease"
    >Hello</div>
    <style>
      @keyframes demo-fade-in {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
    </style>
    <p class="max-w-xs text-center text-neutral-600 text-sm dark:text-neutral-300">The element fades from invisible to visible over 1 second using the ease timing function.</p>
  `,
  );
};
