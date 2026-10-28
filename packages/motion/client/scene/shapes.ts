const glyph =
  "M5 0H35V26C35 33 30 38 23 38H13V31H17C23 31 26 27 26 22C26 17 22 14 17 14C12 14 9 18 9 23V46H0V5Q0 0 5 0Z";
const fold = "M24 0L35 11H26Q24 11 24 9Z";

export type Shape = Float32Array;

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function sphere(count: number, radius = 1.55): Shape {
  const points = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const y = 1 - (index / (count - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * index;
    points.set(
      [Math.cos(theta) * ring * radius, y * radius, Math.sin(theta) * ring * radius],
      index * 3,
    );
  }
  return points;
}

export function knot(count: number, scale = 0.62): Shape {
  const points = new Float32Array(count * 3);
  const next = random(7);
  for (let index = 0; index < count; index++) {
    const t = (index / count) * Math.PI * 2;
    const p = 2;
    const q = 3;
    const r = 2 + Math.cos(q * t);
    const cx = r * Math.cos(p * t);
    const cy = r * Math.sin(p * t);
    const cz = -Math.sin(q * t);
    const angle = next() * Math.PI * 2;
    const tube = 0.42 + next() * 0.08;
    points.set(
      [
        (cx + Math.cos(angle) * tube * Math.cos(p * t)) * scale,
        (cy + Math.cos(angle) * tube * Math.sin(p * t)) * scale,
        (cz + Math.sin(angle) * tube) * scale,
      ],
      index * 3,
    );
  }
  return points;
}

export function wave(count: number): Shape {
  const points = new Float32Array(count * 3);
  const side = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < count; index++) {
    const u = (index % side) / side - 0.5;
    const v = Math.floor(index / side) / side - 0.5;
    const x = u * 7;
    const z = v * 7;
    points.set([x, Math.sin(x * 1.3) * 0.35 + Math.cos(z * 1.7) * 0.3 - 0.4, z], index * 3);
  }
  return points;
}

export function monogram(count: number): Shape {
  const size = 160;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const points = new Float32Array(count * 3);
  if (!context) {
    return sphere(count);
  }
  context.translate(size / 2 - 17.5 * 3, size / 2 - 23 * 3);
  context.scale(3, 3);
  context.fill(new Path2D(glyph));
  context.fill(new Path2D(fold));
  const pixels = context.getImageData(0, 0, size, size).data;
  const filled: number[] = [];
  for (let index = 0; index < size * size; index++) {
    if ((pixels[index * 4 + 3] ?? 0) > 128) {
      filled.push(index);
    }
  }
  const next = random(11);
  for (let index = 0; index < count; index++) {
    const pixel = filled[Math.floor(next() * filled.length)] ?? 0;
    const x = ((pixel % size) / size - 0.5) * 3.6;
    const y = -(Math.floor(pixel / size) / size - 0.5) * 3.6;
    points.set(
      [x + (next() - 0.5) * 0.02, y + (next() - 0.5) * 0.02, (next() - 0.5) * 0.45],
      index * 3,
    );
  }
  return points;
}
