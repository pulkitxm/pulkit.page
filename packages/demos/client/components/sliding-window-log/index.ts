import { prefersReducedMotion } from "@pulkit/shared/motion";
import { Pause, Play } from "lucide";
import { ref } from "../../lib/dom.ts";
import { createScheduler } from "../../lib/scheduler.ts";
import { icon } from "../../runtime/ui.ts";
import type { DemoMount } from "../../types.ts";
import { attemptsMarkup, detailsMarkup, logMarkup, shellMarkup } from "./markup.ts";
import { steps, timelineMax, trackLeftPct, windowSeconds } from "./steps.ts";

const lastStep = steps.length - 1;

export const mount: DemoMount = (root) => {
  const reduceMotion = prefersReducedMotion();
  let stepIndex = 0;
  let isPlaying = false;
  let hasViewportAutoplayStarted = false;
  let resumeWhenVisibleAgain = false;
  let cancelled = false;
  const scheduler = createScheduler();
  const timer = scheduler.slot();

  root.innerHTML = shellMarkup(reduceMotion);
  const container = ref(root, "container", HTMLDivElement);
  const nowBadge = ref(root, "nowBadge", HTMLSpanElement);
  const rangeBadge = ref(root, "rangeBadge", HTMLSpanElement);
  const band = ref(root, "band", HTMLDivElement);
  const leftEdge = ref(root, "leftEdge", HTMLDivElement);
  const rightEdge = ref(root, "rightEdge", HTMLDivElement);
  const attempts = ref(root, "attempts", HTMLDivElement);
  const details = ref(root, "details", HTMLDivElement);
  const log = ref(root, "log", HTMLUListElement);
  const prev = ref(root, "prev", HTMLButtonElement);
  const next = ref(root, "next", HTMLButtonElement);
  const play = ref(root, "play", HTMLButtonElement);
  const reset = ref(root, "reset", HTMLButtonElement);
  const stepLabel = ref(root, "stepLabel", HTMLSpanElement);

  function schedule() {
    timer.cancel();
    if (!isPlaying) {
      return;
    }
    if (stepIndex >= lastStep) {
      isPlaying = false;
      render();
      return;
    }
    timer.later(() => {
      stepIndex += 1;
      update();
    }, 1250);
  }

  function update() {
    render();
    schedule();
  }

  function render() {
    const step = steps[Math.min(Math.max(stepIndex, 0), lastStep)];
    if (!step) {
      return;
    }
    const wStart = step.now - windowSeconds;
    const wEnd = step.now;
    const vizStart = Math.max(0, wStart);
    const vizEnd = Math.min(timelineMax, wEnd);
    const windowBandLeftPct = trackLeftPct(vizStart);
    const windowBandRightPct = trackLeftPct(vizEnd);
    const windowBandWidthPct = Math.max(0, windowBandRightPct - windowBandLeftPct);

    nowBadge.textContent = `now = ${step.now}s`;
    rangeBadge.textContent = `[${wStart}, ${wEnd}]`;
    band.style.left = `${windowBandLeftPct}%`;
    band.style.width = `${windowBandWidthPct}%`;
    leftEdge.style.left = `${windowBandLeftPct}%`;
    rightEdge.style.left = `${windowBandRightPct}%`;
    attempts.innerHTML = attemptsMarkup(step, stepIndex);
    details.innerHTML = detailsMarkup(step);
    log.innerHTML = logMarkup(step);

    prev.disabled = stepIndex <= 0;
    next.disabled = stepIndex >= lastStep;
    play.innerHTML = isPlaying ? `${icon(Pause, "size-4")}Pause` : `${icon(Play, "size-4")}Play`;
    stepLabel.textContent = `Step ${stepIndex + 1} / ${steps.length}`;
  }

  prev.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = Math.max(0, stepIndex - 1);
    update();
  });
  next.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = Math.min(lastStep, stepIndex + 1);
    update();
  });
  play.addEventListener("click", () => {
    if (isPlaying) {
      resumeWhenVisibleAgain = false;
    }
    isPlaying = !isPlaying;
    update();
  });
  reset.addEventListener("click", () => {
    resumeWhenVisibleAgain = false;
    stepIndex = 0;
    isPlaying = false;
    update();
  });

  function onVisibility(entry: IntersectionObserverEntry) {
    if (!entry.isIntersecting) {
      if (isPlaying) {
        resumeWhenVisibleAgain = true;
      }
      isPlaying = false;
      update();
      return;
    }
    if (!hasViewportAutoplayStarted) {
      hasViewportAutoplayStarted = true;
      if (reduceMotion) {
        return;
      }
      stepIndex = 0;
      isPlaying = true;
      resumeWhenVisibleAgain = false;
      update();
      return;
    }
    if (reduceMotion) {
      return;
    }
    if (resumeWhenVisibleAgain && stepIndex < lastStep) {
      resumeWhenVisibleAgain = false;
      isPlaying = true;
      update();
      return;
    }
    resumeWhenVisibleAgain = false;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      queueMicrotask(() => {
        const entry = entries[0];
        if (!cancelled && entry) {
          onVisibility(entry);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
  );
  observer.observe(container);
  scheduler.add(() => {
    cancelled = true;
    observer.disconnect();
  });
  render();

  return {
    replay() {
      resumeWhenVisibleAgain = false;
      stepIndex = 0;
      isPlaying = false;
      update();
    },
    destroy: scheduler.dispose,
  };
};
