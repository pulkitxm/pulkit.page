import { elements, reducedMotion, root } from "../lib/env.ts";
import type { SceneMessage, SceneMode, SceneSetup } from "./protocol.ts";

function inkColor(): [number, number, number] {
  const value = getComputedStyle(root).getPropertyValue("--color-fg").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1] ?? "292720";
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function pointCount(width: number): number {
  const cores = navigator.hardwareConcurrency || 4;
  const base = width > 1000 ? 12000 : 5000;
  return Math.round(base * (cores <= 4 ? 0.6 : 1));
}

async function connect(
  canvas: HTMLCanvasElement,
  setup: SceneSetup,
): Promise<(message: SceneMessage) => void> {
  if ("transferControlToOffscreen" in canvas) {
    const worker = new Worker("/assets/motion/worker.js", { type: "module" });
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: "init", canvas: offscreen, setup }, [offscreen]);
    return (message) => worker.postMessage(message);
  }
  const { createScene } = await import("./renderer.ts");
  const scene = createScene(canvas, setup, requestAnimationFrame);
  return (message) => scene.receive(message);
}

export async function startScene(): Promise<void> {
  const [mount] = elements("[data-scene]", HTMLElement);
  if (!mount) {
    return;
  }
  const mode: SceneMode = mount.dataset.scene === "home" ? "home" : "page";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  mount.append(canvas);
  const box = mount.getBoundingClientRect();
  const send = await connect(canvas, {
    mode,
    width: box.width,
    height: box.height,
    pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 1.5),
    count: pointCount(box.width),
    color: inkColor(),
    still: reducedMotion(),
  });
  canvas.dataset.ready = "";
  new ResizeObserver(([entry]) => {
    if (entry) {
      send({ type: "resize", width: entry.contentRect.width, height: entry.contentRect.height });
    }
  }).observe(mount);
  new IntersectionObserver(([entry]) => {
    send({ type: "visible", visible: Boolean(entry?.isIntersecting) && !document.hidden });
  }).observe(mount);
  document.addEventListener("visibilitychange", () => {
    send({ type: "visible", visible: !document.hidden });
  });
  const updateColor = () => send({ type: "color", color: inkColor() });
  new MutationObserver(updateColor).observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateColor);
  const local = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    ];
  };
  document.addEventListener(
    "pointermove",
    (event) => {
      const [x, y] = local(event);
      send({ type: "pointer", x, y, active: event.pointerType === "mouse" });
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      const [x, y] = local(event);
      send({ type: "pulse", x, y });
    },
    { passive: true },
  );
  let limit = Math.max(1, document.documentElement.scrollHeight - globalThis.innerHeight);
  new ResizeObserver(() => {
    limit = Math.max(1, document.documentElement.scrollHeight - globalThis.innerHeight);
  }).observe(document.body);
  let last = globalThis.scrollY;
  let queued = false;
  const report = () => {
    queued = false;
    const y = globalThis.scrollY;
    const progress = mode === "home" ? y / limit : Math.min(1, y / Math.max(1, mount.offsetHeight));
    send({ type: "scroll", progress, velocity: y - last });
    last = y;
  };
  globalThis.addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(report);
      }
    },
    { passive: true },
  );
  report();
}
