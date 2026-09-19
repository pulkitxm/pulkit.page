import { expectElement, ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const panelClasses = [
  "h-28 w-full max-w-full rounded-xl bg-linear-to-br shadow-md transition-[clip-path] duration-700 ease-out from-slate-600 to-slate-800",
  "h-28 w-full max-w-full rounded-xl bg-linear-to-br shadow-md transition-[clip-path] duration-700 ease-out from-rose-500 to-orange-600",
  "h-28 w-full max-w-full rounded-xl bg-linear-to-br shadow-md transition-[clip-path] duration-700 ease-out from-emerald-500 to-teal-700",
];
const inlineCode = "rounded bg-neutral-200 px-1 dark:bg-neutral-800";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-3 p-4">
    <div
      data-ref="scroller"
      class="h-64 w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-900/80"
    >
      <div class="py-3">
        <p class="px-4 pb-2 text-center text-neutral-500 text-xs dark:text-neutral-400">Scroll inside this box</p>
        <div class="h-24 shrink-0" aria-hidden="true"></div>
        <div data-ref="panels" class="contents"></div>
        <div class="h-40 shrink-0" aria-hidden="true"></div>
      </div>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-sm dark:text-neutral-400">Each strip uses an IntersectionObserver with this scroll container as <code class="${inlineCode}">root</code>. When it crosses the threshold, <code class="${inlineCode}">clip-path</code> eases from off-screen to full.</p>
  </div>`;
  const scroller = ref(root, "scroller", HTMLDivElement);
  const panels = ref(root, "panels", HTMLDivElement);
  let observers: IntersectionObserver[] = [];

  function disconnect() {
    for (const observer of observers) {
      observer.disconnect();
    }
    observers = [];
  }

  function build() {
    disconnect();
    panels.innerHTML = panelClasses
      .map(
        (className) =>
          `<div class="shrink-0 px-2 pb-4"><div class="${className}" style="clip-path: inset(0 100% 0 0)"></div></div>`,
      )
      .join("");
    for (const wrapper of panels.children) {
      const strip = expectElement(wrapper.firstElementChild, HTMLDivElement);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            strip.style.clipPath = "inset(0)";
          }
        },
        { root: scroller, rootMargin: "0px", threshold: 0.35 },
      );
      observer.observe(wrapper);
      observers.push(observer);
    }
  }

  scheduler.add(disconnect);
  build();
  return { destroy: scheduler.dispose, replay: build };
};
