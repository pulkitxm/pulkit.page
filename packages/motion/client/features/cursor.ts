import { elements, finePointer, lerp, reducedMotion, root } from "../lib/env.ts";
import { onTick } from "../lib/ticker.ts";

const labels: Readonly<Record<string, string>> = {
  view: "View",
  read: "Read",
  drag: "Drag",
  play: "Play",
  talk: "Say hi",
  open: "Open",
  zoom: "Zoom",
};

function burst(x: number, y: number): void {
  const spark = document.createElement("span");
  spark.dataset.spark = "";
  spark.setAttribute("aria-hidden", "true");
  spark.style.left = `${x}px`;
  spark.style.top = `${y}px`;
  spark.append(document.createElement("b"));
  for (let index = 0; index < 8; index++) {
    const ray = document.createElement("i");
    ray.style.setProperty("--angle", `${index * 45 + Math.random() * 16}deg`);
    spark.append(ray);
  }
  document.body.append(spark);
  setTimeout(() => spark.remove(), 700);
}

function labelFor(target: Element | null): { state: string; text: string } {
  const labelled = target?.closest("[data-cursor]");
  const label = labelled instanceof HTMLElement ? labels[labelled.dataset.cursor ?? ""] : undefined;
  if (label) {
    return { state: "label", text: label };
  }
  if (target?.closest("a, button, summary, [role='button'], label, input, select, textarea")) {
    return { state: "hover", text: "" };
  }
  return { state: "", text: "" };
}

export function startCursor(): void {
  const [layer] = elements("[data-cursor-layer]", HTMLElement);
  const [dot] = elements("[data-cursor-dot]", HTMLElement);
  const [ring] = elements("[data-cursor-ring]", HTMLElement);
  const [label] = elements("[data-cursor-label]", HTMLElement);
  if (!(layer && dot && ring && label)) {
    return;
  }
  document.addEventListener("pointerdown", (event) => {
    if (!reducedMotion() && event.pointerType !== "touch") {
      burst(event.clientX, event.clientY);
    }
  });
  if (!finePointer()) {
    return;
  }
  const target = { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2 };
  const trail = { ...target };
  let current = "";
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    target.x = event.clientX;
    target.y = event.clientY;
    root.dataset.cursorActive = "";
    const next = labelFor(event.target instanceof Element ? event.target : null);
    const key = `${next.state}:${next.text}`;
    if (key !== current) {
      current = key;
      layer.dataset.state = next.state;
      if (next.text) {
        label.textContent = next.text;
      }
    }
  });
  document.documentElement.addEventListener("pointerleave", () => {
    delete root.dataset.cursorActive;
  });
  document.addEventListener("pointerdown", () => {
    layer.dataset.pressed = "";
  });
  document.addEventListener("pointerup", () => {
    delete layer.dataset.pressed;
  });
  onTick((_, delta) => {
    const ease = 1 - 0.82 ** (delta / 16);
    trail.x = lerp(trail.x, target.x, ease);
    trail.y = lerp(trail.y, target.y, ease);
    dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    ring.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;
  });
}
