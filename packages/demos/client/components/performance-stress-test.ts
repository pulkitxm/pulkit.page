import { Minus, Plus } from "lucide";
import { type AnimationPlaybackControls, animate } from "motion";
import { ref } from "../lib/dom.ts";
import { caption, stage } from "../lib/layout.ts";
import { simulateMainThreadWork } from "../lib/main-thread.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, buttonClass, html, icon } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const idleText = "Add items and load to see how CSS GPU acceleration outperforms JS under stress.";
const loadText = "Under load: CSS animations stay smooth, JS animations may stutter.";

interface MotionItem {
  element: HTMLDivElement;
  controls: AnimationPlaybackControls;
}

export const mount: DemoMount = (root) => {
  let itemCount = 10;
  const scheduler = createScheduler();
  const load = scheduler.slot();
  const cssItems: HTMLDivElement[] = [];
  const motionItems: MotionItem[] = [];
  root.innerHTML = stage(
    "gap-4 p-4",
    html`
    <div class="flex flex-wrap items-center justify-center gap-4">
      <div class="flex items-center gap-2">
        ${button({ variant: "outline", size: "icon", label: icon(Minus, "size-4"), attrs: 'data-ref="minus"' })}
        <span data-ref="count" class="w-20 text-center text-sm"></span>
        ${button({ variant: "outline", size: "icon", label: icon(Plus, "size-4"), attrs: 'data-ref="plus"' })}
      </div>
      ${button({ variant: "secondary", size: "sm", label: "Add Load", attrs: 'data-ref="load"' })}
    </div>
    <div class="flex w-full max-w-2xl gap-4">
      <div class="flex flex-1 flex-col gap-2">
        <span class="text-center text-neutral-600 dark:text-neutral-400 text-xs">CSS (GPU)</span>
        <div class="@container relative h-28 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
          <div data-ref="cssTrack" class="flex h-full items-center"></div>
          <style>
            @keyframes move-css {
              from { transform: translateX(8px); }
              to { transform: translateX(min(180px, calc(100cqw - 20px))); }
            }
          </style>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <span class="text-center text-neutral-600 dark:text-neutral-400 text-xs">Framer Motion (JS)</span>
        <div class="relative h-28 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
          <div data-ref="motionTrack" class="flex h-full items-center"></div>
        </div>
      </div>
    </div>
    ${caption(idleText, { ref: "text" })}
  `,
  );
  const minus = ref(root, "minus", HTMLButtonElement);
  const plus = ref(root, "plus", HTMLButtonElement);
  const count = ref(root, "count", HTMLSpanElement);
  const loadButton = ref(root, "load", HTMLButtonElement);
  const cssTrack = ref(root, "cssTrack", HTMLDivElement);
  const motionTrack = ref(root, "motionTrack", HTMLDivElement);
  const text = ref(root, "text", HTMLParagraphElement);

  function addItem(index: number) {
    const top = `${8 + (index % 5) * 20}px`;
    const cssItem = document.createElement("div");
    cssItem.className = "absolute left-0 h-3 w-3 rounded-full bg-green-500";
    cssItem.style.animation = "move-css 2s ease-in-out infinite alternate";
    cssItem.style.top = top;
    cssTrack.append(cssItem);
    cssItems.push(cssItem);
    const motionItem = document.createElement("div");
    motionItem.className = "absolute h-3 w-3 rounded-full bg-orange-500";
    motionItem.style.top = top;
    motionTrack.append(motionItem);
    animate(motionItem, { x: 8 }, { duration: 0 });
    const controls = animate(
      motionItem,
      { x: [8, Math.min(180, Math.max(8, motionTrack.clientWidth - 20))] },
      {
        delay: (index / itemCount) * 2,
        duration: 2,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse",
      },
    );
    motionItems.push({ element: motionItem, controls });
  }

  function syncItems() {
    while (cssItems.length < itemCount) {
      addItem(cssItems.length);
    }
    while (cssItems.length > itemCount) {
      cssItems.pop()?.remove();
      const motionItem = motionItems.pop();
      motionItem?.controls.stop();
      motionItem?.element.remove();
    }
  }

  function render() {
    syncItems();
    cssItems.forEach((item, index) => {
      item.style.animationDelay = `${(index / itemCount) * 2}s`;
    });
    count.textContent = `${itemCount} items`;
    minus.disabled = itemCount <= 5;
    plus.disabled = itemCount >= 50;
    const isHeavyLoad = load.active;
    loadButton.className = buttonClass({
      variant: isHeavyLoad ? "destructive" : "secondary",
      size: "sm",
    });
    loadButton.textContent = isHeavyLoad ? "Stop Load" : "Add Load";
    text.textContent = isHeavyLoad ? loadText : idleText;
  }

  minus.addEventListener("click", () => {
    itemCount = Math.max(5, itemCount - 5);
    render();
  });
  plus.addEventListener("click", () => {
    itemCount = Math.min(50, itemCount + 5);
    render();
  });
  loadButton.addEventListener("click", () => {
    if (load.active) {
      load.cancel();
    } else {
      load.interval(() => simulateMainThreadWork(3000000), 16);
    }
    render();
  });
  scheduler.add(() => {
    for (const { controls } of motionItems) {
      controls.stop();
    }
  });
  render();

  return { destroy: scheduler.dispose };
};
