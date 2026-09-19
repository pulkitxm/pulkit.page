import { expectElement } from "../lib/dom.ts";
import { cn } from "./ui.ts";

const thumbSize = 16;

export interface SliderOptions {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  className?: string;
  label?: string;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
}

export interface Slider {
  readonly element: HTMLSpanElement;
  value: number;
}

const keyMoves: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  PageUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageDown: -1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function decimals(step: number): number {
  return (String(step).split(".")[1] ?? "").length;
}

export function createSlider({
  min = 0,
  max = 100,
  step = 1,
  value = min,
  className = "",
  label,
  onValueChange = () => {},
  onValueCommit = () => {},
}: SliderOptions = {}): Slider {
  const root = document.createElement("span");
  root.dir = "ltr";
  root.dataset.orientation = "horizontal";
  root.className = cn("relative flex w-full touch-none select-none items-center", className);
  root.style.setProperty("--radix-slider-thumb-transform", "translateX(-50%)");
  root.innerHTML = `<span data-orientation="horizontal" class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"><span data-orientation="horizontal" class="absolute h-full bg-primary"></span></span><span style="transform: var(--radix-slider-thumb-transform); position: absolute;"><span role="slider" tabindex="0" aria-orientation="horizontal" data-orientation="horizontal" class="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"></span></span>`;
  const track = expectElement(root.firstElementChild, HTMLSpanElement);
  const range = expectElement(track.firstElementChild, HTMLSpanElement);
  const wrapper = expectElement(root.lastElementChild, HTMLSpanElement);
  const thumb = expectElement(wrapper.firstElementChild, HTMLSpanElement);
  thumb.setAttribute("aria-valuemin", String(min));
  thumb.setAttribute("aria-valuemax", String(max));
  if (label) {
    thumb.setAttribute("aria-label", label);
  }
  let current = value;

  function render() {
    const percent = ((current - min) / (max - min)) * 100;
    const half = thumbSize / 2;
    const offset = half - (percent / 50) * half;
    range.style.left = "0%";
    range.style.right = `${100 - percent}%`;
    wrapper.style.left = `calc(${percent}% + ${offset}px)`;
    thumb.setAttribute("aria-valuenow", String(current));
  }

  function set(next: number, commit = false) {
    const snapped = Number((Math.round((next - min) / step) * step + min).toFixed(decimals(step)));
    const clamped = clamp(snapped, min, max);
    const changed = clamped !== current;
    current = clamped;
    render();
    if (changed) {
      onValueChange(current);
    }
    if (commit) {
      onValueCommit(current);
    }
  }

  function fromPointer(event: PointerEvent): number {
    const rect = root.getBoundingClientRect();
    const position = clamp(event.clientX - rect.left, 0, rect.width);
    return min + (position / rect.width) * (max - min);
  }

  root.addEventListener("pointerdown", (event) => {
    root.setPointerCapture(event.pointerId);
    event.preventDefault();
    thumb.focus();
    set(fromPointer(event));
  });
  root.addEventListener("pointermove", (event) => {
    if (root.hasPointerCapture(event.pointerId)) {
      set(fromPointer(event));
    }
  });
  root.addEventListener("pointerup", (event) => {
    if (root.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
      onValueCommit(current);
    }
  });
  thumb.addEventListener("keydown", (event) => {
    const page = event.key === "PageUp" || event.key === "PageDown";
    const multiplier = page || (event.shiftKey && event.key.startsWith("Arrow")) ? 10 : 1;
    const move = keyMoves[event.key];
    if (event.key === "Home") {
      set(min, true);
    } else if (event.key === "End") {
      set(max, true);
    } else if (move === undefined) {
      return;
    } else {
      set(current + move * step * multiplier, true);
    }
    event.preventDefault();
  });
  render();
  return {
    element: root,
    get value() {
      return current;
    },
    set value(next) {
      current = clamp(next, min, max);
      render();
    },
  };
}
