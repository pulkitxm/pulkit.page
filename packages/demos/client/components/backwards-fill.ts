import { ref, remount } from "../lib/dom.ts";
import { caption, label, stage } from "../lib/layout.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

function start(element: HTMLDivElement, fillMode: string): void {
  element.style.animation = "demo-delayed-fade 0.5s ease";
  element.style.animationDelay = "1s";
  element.style.animationFillMode = fillMode;
}

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  const pending = scheduler.slot();
  root.innerHTML = stage(
    "gap-6 p-6",
    html`
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Both boxes have a 1s delay before fading in. Watch what happens during the delay.</p>
    <div class="flex flex-wrap items-center justify-center gap-12">
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-28 w-24 items-center justify-center">
          <div data-ref="plain" class="size-14 rounded-lg bg-violet-500"></div>
        </div>
        ${label("Without backwards")}
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-28 w-24 items-center justify-center">
          <div data-ref="both" class="size-14 rounded-lg bg-amber-500"></div>
        </div>
        ${label("With backwards")}
      </div>
    </div>
    <style>
      @keyframes demo-delayed-fade {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    </style>
    ${button({ size: "sm", label: "Play", attrs: 'data-ref="play"' })}
    ${caption('Without backwards, the element is fully visible during the delay, then jumps to opacity 0 when the animation starts. With backwards (using "both" here), it applies the first keyframe immediately.')}
  `,
  );
  let plain = ref(root, "plain", HTMLDivElement);
  let both = ref(root, "both", HTMLDivElement);

  ref(root, "play", HTMLButtonElement).addEventListener("click", () => {
    pending.cancel();
    plain = remount(plain, HTMLDivElement);
    both = remount(both, HTMLDivElement);
    pending.frame(() => {
      start(plain, "forwards");
      start(both, "both");
    });
  });

  return { destroy: scheduler.dispose };
};
