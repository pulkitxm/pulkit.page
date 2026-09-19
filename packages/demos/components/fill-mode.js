import { button, html, refs } from "../runtime/ui.js";

export function mount(root) {
  let frame = 0;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Both boxes scale from 1 to 2. Watch what happens when the animation ends.</p>
    <div class="flex flex-wrap items-center justify-center gap-12">
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-32 w-24 items-center justify-center">
          <div data-ref="plain" class="size-14 rounded-lg bg-rose-500"></div>
        </div>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">Default (resets)</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-32 w-24 items-center justify-center">
          <div data-ref="forwards" class="size-14 rounded-lg bg-emerald-500"></div>
        </div>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">fill-mode: forwards</span>
      </div>
    </div>
    <style>
      @keyframes demo-scale-up {
        0% { transform: scale(1); }
        100% { transform: scale(2); }
      }
    </style>
    ${button({ size: "sm", label: "Play", attrs: 'data-ref="play"' })}
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">Without fill-mode, the element snaps back to scale(1) once the animation finishes. With forwards, it keeps the final keyframe values.</p>
  </div>`;
  const elements = refs(root);
  let { plain, forwards } = elements;

  function remount(element) {
    const fresh = element.cloneNode(false);
    fresh.removeAttribute("style");
    element.replaceWith(fresh);
    return fresh;
  }

  elements.play.addEventListener("click", () => {
    cancelAnimationFrame(frame);
    plain = remount(plain);
    forwards = remount(forwards);
    frame = requestAnimationFrame(() => {
      plain.style.animation = "demo-scale-up 0.6s ease";
      forwards.style.animation = "demo-scale-up 0.6s ease";
      forwards.style.animationFillMode = "forwards";
    });
  });

  return {
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
