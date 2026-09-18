import { buttonClass, html, refs } from "../runtime/ui.js";

const easingConfigs = {
  ease: { color: "#8b5cf6", cubicBezier: [0.25, 0.1, 0.25, 1], label: "ease" },
  easeIn: { color: "#f472b6", cubicBezier: [0.42, 0, 1, 1], label: "ease-in" },
  easeInOut: { color: "#06b6d4", cubicBezier: [0.42, 0, 0.58, 1], label: "ease-in-out" },
  easeOut: { color: "#34d399", cubicBezier: [0, 0, 0.58, 1], label: "ease-out" },
  linear: { color: "#94a3b8", cubicBezier: [0, 0, 1, 1], label: "linear" },
  spring: { color: "#fb923c", cubicBezier: [0.2, 1.1, 0.4, 1], label: "spring" },
};

const easingOrder = ["linear", "easeIn", "easeOut", "easeInOut", "ease", "spring"];
const pathLength = 1;
const animationDuration = 2;
const resetDuration = 0.5;
const size = 200;
const padding = 12;

function getCubicBezierPath([x1, y1, x2, y2]) {
  const graphSize = size - padding * 2;
  const startX = padding;
  const startY = size - padding;
  const endX = size - padding;
  const endY = padding;
  const cp1x = startX + x1 * graphSize;
  const cp1y = startY - y1 * graphSize;
  const cp2x = startX + x2 * graphSize;
  const cp2y = startY - y2 * graphSize;
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

function springValue(time, bounce) {
  const stiffness = 100;
  const mass = 1;
  const omega0 = Math.sqrt(stiffness / mass);
  const criticalDamping = 2 * Math.sqrt(stiffness * mass);
  const damping = criticalDamping * (1 - bounce * 0.9);
  const zeta = damping / criticalDamping;
  if (zeta >= 1) {
    const decay = Math.exp(-omega0 * time);
    return 1 - decay * (1 + omega0 * time);
  }
  const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * omega0 * time);
  return (
    1 -
    decay *
      (Math.cos(omegaD * time) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * time))
  );
}

const settleTime = 1.2;

function getSpringPath(bounce, maxY) {
  const steps = 100;
  const graphWidth = size - padding * 2;
  const graphHeight = size - padding * 2;
  const segments = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = Math.max(0, springValue(t * settleTime, bounce));
    const x = padding + t * graphWidth;
    const py = size - padding - (y / maxY) * graphHeight;
    segments.push(`${i === 0 ? "M" : "L"} ${x} ${py}`);
  }
  return segments.join(" ");
}

function cubicBezierAt(t, p1, p2) {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

function solveCubicBezierX(x, x1, x2) {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = cubicBezierAt(t, x1, x2) - x;
    if (Math.abs(dx) < 1e-6) {
      break;
    }
    const derivative =
      3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(derivative) < 1e-6) {
      break;
    }
    t -= dx / derivative;
    t = Math.max(0, Math.min(1, t));
  }
  return t;
}

function applyEasing(progress, [x1, y1, x2, y2]) {
  return cubicBezierAt(solveCubicBezierX(progress, x1, x2), y1, y2);
}

function applySpringEasing(progress, bounce) {
  return Math.max(0, Math.min(1, springValue(progress * settleTime, bounce)));
}

function legendButtonClass(isHidden) {
  return buttonClass({
    variant: "ghost",
    size: "sm",
    className: `flex items-center gap-1.5 transition-opacity sm:gap-2 ${isHidden ? "opacity-40" : "opacity-100"}`,
  });
}

function legendLabelClass(isHidden) {
  return `font-mono text-xs sm:text-sm ${isHidden ? "text-neutral-400 line-through dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-400"}`;
}

export function mount(root, props = {}) {
  const { spring, allowBounce } = props;
  const activeEasings = easingOrder.filter((easingType) => props[easingType]);
  if (activeEasings.length === 0) {
    activeEasings.push("easeOut");
  }
  const hiddenEasings = new Set();
  const showLegend = activeEasings.length > 1;
  const clipPathId = `graph-clip-${Math.random().toString(36).slice(2)}`;
  let progress = 0;
  let isDragging = false;
  let bounce = 0.45;
  let animationFrame = null;

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center p-4 pb-12 sm:p-6 sm:pb-6">
    <div class="flex h-full w-full max-w-md flex-1 items-center justify-center gap-4 sm:gap-6">
      <div class="flex h-full flex-1 items-center justify-center">
        <svg viewBox="0 0 ${size} ${size}" class="h-full max-h-55 w-auto overflow-visible sm:max-h-80 lg:max-h-95" role="img" aria-label="Easing curve visualization">
          <defs>
            <clipPath id="${clipPathId}">
              <rect x="0" y="${-size * 2}" width="${size * 2}" height="${size * 2 + size - padding - 1}"></rect>
            </clipPath>
          </defs>
          <line data-ref="bounceLine" x1="${padding}" x2="${size - padding}" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" class="text-neutral-400 dark:text-neutral-600"></line>
          <g data-ref="group">
            ${activeEasings.map(
              (easingType) =>
                `<path data-easing="${easingType}" fill="none" stroke="${easingConfigs[easingType].color}" stroke-width="2.5" pathLength="${pathLength}" stroke-dasharray="${pathLength}"><title>${easingConfigs[easingType].label}</title></path>`,
            )}
          </g>
          <line x1="${padding}" y1="${size - padding}" x2="${size - padding}" y2="${size - padding}" stroke="currentColor" stroke-width="1" class="text-neutral-600 dark:text-neutral-400"></line>
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${size - padding}" stroke="currentColor" stroke-width="1" stroke-linecap="round" class="text-neutral-600 dark:text-neutral-400"></line>
        </svg>
      </div>
      <div class="flex h-full max-h-55 shrink-0 flex-col items-center gap-2 py-2 sm:max-h-80 lg:max-h-95">
        <span class="mb-1.5 text-neutral-600 text-xs dark:text-neutral-300">100%</span>
        <div data-ref="slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-label="Animation progress" aria-orientation="vertical" class="relative h-full w-6 cursor-pointer touch-none sm:w-7">
          <div class="absolute left-1/2 h-full w-1 -translate-x-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
          <div data-ref="fill" class="absolute bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-neutral-400 dark:bg-neutral-500"></div>
          <div data-ref="thumb" class="absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-neutral-400 bg-white shadow-sm transition-transform hover:scale-110 sm:size-5 dark:border-neutral-500 dark:bg-neutral-800"></div>
        </div>
        <span class="mt-1.5 text-neutral-600 text-xs dark:text-neutral-300">0%</span>
      </div>
    </div>
    ${
      showLegend
        ? `<div class="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:mt-5 sm:gap-x-5">${activeEasings
            .map(
              (easingType) =>
                `<button type="button" data-legend="${easingType}"><div class="h-2 w-4 rounded-sm transition-opacity sm:h-2.5 sm:w-5" style="background-color: ${easingConfigs[easingType].color}"></div><span></span></button>`,
            )
            .join("")}</div>`
        : ""
    }
    ${
      allowBounce && spring
        ? `<div class="mt-4 flex items-center justify-center gap-3"><label for="bounce-slider" class="text-neutral-600 text-xs sm:text-sm dark:text-neutral-400">Bounce</label><input data-ref="bounceInput" id="bounce-slider" type="range" min="0" max="0.5" step="0.05" value="${bounce}" class="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-neutral-200 sm:w-36 dark:bg-neutral-700 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500" /><span data-ref="bounceValue" class="w-10 text-right font-mono text-neutral-600 text-xs dark:text-neutral-400"></span></div>`
        : ""
    }
  </div>`;
  const { bounceLine, group, slider, fill, thumb, bounceInput, bounceValue } = refs(root);
  const paths = Object.fromEntries(
    [...root.querySelectorAll("[data-easing]")].map((element) => [element.dataset.easing, element]),
  );
  const legendButtons = [...root.querySelectorAll("[data-legend]")];

  function renderShape() {
    const hasBounce = spring && bounce > 0;
    const maxY = hasBounce ? 1 + bounce * 0.5 : 1;
    bounceLine.style.display = hasBounce ? "" : "none";
    const lineY = padding + ((maxY - 1) / maxY) * (size - padding * 2);
    bounceLine.setAttribute("y1", lineY);
    bounceLine.setAttribute("y2", lineY);
    if (hasBounce) {
      group.removeAttribute("clip-path");
    } else {
      group.setAttribute("clip-path", `url(#${clipPathId})`);
    }
    for (const easingType of activeEasings) {
      paths[easingType].setAttribute(
        "d",
        easingType === "spring"
          ? getSpringPath(bounce, maxY)
          : getCubicBezierPath(easingConfigs[easingType].cubicBezier),
      );
    }
    for (const element of legendButtons) {
      const easingType = element.dataset.legend;
      const isHidden = hiddenEasings.has(easingType);
      element.className = legendButtonClass(isHidden);
      const label = element.querySelector("span");
      label.className = legendLabelClass(isHidden);
      label.textContent =
        easingType === "spring" && allowBounce
          ? `spring (${bounce.toFixed(2)} bounce)`
          : easingConfigs[easingType].label;
    }
    if (bounceInput) {
      bounceInput.value = bounce;
      bounceValue.textContent = bounce.toFixed(2);
    }
  }

  function renderProgress() {
    for (const easingType of activeEasings) {
      const easedProgress =
        easingType === "spring"
          ? applySpringEasing(progress, bounce)
          : applyEasing(progress, easingConfigs[easingType].cubicBezier);
      const dashOffset = hiddenEasings.has(easingType)
        ? pathLength
        : pathLength * (1 - easedProgress);
      paths[easingType].setAttribute("stroke-dashoffset", dashOffset);
    }
    slider.setAttribute("aria-valuenow", Math.round(progress * 100));
    fill.style.height = `${progress * 100}%`;
    thumb.style.bottom = `${progress * 100}%`;
  }

  function stopAnimation() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function startAnimation(fromProgress, toProgress, duration, onComplete) {
    stopAnimation();
    const startTime = performance.now();
    const totalDuration = duration * 1000;
    const step = (currentTime) => {
      const t = Math.min((currentTime - startTime) / totalDuration, 1);
      if (t >= 1) {
        progress = toProgress;
        animationFrame = null;
        renderProgress();
        onComplete?.();
        return;
      }
      progress = fromProgress + t * (toProgress - fromProgress);
      renderProgress();
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  }

  function handleSliderInteraction(clientY) {
    const rect = slider.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.bottom - clientY, rect.height));
    progress = y / rect.height;
    renderProgress();
  }

  const onMouseMove = (event) => {
    if (isDragging) {
      handleSliderInteraction(event.clientY);
    }
  };
  const onTouchMove = (event) => {
    if (isDragging && event.touches[0]) {
      handleSliderInteraction(event.touches[0].clientY);
    }
  };
  const onEnd = () => {
    isDragging = false;
  };

  slider.addEventListener("mousedown", (event) => {
    event.preventDefault();
    stopAnimation();
    isDragging = true;
    handleSliderInteraction(event.clientY);
  });
  slider.addEventListener(
    "touchstart",
    (event) => {
      stopAnimation();
      isDragging = true;
      if (event.touches[0]) {
        handleSliderInteraction(event.touches[0].clientY);
      }
    },
    { passive: true },
  );
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onEnd);
  window.addEventListener("touchmove", onTouchMove);
  window.addEventListener("touchend", onEnd);

  for (const element of legendButtons) {
    element.addEventListener("click", () => {
      const easingType = element.dataset.legend;
      if (hiddenEasings.has(easingType)) {
        hiddenEasings.delete(easingType);
      } else {
        hiddenEasings.add(easingType);
      }
      renderShape();
      renderProgress();
    });
  }
  bounceInput?.addEventListener("input", () => {
    bounce = Number(bounceInput.value);
    renderShape();
    renderProgress();
  });

  renderShape();
  renderProgress();
  startAnimation(0, 1, animationDuration);

  return {
    replay() {
      stopAnimation();
      startAnimation(progress, 0, resetDuration, () => {
        startAnimation(0, 1, animationDuration);
      });
    },
    destroy() {
      stopAnimation();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    },
  };
}
