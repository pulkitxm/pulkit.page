import { animate, press } from "motion";
import { buttonClass, html, refs } from "../runtime/ui.js";

export function mount(root) {
  let liked = false;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <p class="text-center text-neutral-600 text-sm dark:text-neutral-400">Click the heart</p>
    <div data-ref="wrapper">
      <button
        type="button"
        data-ref="button"
        class="${buttonClass({
          className:
            "size-16 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700",
          size: "icon",
          variant: "ghost",
        })}"
        aria-label="Like"
      >
        <svg data-ref="heart" class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    </div>
    <div class="max-w-xs space-y-1 text-center text-neutral-600 text-xs dark:text-neutral-400">
      <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Feedback:</span> The button compresses on press</p>
      <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Delight:</span> The heart bounces and fills with color</p>
    </div>
  </div>`;
  const { wrapper, button, heart } = refs(root);
  let color = getComputedStyle(heart).color;
  let scale = 1;
  let colorAnimation;
  let scaleAnimation;

  function render() {
    heart.style.color = color;
    heart.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  }

  function update() {
    button.setAttribute("aria-label", liked ? "Unlike" : "Like");
    heart.setAttribute("fill", liked ? "currentColor" : "none");
    colorAnimation?.stop();
    scaleAnimation?.stop();
    colorAnimation = animate(color, liked ? "#ef4444" : "#a3a3a3", {
      duration: 0.3,
      onUpdate: (value) => {
        color = value;
        render();
      },
    });
    scaleAnimation = animate(scale, liked ? [1, 1.3, 1] : 1, {
      duration: 0.3,
      onUpdate: (value) => {
        scale = value;
        render();
      },
    });
  }

  const cancelPress = press(wrapper, () => {
    animate(wrapper, { scale: 0.9 });
    return () => animate(wrapper, { scale: 1 });
  });
  button.addEventListener("click", () => {
    liked = !liked;
    update();
  });
  update();

  return {
    destroy() {
      cancelPress();
      colorAnimation?.stop();
      scaleAnimation?.stop();
    },
  };
}
