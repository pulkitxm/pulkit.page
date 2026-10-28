export const root = document.documentElement;

export function reducedMotion(): boolean {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
