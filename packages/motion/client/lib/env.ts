export const root = document.documentElement;

export function reducedMotion(): boolean {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function finePointer(): boolean {
  return globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function wideScreen(): boolean {
  return globalThis.matchMedia("(min-width: 64rem)").matches;
}

export function whenActivated(callback: () => void): void {
  if ("prerendering" in document && document.prerendering) {
    document.addEventListener("prerenderingchange", callback, { once: true });
  } else {
    callback();
  }
}

export function afterLoad(callback: () => void): void {
  const idle = () => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(callback, { timeout: 1200 });
    } else {
      setTimeout(callback, 60);
    }
  };
  if (document.readyState === "complete") {
    idle();
  } else {
    globalThis.addEventListener("load", idle, { once: true });
  }
}

export function onFirstInteraction(callback: () => void): void {
  const events = [
    "pointermove",
    "pointerdown",
    "wheel",
    "touchstart",
    "keydown",
    "scroll",
  ] as const;
  let fired = false;
  const fire = () => {
    if (fired) {
      return;
    }
    fired = true;
    for (const name of events) {
      globalThis.removeEventListener(name, fire);
    }
    callback();
  };
  for (const name of events) {
    globalThis.addEventListener(name, fire, { passive: true, once: true });
  }
}

export function elements<T extends Element>(
  selector: string,
  type: { new (): T },
  scope: ParentNode = document,
): T[] {
  return [...scope.querySelectorAll(selector)].filter(
    (element): element is T => element instanceof type,
  );
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
