import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from "three";
import { type Cancel, ref } from "../../lib/dom.ts";
import { createScheduler } from "../../lib/scheduler.ts";
import { html } from "../../runtime/ui.ts";
import type { DemoMount } from "../../types.ts";
import { loadAssets } from "./assets.ts";
import { startScene, type Viewport } from "./scene.ts";

export const mount: DemoMount = (root) => {
  root.innerHTML = html`<div class="h-full w-full">
    <div data-ref="wrapper" style="position: relative; width: 100%; height: 100%; overflow: hidden; pointer-events: auto">
      <div data-ref="inner" style="position: absolute; inset: 0"><canvas data-ref="canvas" style="position: absolute; inset: 0; display: block"></canvas></div>
    </div>
  </div>`;
  const wrapper = ref(root, "wrapper", HTMLDivElement);
  const inner = ref(root, "inner", HTMLDivElement);
  const canvas = ref(root, "canvas", HTMLCanvasElement);
  const scheduler = createScheduler();
  const frames = scheduler.slot();
  let destroyed = false;
  let cleanup: Cancel = () => {};

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(Math.max(1, window.devicePixelRatio), 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const camera = new PerspectiveCamera(25, 1, 0.1, 1000);
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);
  const viewport: Viewport = { height: 0, width: 0 };
  const resizeListeners: (() => void)[] = [];

  function resize(width: number, height: number) {
    if (width === 0 || height === 0) {
      return;
    }
    viewport.width = width;
    viewport.height = height;
    renderer.setSize(viewport.width, viewport.height);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    for (const listener of resizeListeners) {
      listener();
    }
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) {
      resize(entry.contentRect.width, entry.contentRect.height);
    }
  });
  resizeObserver.observe(inner);

  loadAssets()
    .then((assets) => {
      if (destroyed) {
        return;
      }
      cleanup = startScene({
        assets,
        renderer,
        camera,
        canvas,
        wrapper,
        viewport,
        frames,
        onResize: (listener) => resizeListeners.push(listener),
      });
    })
    .catch(() => {
      if (destroyed) {
        return;
      }
      resizeObserver.disconnect();
      renderer.dispose();
      root.innerHTML = html`<p class="p-6 text-center text-muted-foreground text-sm" role="alert">
        This demo could not download its 3D assets.
      </p>`;
    });

  scheduler.add(() => {
    destroyed = true;
    resizeObserver.disconnect();
    cleanup();
    renderer.dispose();
  });

  return { destroy: scheduler.dispose };
};
