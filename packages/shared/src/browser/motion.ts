export function reducedMotionQuery(): MediaQueryList {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)");
}

export function prefersReducedMotion(): boolean {
  return reducedMotionQuery().matches;
}
