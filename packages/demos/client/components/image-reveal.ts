import { ref } from "../lib/dom.ts";
import { stage } from "../lib/layout.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const clipRevealMs = 850;
const inlineCode = "rounded bg-neutral-200 px-1 dark:bg-neutral-800";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  const reveal = scheduler.slot();
  root.innerHTML = stage(
    "gap-4 p-6",
    html`
    <div
      data-ref="panel"
      class="aspect-video w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 shadow-md dark:border-neutral-700"
      style="clip-path: inset(100%); transition: clip-path ${clipRevealMs / 1000}s cubic-bezier(0.22, 1, 0.36, 1)"
    >
      <div class="size-full min-h-48 bg-linear-to-br from-violet-600 via-fuchsia-600 to-orange-500" aria-hidden="true"></div>
    </div>
    <p class="max-w-md text-center text-neutral-600 text-sm dark:text-neutral-400">The panel keeps its size in the layout. Only the clip animates from <code class="${inlineCode}">inset(100%)</code> to <code class="${inlineCode}">inset(0)</code>, so nothing reflows around it.</p>
  `,
  );
  const panel = ref(root, "panel", HTMLDivElement);

  function setOpen(open: boolean) {
    panel.style.clipPath = open ? "inset(0)" : "inset(100%)";
  }

  reveal.frame(() => {
    reveal.frame(() => setOpen(true));
  });

  return {
    destroy: scheduler.dispose,
    replay() {
      reveal.cancel();
      setOpen(false);
      reveal.later(() => setOpen(true), clipRevealMs + 50);
    },
  };
};
