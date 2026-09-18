import { button, html, refs } from "../runtime/ui.js";

const GRID_SIZE = 16;
const blockClass =
  "rounded-md bg-amber-500 px-4 py-2 font-medium text-white text-xs transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50";

const styles = `
  @keyframes janky-pulse {
    0%, 100% {
      width: 100%;
      height: 100%;
    }
    50% {
      width: 40%;
      height: 40%;
    }
  }

  @keyframes smooth-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.4);
    }
  }

  .janky-box {
    width: 100%;
    height: 100%;
    animation: janky-pulse 800ms ease-in-out infinite;
  }

  .smooth-box {
    width: 100%;
    height: 100%;
    animation: smooth-pulse 800ms ease-in-out infinite;
  }
`;

function boxes(className) {
  return Array.from(
    { length: GRID_SIZE },
    (_, i) =>
      `<div class="${className}" data-box style="animation-delay: ${i * 50}ms; animation-play-state: running"></div>`,
  );
}

export function mount(root) {
  let isRunning = true;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-4 p-4">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Click &quot;Block Main Thread&quot; to see which animation survives</p>
    <div class="flex flex-wrap items-center justify-center gap-6">
      <div class="flex flex-col items-center gap-2">
        <div class="relative grid h-32 w-32 grid-cols-4 gap-1 overflow-hidden rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
          ${boxes("janky-box rounded-sm bg-linear-to-br from-red-400 to-red-600")}
        </div>
        <span class="font-medium text-red-600 text-xs dark:text-red-400">Animates width, height</span>
        <span class="text-neutral-500 text-xs">Triggers layout every frame</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <div class="relative grid h-32 w-32 grid-cols-4 gap-1 overflow-hidden rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950/40">
          ${boxes("smooth-box rounded-sm bg-linear-to-br from-green-400 to-green-600")}
        </div>
        <span class="font-medium text-green-600 text-xs dark:text-green-400">Animates transform only</span>
        <span class="text-neutral-500 text-xs">GPU handles it</span>
      </div>
    </div>
    <div class="flex gap-3">
      ${button({ className: blockClass, label: "Block Main Thread", attrs: 'data-ref="block"' })}
      ${button({ label: "Pause", attrs: 'data-ref="toggle"' })}
    </div>
    <style>${styles}</style>
    <p class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">When you block the main thread, the left animation freezes because width/height changes require JavaScript. The right animation keeps running because transform is handled entirely by the GPU.</p>
  </div>`;
  const { block, toggle } = refs(root);

  block.addEventListener("click", () => {
    block.disabled = true;
    block.textContent = "Blocking for 2s...";
    const blockFor = 2000;
    const start = performance.now();
    while (performance.now() - start < blockFor) {
      Math.random() * Math.random();
    }
    block.disabled = false;
    block.textContent = "Block Main Thread";
  });

  toggle.addEventListener("click", () => {
    isRunning = !isRunning;
    toggle.textContent = isRunning ? "Pause" : "Play";
    for (const box of root.querySelectorAll("[data-box]")) {
      box.style.animationPlayState = isRunning ? "running" : "paused";
    }
  });
}
