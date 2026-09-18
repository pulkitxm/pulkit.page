import { button, html, refs } from "../runtime/ui.js";

export function mount(root) {
  let frame = 0;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-300">Both boxes have a 1s delay before fading in. Watch what happens during the delay.</p>
    <div class="flex flex-wrap items-center justify-center gap-12">
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-28 w-24 items-center justify-center">
          <div data-ref="plain" class="size-14 rounded-lg bg-violet-500"></div>
        </div>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">Without backwards</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-28 w-24 items-center justify-center">
          <div data-ref="both" class="size-14 rounded-lg bg-amber-500"></div>
        </div>
        <span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">With backwards</span>
      </div>
    </div>
    <style>
      @keyframes demo-delayed-fade {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    </style>
    ${button({ size: "sm", label: "Play", attrs: 'data-ref="play"' })}
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">Without backwards, the element is fully visible during the delay, then jumps to opacity 0 when the animation starts. With backwards (using "both" here), it applies the first keyframe immediately.</p>
  </div>`;
  const elements = refs(root);
  let { plain, both } = elements;

  function remount(element) {
    const fresh = element.cloneNode(false);
    fresh.removeAttribute("style");
    element.replaceWith(fresh);
    return fresh;
  }

  function start(element, fillMode) {
    element.style.animation = "demo-delayed-fade 0.5s ease";
    element.style.animationDelay = "1s";
    element.style.animationFillMode = fillMode;
  }

  elements.play.addEventListener("click", () => {
    cancelAnimationFrame(frame);
    plain = remount(plain);
    both = remount(both);
    frame = requestAnimationFrame(() => {
      start(plain, "forwards");
      start(both, "both");
    });
  });

  return {
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
