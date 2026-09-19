import { ref, remount } from "../lib/dom.ts";
import { caption, label, stage } from "../lib/layout.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { button, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  const scheduler = createScheduler();
  const pending = scheduler.slot();
  root.innerHTML = stage(
    "gap-6 p-6",
    html`
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Both boxes scale from 1 to 2. Watch what happens when the animation ends.</p>
    <div class="flex flex-wrap items-center justify-center gap-12">
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-32 w-24 items-center justify-center">
          <div data-ref="plain" class="size-14 rounded-lg bg-rose-500"></div>
        </div>
        ${label("Default (resets)")}
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-32 w-24 items-center justify-center">
          <div data-ref="forwards" class="size-14 rounded-lg bg-emerald-500"></div>
        </div>
        ${label("fill-mode: forwards")}
      </div>
    </div>
    <style>
      @keyframes demo-scale-up {
        0% { transform: scale(1); }
        100% { transform: scale(2); }
      }
    </style>
    ${button({ size: "sm", label: "Play", attrs: 'data-ref="play"' })}
    ${caption("Without fill-mode, the element snaps back to scale(1) once the animation finishes. With forwards, it keeps the final keyframe values.")}
  `,
  );
  let plain = ref(root, "plain", HTMLDivElement);
  let forwards = ref(root, "forwards", HTMLDivElement);

  ref(root, "play", HTMLButtonElement).addEventListener("click", () => {
    pending.cancel();
    plain = remount(plain, HTMLDivElement);
    forwards = remount(forwards, HTMLDivElement);
    pending.frame(() => {
      plain.style.animation = "demo-scale-up 0.6s ease";
      forwards.style.animation = "demo-scale-up 0.6s ease";
      forwards.style.animationFillMode = "forwards";
    });
  });

  return { destroy: scheduler.dispose };
};
