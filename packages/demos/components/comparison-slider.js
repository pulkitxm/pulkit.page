import { html, refs } from "../runtime/ui.js";

export function mount(root) {
  let pct = 50;
  let dragging = false;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-6">
    <div
      data-ref="container"
      class="relative aspect-video w-full max-w-md cursor-ew-resize touch-none select-none overflow-hidden rounded-xl border border-neutral-200 shadow-md dark:border-neutral-700"
    >
      <div class="absolute inset-0 bg-linear-to-br from-amber-400 via-orange-500 to-rose-600" aria-hidden="true"></div>
      <div data-ref="top" class="absolute inset-0 bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600" aria-hidden="true"></div>
      <div data-ref="line" class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md" style="transform: translateX(-50%)"></div>
      <div
        data-ref="handle"
        class="pointer-events-none absolute top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/90 text-neutral-800 text-xs shadow"
      >↔</div>
    </div>
    <p class="max-w-md text-center text-neutral-600 text-sm dark:text-neutral-400">Drag across the frame. The top layer uses <code class="rounded bg-neutral-200 px-1 dark:bg-neutral-800">inset(0 <span data-ref="inset"></span>% 0 0)</code> so only the left strip stays visible.</p>
  </div>`;
  const { container, top, line, handle, inset } = refs(root);

  function render() {
    const rightInset = 100 - pct;
    top.style.clipPath = `inset(0 ${rightInset}% 0 0)`;
    line.style.left = `${pct}%`;
    handle.style.left = `${pct}%`;
    inset.textContent = rightInset;
  }

  function update(clientX) {
    const rect = container.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    pct = Math.round((x / rect.width) * 100);
    render();
  }

  function release(event) {
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    dragging = false;
  }

  container.addEventListener("pointerdown", (event) => {
    container.setPointerCapture(event.pointerId);
    dragging = true;
    update(event.clientX);
  });
  container.addEventListener("pointermove", (event) => {
    if (dragging) {
      update(event.clientX);
    }
  });
  container.addEventListener("pointerup", release);
  container.addEventListener("pointercancel", release);
  render();
}
