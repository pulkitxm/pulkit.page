import { animate } from "motion";
import { button, html, refs } from "../runtime/ui.js";

const items = [
  { name: "index.tsx", type: "file" },
  { name: "components", type: "folder" },
  { name: "utils.ts", type: "file" },
  { name: "styles.css", type: "file" },
  { name: "hooks", type: "folder" },
];

const folderIcon = `<svg class="size-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>`;
const fileIcon = `<svg class="size-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;
const highlightClass = "absolute inset-x-1 h-8 rounded bg-blue-100 dark:bg-blue-900/40";
const layoutTransition = { damping: 35, stiffness: 500, type: "spring" };

export function mount(root) {
  let selectedIndex = 0;
  let animated = true;
  let isFocused = false;
  let layoutAnimation;

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-4">
    <div
      data-ref="browser"
      class="relative w-64 overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      role="application"
      aria-label="File browser demo"
    >
      <div class="border-neutral-200 border-b bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
        <span data-ref="hint" class="font-medium text-neutral-700 text-xs dark:text-neutral-300">Click to focus</span>
      </div>
      <div data-ref="list" class="relative p-1">
        <div data-ref="highlight" class="${highlightClass}" style="top: 4px"></div>
        ${items.map((item, index) =>
          button({
            attrs: `data-index="${index}"`,
            className:
              "relative z-10 h-8 w-full justify-start gap-2 rounded px-2 text-left font-normal text-sm",
            label: `${item.type === "folder" ? folderIcon : fileIcon}<span class="text-neutral-800 dark:text-neutral-200">${item.name}</span>`,
            variant: "ghost",
          }),
        )}
      </div>
    </div>
    <div class="flex flex-col items-center gap-2">
      <div class="flex items-center gap-2 text-xs">
        <span class="rounded bg-neutral-200 px-2 py-1 font-mono dark:bg-neutral-700">Shift</span>
        <span class="text-neutral-600 dark:text-neutral-400">to toggle animation</span>
      </div>
      <span data-ref="mode" class="text-xs text-blue-600 dark:text-blue-400">Animated</span>
    </div>
  </div>`;
  const { browser, hint, list, mode } = refs(root);
  let { highlight } = refs(root);

  function stopLayoutAnimation() {
    layoutAnimation?.stop();
    layoutAnimation = undefined;
    highlight.style.transform = "";
  }

  function select(index) {
    if (index === selectedIndex) {
      return;
    }
    selectedIndex = index;
    if (!animated) {
      highlight.style.top = `${4 + selectedIndex * 32}px`;
      return;
    }
    const previousTop = highlight.getBoundingClientRect().top;
    stopLayoutAnimation();
    highlight.style.top = `${4 + selectedIndex * 32}px`;
    const delta = previousTop - highlight.getBoundingClientRect().top;
    if (delta === 0) {
      return;
    }
    const element = highlight;
    element.style.transform = `translateY(${delta}px)`;
    layoutAnimation = animate(0, 1000, {
      ...layoutTransition,
      onUpdate: (progress) => {
        const offset = delta * (1 - progress / 1000);
        element.style.transform = offset === 0 ? "" : `translateY(${offset}px)`;
      },
    });
  }

  function setAnimated(value) {
    animated = value;
    stopLayoutAnimation();
    const replacement = document.createElement("div");
    replacement.className = highlightClass;
    replacement.style.top = `${4 + selectedIndex * 32}px`;
    highlight.replaceWith(replacement);
    highlight = replacement;
    mode.textContent = animated ? "Animated" : "Instant";
    mode.className = animated
      ? "text-xs text-blue-600 dark:text-blue-400"
      : "text-xs text-neutral-600 dark:text-neutral-400";
  }

  function setFocused(value) {
    isFocused = value;
    hint.textContent = isFocused ? "Use ↑↓ to navigate" : "Click to focus";
  }

  function handleKeyDown(event) {
    if (!isFocused) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      select(Math.min(selectedIndex + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      select(Math.max(selectedIndex - 1, 0));
    } else if (event.shiftKey && !event.repeat) {
      setAnimated(!animated);
    }
  }

  browser.addEventListener("focusin", () => setFocused(true));
  browser.addEventListener("focusout", () => setFocused(false));
  list.addEventListener("click", (event) => {
    const target = event.target.closest("[data-index]");
    if (target) {
      select(Number(target.dataset.index));
    }
  });
  window.addEventListener("keydown", handleKeyDown);

  return {
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      layoutAnimation?.stop();
    },
  };
}
