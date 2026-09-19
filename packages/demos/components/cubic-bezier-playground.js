import { Check, Copy, RotateCw } from "lucide";
import { button, buttonClass, cn, html, icon, refs } from "../runtime/ui.js";

const presets = [
  { name: "linear", p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } },
  { name: "ease", p1: { x: 0.25, y: 0.1 }, p2: { x: 0.25, y: 1.0 } },
  { name: "ease-out", p1: { x: 0, y: 0 }, p2: { x: 0.58, y: 1 } },
  { name: "ease-in", p1: { x: 0.42, y: 0 }, p2: { x: 1, y: 1 } },
  { name: "ease-in-out", p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
  { name: "snappy", p1: { x: 0.16, y: 1 }, p2: { x: 0.3, y: 1 } },
  { name: "bounce", p1: { x: 0.34, y: 1.56 }, p2: { x: 0.64, y: 1 } },
];

const graphSize = 176;
const padding = 32;
const extraSpace = graphSize * 0.5;
const svgSize = graphSize + padding * 2 + extraSpace * 2;
const offsetX = padding + extraSpace;
const offsetY = padding + extraSpace;
const startX = offsetX;
const startY = offsetY + graphSize;
const endX = offsetX + graphSize;
const endY = offsetY;

function cubicBezier(t, p1, p2) {
  const cx = 3 * p1.x;
  const bx = 3 * (p2.x - p1.x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1.y;
  const by = 3 * (p2.y - p1.y) - cy;
  const ay = 1 - cy - by;
  const sampleCurveX = (value) => ((ax * value + bx) * value + cx) * value;
  let t2 = t;
  for (let i = 0; i < 8; i++) {
    const x2 = sampleCurveX(t2) - t;
    if (Math.abs(x2) < 0.001) {
      break;
    }
    const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
    if (Math.abs(d2) < 0.000001) {
      break;
    }
    t2 -= x2 / d2;
  }
  return ((ay * t2 + by) * t2 + cy) * t2;
}

function presetClass(active) {
  return buttonClass({
    className: cn(
      "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700",
    ),
  });
}

const handleClass =
  "cursor-grab stroke-2 stroke-white opacity-75 transition-transform hover:opacity-100 active:cursor-grabbing dark:stroke-neutral-900";
const labelClass = "fill-neutral-400 text-[10px] dark:fill-neutral-500";

export function mount(root) {
  let p1 = { x: 0.25, y: 0.1 };
  let p2 = { x: 0.25, y: 1.0 };
  let isAnimating = false;
  let animationProgress = 0;
  let dragging = null;
  let copied = false;
  let animationFrame = null;
  let copyTimer = null;
  let replayTimer = null;

  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center p-4 sm:p-6">
    <div class="flex h-full w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8 lg:gap-10">
      <div class="flex h-full flex-1 items-center justify-center">
        <svg data-ref="svg" viewBox="0 0 ${svgSize} ${svgSize}" class="h-full max-h-45 w-auto cursor-crosshair touch-none sm:max-h-65 lg:max-h-80" role="img" aria-label="Interactive cubic bezier curve editor">
          <title>Cubic Bezier Curve Editor</title>
          <defs>
            <pattern id="grid" width="${graphSize / 4}" height="${graphSize / 4}" patternUnits="userSpaceOnUse" x="${offsetX}" y="${offsetY}">
              <path d="M ${graphSize / 4} 0 L 0 0 0 ${graphSize / 4}" fill="none" stroke="currentColor" stroke-width="0.5" class="text-neutral-200 dark:text-neutral-800"></path>
            </pattern>
          </defs>
          <rect x="${offsetX}" y="${offsetY}" width="${graphSize}" height="${graphSize}" fill="url(#grid)"></rect>
          <rect x="${offsetX}" y="${offsetY}" width="${graphSize}" height="${graphSize}" fill="none" stroke="currentColor" stroke-width="1" class="text-neutral-300 dark:text-neutral-700"></rect>
          <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" class="text-neutral-300 dark:text-neutral-600"></line>
          <line data-ref="line1" x1="${startX}" y1="${startY}" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"></line>
          <line data-ref="line2" x1="${endX}" y1="${endY}" stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"></line>
          <path data-ref="curve" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"></path>
          <circle cx="${startX}" cy="${startY}" r="5" class="fill-neutral-400 dark:fill-neutral-500"></circle>
          <circle cx="${endX}" cy="${endY}" r="5" class="fill-neutral-400 dark:fill-neutral-500"></circle>
          <circle data-ref="ball" r="6" class="fill-violet-500" style="filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.4)); display: none"></circle>
          <circle data-ref="handle1" data-point="p1" r="10" class="${cn("fill-pink-500", handleClass)}"></circle>
          <circle data-ref="handle2" data-point="p2" r="10" class="${cn("fill-cyan-500", handleClass)}"></circle>
          <text x="${offsetX - 8}" y="${startY + 4}" class="${labelClass}" text-anchor="end">0</text>
          <text x="${endX}" y="${startY + 14}" class="${labelClass}" text-anchor="middle">1</text>
          <text x="${offsetX - 8}" y="${endY + 4}" class="${labelClass}" text-anchor="end">1</text>
        </svg>
      </div>
      <div class="flex h-full max-h-45 w-full shrink-0 flex-col justify-between gap-4 sm:max-h-65 sm:w-auto sm:min-w-65 lg:max-h-80 lg:min-w-70">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            ${presets.map((preset, index) => `<button type="button" data-preset="${index}">${preset.name}</button>`)}
          </div>
          <div class="flex items-center justify-center gap-4 sm:justify-start">
            <div class="flex items-center gap-2">
              <span class="inline-block size-3 rounded-full bg-pink-500 shadow-sm"></span>
              <span data-ref="label1" class="font-mono text-neutral-600 text-xs dark:text-neutral-400"></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block size-3 rounded-full bg-cyan-500 shadow-sm"></span>
              <span data-ref="label2" class="font-mono text-neutral-600 text-xs dark:text-neutral-400"></span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <div class="relative h-12 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
            <div data-ref="box" class="absolute top-1/2 size-6 -translate-y-1/2 rounded bg-violet-500 shadow-lg"></div>
            <div class="absolute inset-y-0 left-2 w-px bg-neutral-300 dark:bg-neutral-600"></div>
            <div class="absolute inset-y-0 right-2 w-px bg-neutral-300 dark:bg-neutral-600"></div>
          </div>
          <div class="flex gap-2">
            ${button({ className: "flex-1", label: "Play", attrs: 'data-ref="play"' })}
            ${button({ variant: "outline", size: "icon", label: icon(RotateCw, "size-4"), attrs: 'data-ref="reset" title="Reset"' })}
          </div>
        </div>
        <div class="flex w-full items-center gap-2">
          <code data-ref="code" class="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-center font-mono text-neutral-700 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"></code>
          ${button({ variant: "outline", size: "icon", label: icon(Copy, "size-4"), attrs: 'data-ref="copy" title="Copy to clipboard"' })}
        </div>
      </div>
    </div>
  </div>`;
  const {
    svg,
    line1,
    line2,
    curve,
    ball,
    handle1,
    handle2,
    label1,
    label2,
    box,
    play,
    reset,
    code,
    copy,
  } = refs(root);
  const presetButtons = [...root.querySelectorAll("[data-preset]")];

  function bezier() {
    return `cubic-bezier(${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`;
  }

  function render() {
    const cp1x = startX + p1.x * graphSize;
    const cp1y = startY - p1.y * graphSize;
    const cp2x = startX + p2.x * graphSize;
    const cp2y = startY - p2.y * graphSize;
    line1.setAttribute("x2", cp1x);
    line1.setAttribute("y2", cp1y);
    line2.setAttribute("x2", cp2x);
    line2.setAttribute("y2", cp2y);
    curve.setAttribute(
      "d",
      `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    );
    handle1.setAttribute("cx", cp1x);
    handle1.setAttribute("cy", cp1y);
    handle2.setAttribute("cx", cp2x);
    handle2.setAttribute("cy", cp2y);
    handle1.style.filter = dragging === "p1" ? "drop-shadow(0 0 8px rgba(236, 72, 153, 0.6))" : "";
    handle2.style.filter = dragging === "p2" ? "drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))" : "";

    const easedProgress = cubicBezier(animationProgress, p1, p2);
    ball.style.display = isAnimating ? "" : "none";
    ball.setAttribute("cx", startX + animationProgress * graphSize);
    ball.setAttribute("cy", startY - easedProgress * graphSize);

    const activePreset = presets.find(
      (preset) =>
        Math.abs(preset.p1.x - p1.x) < 0.01 &&
        Math.abs(preset.p1.y - p1.y) < 0.01 &&
        Math.abs(preset.p2.x - p2.x) < 0.01 &&
        Math.abs(preset.p2.y - p2.y) < 0.01,
    );
    presetButtons.forEach((element, index) => {
      element.className = presetClass(activePreset === presets[index]);
    });

    label1.textContent = `(${p1.x.toFixed(2)}, ${p1.y.toFixed(2)})`;
    label2.textContent = `(${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`;
    box.style.left = `calc(12px + (100% - 48px) * ${easedProgress})`;
    box.style.transition = isAnimating ? "none" : "left 0.1s ease-out";
    play.disabled = isAnimating;
    code.textContent = bezier();
    copy.innerHTML = icon(copied ? Check : Copy, "size-4");
  }

  function stopAnimation() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function playAnimation() {
    stopAnimation();
    isAnimating = true;
    animationProgress = 0;
    render();
    const startTime = performance.now();
    const step = (currentTime) => {
      const t = Math.min((currentTime - startTime) / 1000, 1);
      animationProgress = t;
      if (t < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        isAnimating = false;
        animationFrame = null;
      }
      render();
    };
    animationFrame = requestAnimationFrame(step);
  }

  function resetAnimation() {
    stopAnimation();
    isAnimating = false;
    animationProgress = 0;
    render();
  }

  function getSvgPoint(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / svgSize;
    const graphLeft = (padding + extraSpace) * scale;
    const graphTop = (padding + extraSpace) * scale;
    const graphWidth = graphSize * scale;
    const x = (clientX - rect.left - graphLeft) / graphWidth;
    const y = 1 - (clientY - rect.top - graphTop) / graphWidth;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(-0.5, Math.min(1.5, y)) };
  }

  function moveTo(clientX, clientY) {
    const point = getSvgPoint(clientX, clientY);
    if (dragging === "p1") {
      p1 = point;
    } else {
      p2 = point;
    }
    render();
  }

  const onMouseMove = (event) => {
    if (dragging) {
      moveTo(event.clientX, event.clientY);
    }
  };
  const onTouchMove = (event) => {
    if (dragging && event.touches[0]) {
      moveTo(event.touches[0].clientX, event.touches[0].clientY);
    }
  };
  const onEnd = () => {
    if (dragging) {
      dragging = null;
      render();
    }
  };

  for (const handle of [handle1, handle2]) {
    const start = () => {
      dragging = handle.dataset.point;
      render();
    };
    handle.addEventListener("mousedown", start);
    handle.addEventListener("touchstart", start, { passive: true });
  }
  globalThis.addEventListener("mousemove", onMouseMove);
  globalThis.addEventListener("mouseup", onEnd);
  globalThis.addEventListener("touchmove", onTouchMove);
  globalThis.addEventListener("touchend", onEnd);

  presetButtons.forEach((element, index) => {
    element.addEventListener("click", () => {
      p1 = presets[index].p1;
      p2 = presets[index].p2;
      render();
    });
  });
  play.addEventListener("click", playAnimation);
  reset.addEventListener("click", resetAnimation);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(bezier());
      copied = true;
      render();
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
        render();
      }, 2000);
    } catch {
      copied = false;
    }
  });
  render();

  return {
    replay() {
      resetAnimation();
      clearTimeout(replayTimer);
      replayTimer = setTimeout(playAnimation, 50);
    },
    destroy() {
      stopAnimation();
      clearTimeout(copyTimer);
      clearTimeout(replayTimer);
      globalThis.removeEventListener("mousemove", onMouseMove);
      globalThis.removeEventListener("mouseup", onEnd);
      globalThis.removeEventListener("touchmove", onTouchMove);
      globalThis.removeEventListener("touchend", onEnd);
    },
  };
}
