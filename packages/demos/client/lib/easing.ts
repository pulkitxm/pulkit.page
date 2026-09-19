export type CubicBezier = readonly [x1: number, y1: number, x2: number, y2: number];

function bezierAt(t: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

function solveBezierX(x: number, x1: number, x2: number): number {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = bezierAt(t, x1, x2) - x;
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

export function cubicBezierEase(progress: number, [x1, y1, x2, y2]: CubicBezier): number {
  return bezierAt(solveBezierX(progress, x1, x2), y1, y2);
}
