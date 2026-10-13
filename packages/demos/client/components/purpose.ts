import { faHeart as faHeartOutline } from "@fortawesome/free-regular-svg-icons";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { type AnimationPlaybackControls, animate, press } from "motion";
import { ref } from "../lib/dom.ts";
import { createScheduler } from "../lib/scheduler.ts";
import { buttonClass, html, icon } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

export const mount: DemoMount = (root) => {
  let liked = false;
  const scheduler = createScheduler();
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
        <span data-ref="heart" class="inline-flex size-8">${icon(faHeartOutline, "size-8")}</span>
      </button>
    </div>
    <div class="max-w-xs space-y-1 text-center text-neutral-600 text-xs dark:text-neutral-400">
      <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Feedback:</span> The button compresses on press</p>
      <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Delight:</span> The heart bounces and fills with color</p>
    </div>
  </div>`;
  const wrapper = ref(root, "wrapper", HTMLDivElement);
  const button = ref(root, "button", HTMLButtonElement);
  const heart = ref(root, "heart", HTMLSpanElement);
  let color = getComputedStyle(heart).color;
  let scale = 1;
  let colorAnimation: AnimationPlaybackControls | undefined;
  let scaleAnimation: AnimationPlaybackControls | undefined;

  function render() {
    heart.style.color = color;
    heart.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  }

  function update() {
    button.setAttribute("aria-label", liked ? "Unlike" : "Like");
    heart.innerHTML = icon(liked ? faHeart : faHeartOutline, "size-8");
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

  scheduler.add(
    press(wrapper, () => {
      animate(wrapper, { scale: 0.9 });
      return () => animate(wrapper, { scale: 1 });
    }),
  );
  button.addEventListener("click", () => {
    liked = !liked;
    update();
  });
  update();
  scheduler.add(() => {
    colorAnimation?.stop();
    scaleAnimation?.stop();
  });

  return { destroy: scheduler.dispose };
};
