import { Minus, Plus } from "lucide";
import { animate } from "motion";
import { button, buttonClass, html, icon, refs } from "../runtime/ui.js";

const idleText = "Add items and load to see how CSS GPU acceleration outperforms JS under stress.";
const loadText = "Under load: CSS animations stay smooth, JS animations may stutter.";

export function mount(root) {
  let itemCount = 10;
  let interval = null;
  const cssItems = [];
  const motionItems = [];
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-4">
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
    <p data-ref="text" class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">${idleText}</p>
  </div>`;
  const { minus, plus, count, load, cssTrack, motionTrack, text } = refs(root);

  function addItems() {
    while (cssItems.length < itemCount) {
      const index = cssItems.length;
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
    while (cssItems.length > itemCount) {
      cssItems.pop().remove();
      const { element, controls } = motionItems.pop();
      controls.stop();
      element.remove();
    }
  }

  function render() {
    addItems();
    cssItems.forEach((item, index) => {
      item.style.animationDelay = `${(index / itemCount) * 2}s`;
    });
    count.textContent = `${itemCount} items`;
    minus.disabled = itemCount <= 5;
    plus.disabled = itemCount >= 50;
    const isHeavyLoad = interval !== null;
    load.className = buttonClass({
      variant: isHeavyLoad ? "destructive" : "secondary",
      size: "sm",
    });
    load.textContent = isHeavyLoad ? "Stop Load" : "Add Load";
    text.textContent = isHeavyLoad ? loadText : idleText;
  }

  function stopLoad() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  minus.addEventListener("click", () => {
    itemCount = Math.max(5, itemCount - 5);
    render();
  });
  plus.addEventListener("click", () => {
    itemCount = Math.min(50, itemCount + 5);
    render();
  });
  load.addEventListener("click", () => {
    if (interval) {
      stopLoad();
    } else {
      interval = setInterval(() => {
        let sum = 0;
        for (let i = 0; i < 3000000; i++) {
          sum += Math.sqrt(i) * Math.sin(i);
        }
        return sum;
      }, 16);
    }
    render();
  });
  render();

  return {
    destroy() {
      stopLoad();
      for (const { controls } of motionItems) {
        controls.stop();
      }
    },
  };
}
