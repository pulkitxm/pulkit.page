import Lenis from "lenis";
import { reducedMotion, root } from "./env.ts";
import { onTick } from "./ticker.ts";

export interface ScrollState {
  y: number;
  velocity: number;
  progress: number;
  direction: number;
}

type Listener = (state: ScrollState) => void;

const listeners = new Set<Listener>();
const state: ScrollState = { y: 0, velocity: 0, progress: 0, direction: 0 };
let lenis: Lenis | undefined;

function publish(y: number, velocity: number): void {
  const limit = Math.max(1, document.documentElement.scrollHeight - globalThis.innerHeight);
  if (y !== state.y) {
    state.direction = Math.sign(y - state.y);
  }
  state.y = y;
  state.velocity = velocity;
  state.progress = y / limit;
  if (y > 120) {
    root.dataset.scrollDirection = state.direction > 0 ? "down" : "up";
  } else {
    delete root.dataset.scrollDirection;
  }
  for (const listener of listeners) {
    listener(state);
  }
}

export function startScroll(): Lenis | undefined {
  if (reducedMotion()) {
    globalThis.addEventListener("scroll", () => publish(globalThis.scrollY, 0), { passive: true });
  } else {
    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      anchors: { offset: -96 },
      autoRaf: false,
    });
    lenis.on("scroll", (instance: Lenis) => publish(instance.scroll, instance.velocity));
    onTick((time) => lenis?.raf(time));
  }
  publish(globalThis.scrollY, 0);
  return lenis;
}

export function onScroll(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function scrollState(): ScrollState {
  return state;
}

export function pauseScroll(paused: boolean): void {
  if (paused) {
    lenis?.stop();
  } else {
    lenis?.start();
  }
}

export function scrollToTop(): void {
  if (lenis) {
    lenis.scrollTo(0, { duration: 1.6 });
  } else {
    globalThis.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }
}
