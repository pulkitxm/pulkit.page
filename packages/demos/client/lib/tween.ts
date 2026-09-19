import type { Slot } from "./scheduler.ts";

export interface Tween {
  duration: number;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
}

export function tween(slot: Slot, { duration, onUpdate, onComplete }: Tween): void {
  const startTime = performance.now();
  const step = (time: number) => {
    const progress = Math.min((time - startTime) / duration, 1);
    if (progress < 1) {
      slot.frame(step);
    }
    onUpdate(progress);
    if (progress >= 1) {
      onComplete?.();
    }
  };
  slot.frame(step);
}
