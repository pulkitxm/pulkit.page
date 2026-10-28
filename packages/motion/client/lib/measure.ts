import { clamp } from "./env.ts";

interface Tracked {
  element: HTMLElement;
  top: number;
  height: number;
}

const tracked = new Set<Tracked>();

function measure(item: Tracked): void {
  const box = item.element.getBoundingClientRect();
  item.top = box.top + globalThis.scrollY;
  item.height = box.height;
}

let scheduled = false;

function remeasure(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const item of tracked) {
      measure(item);
    }
  });
}

new ResizeObserver(remeasure).observe(document.body);

export interface Track {
  progress(scrollY: number, start?: number, end?: number): number;
  readonly top: number;
  readonly height: number;
}

export function track(element: HTMLElement): Track {
  const item: Tracked = { element, top: 0, height: 0 };
  measure(item);
  tracked.add(item);
  return {
    progress(scrollY, start = 1, end = 0) {
      const viewport = globalThis.innerHeight;
      const from = item.top - viewport * start;
      const to = item.top + item.height - viewport * end;
      return clamp((scrollY - from) / Math.max(1, to - from), 0, 1);
    },
    get top() {
      return item.top;
    },
    get height() {
      return item.height;
    },
  };
}
