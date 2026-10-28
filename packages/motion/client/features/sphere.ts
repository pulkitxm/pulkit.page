import { elements, reducedMotion } from "../lib/env.ts";
import { onVisible } from "../lib/observe.ts";
import { scrollState } from "../lib/scroll.ts";
import { onTick } from "../lib/ticker.ts";

interface Point {
  x: number;
  y: number;
  z: number;
}

function fibonacci(count: number): Point[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * index;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });
}

export function startSphere(): void {
  const [section] = elements("[data-section='skills']", HTMLElement);
  if (!section || reducedMotion()) {
    return;
  }
  const words = elements("dd > span", HTMLElement, section).map((badge) => badge.textContent ?? "");
  if (words.length === 0) {
    return;
  }
  const sphere = document.createElement("div");
  sphere.dataset.sphere = "";
  sphere.dataset.cursor = "drag";
  sphere.setAttribute("aria-hidden", "true");
  const ring = document.createElement("div");
  ring.dataset.sphereRing = "";
  const tags = words.map((word) => {
    const tag = document.createElement("span");
    tag.textContent = word;
    ring.append(tag);
    return tag;
  });
  sphere.append(ring);
  section.append(sphere);
  const points = fibonacci(tags.length);
  const rotation = { x: 0.3, y: 0, vx: 0.0012, vy: 0.0035 };
  let visible = false;
  let dragging = false;
  let last = { x: 0, y: 0 };
  onVisible(sphere, (state) => {
    visible = state;
  });
  sphere.addEventListener("pointerdown", (event) => {
    dragging = true;
    last = { x: event.clientX, y: event.clientY };
    sphere.setPointerCapture(event.pointerId);
  });
  sphere.addEventListener("pointerup", () => {
    dragging = false;
  });
  sphere.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    rotation.vy = (event.clientX - last.x) * 0.0009;
    rotation.vx = -(event.clientY - last.y) * 0.0009;
    last = { x: event.clientX, y: event.clientY };
  });
  onTick((_, delta) => {
    if (!visible) {
      return;
    }
    const size = sphere.clientWidth * 0.42;
    const boost = Math.min(0.02, Math.abs(scrollState().velocity) * 0.0006);
    rotation.y += (rotation.vy + boost) * (delta / 16);
    rotation.x += rotation.vx * (delta / 16);
    if (!dragging) {
      rotation.vy += (0.0035 - rotation.vy) * 0.02;
      rotation.vx += (0.0012 - rotation.vx) * 0.02;
    }
    const sinX = Math.sin(rotation.x);
    const cosX = Math.cos(rotation.x);
    const sinY = Math.sin(rotation.y);
    const cosY = Math.cos(rotation.y);
    tags.forEach((tag, index) => {
      const point = points[index];
      if (!point) {
        return;
      }
      const x1 = point.x * cosY - point.z * sinY;
      const z1 = point.x * sinY + point.z * cosY;
      const y2 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const depth = (z2 + 1) / 2;
      tag.style.transform = `translate3d(calc(${x1 * size}px - 50%), calc(${y2 * size}px - 50%), ${z2 * size}px) scale(${0.6 + depth * 0.7})`;
      tag.style.opacity = (0.18 + depth * 0.82).toFixed(3);
      tag.style.zIndex = String(Math.round(depth * 100));
    });
  });
}
