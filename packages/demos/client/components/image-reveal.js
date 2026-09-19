import { html, refs } from "../runtime/ui.ts";

const clipRevealMs = 850;
const inlineCode = "rounded bg-neutral-200 px-1 dark:bg-neutral-800";

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-6">
    <div
      data-ref="panel"
      class="aspect-video w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 shadow-md dark:border-neutral-700"
      style="clip-path: inset(100%); transition: clip-path ${clipRevealMs / 1000}s cubic-bezier(0.22, 1, 0.36, 1)"
    >
      <div class="size-full min-h-48 bg-linear-to-br from-violet-600 via-fuchsia-600 to-orange-500" aria-hidden="true"></div>
    </div>
    <p class="max-w-md text-center text-neutral-600 text-sm dark:text-neutral-400">The panel keeps its size in the layout. Only the clip animates from <code class="${inlineCode}">inset(100%)</code> to <code class="${inlineCode}">inset(0)</code>, so nothing reflows around it.</p>
  </div>`;
  const { panel } = refs(root);
  let raf1 = 0;
  let raf2 = 0;
  let timeout = 0;

  function setOpen(open) {
    panel.style.clipPath = open ? "inset(0)" : "inset(100%)";
  }

  function cancel() {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    clearTimeout(timeout);
  }

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => setOpen(true));
  });

  return {
    destroy: cancel,
    replay() {
      cancel();
      setOpen(false);
      timeout = setTimeout(() => setOpen(true), clipRevealMs + 50);
    },
  };
}
