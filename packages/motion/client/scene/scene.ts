import {
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { clamp, elements, lerp, root, wideScreen } from "../lib/env.ts";
import { onVisible } from "../lib/observe.ts";
import { onScroll } from "../lib/scroll.ts";
import { onTick } from "../lib/ticker.ts";
import { fragmentShader, vertexShader } from "./shaders.ts";
import { knot, monogram, sphere, wave } from "./shapes.ts";

type Weights = [number, number, number, number];

const homeStops: readonly { at: number; mix: Weights; x: number }[] = [
  { at: 0, mix: [1, 0, 0, 0], x: 1.55 },
  { at: 0.14, mix: [0, 1, 0, 0], x: 1.9 },
  { at: 0.36, mix: [0, 0, 1, 0], x: -1.9 },
  { at: 0.62, mix: [0, 0, 0, 1], x: 0 },
  { at: 0.84, mix: [0, 1, 0, 0], x: 1.7 },
  { at: 1, mix: [1, 0, 0, 0], x: 2.3 },
];

function weightsAt(progress: number): { mix: Weights; x: number } {
  for (let index = 1; index < homeStops.length; index++) {
    const previous = homeStops[index - 1];
    const next = homeStops[index];
    if (previous && next && progress <= next.at) {
      const local = clamp((progress - previous.at) / (next.at - previous.at), 0, 1);
      const eased = local * local * (3 - 2 * local);
      return {
        mix: previous.mix.map((value, slot) => lerp(value, next.mix[slot] ?? 0, eased)) as Weights,
        x: lerp(previous.x, next.x, eased),
      };
    }
  }
  return { mix: [1, 0, 0, 0], x: 0 };
}

function endFade(progress: number): number {
  return progress > 0.94 ? 0.3 : 0.45;
}

function inkColor(): Color {
  return new Color(getComputedStyle(root).getPropertyValue("--color-fg").trim() || "#292720");
}

export function startScene(): void {
  const [mount] = elements("[data-scene]", HTMLElement);
  if (!mount) {
    return;
  }
  const home = mount.dataset.scene === "hero";
  if (home) {
    mount.style.position = "fixed";
    mount.style.inset = "0";
  }
  const count = wideScreen() ? 14000 : 6000;
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  const canvas = renderer.domElement;
  mount.append(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(monogram(count), 3));
  geometry.setAttribute("aSphere", new BufferAttribute(sphere(count), 3));
  geometry.setAttribute("aKnot", new BufferAttribute(knot(count), 3));
  geometry.setAttribute("aWave", new BufferAttribute(wave(count), 3));
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    seeds[index] = Math.random();
  }
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  const uniforms = {
    uMix: { value: new Vector4(home ? 1 : 0, home ? 0 : 0, home ? 0 : 1, 0) },
    uTime: { value: 0 },
    uSize: { value: wideScreen() ? 2.4 : 2 },
    uPixelRatio: { value: pixelRatio },
    uPointer: { value: new Vector3(99, 99, 0) },
    uPointerStrength: { value: 0 },
    uPulseOrigin: { value: new Vector3() },
    uPulseAge: { value: -1 },
    uColor: { value: inkColor() },
    uOpacity: { value: home ? 0.9 : 0.55 },
  };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  scene.add(points);
  const resize = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(mount);
  new MutationObserver(() => {
    uniforms.uColor.value = inkColor();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    uniforms.uColor.value = inkColor();
  });
  const pointer = { x: 99, y: 99, active: 0 };
  const toWorld = (clientX: number, clientY: number): Vector3 => {
    const box = canvas.getBoundingClientRect();
    const ndc = new Vector3(
      ((clientX - box.left) / box.width) * 2 - 1,
      -((clientY - box.top) / box.height) * 2 + 1,
      0.5,
    );
    ndc.unproject(camera);
    const direction = ndc.sub(camera.position).normalize();
    return camera.position.clone().add(direction.multiplyScalar(-camera.position.z / direction.z));
  };
  document.addEventListener("pointermove", (event) => {
    const world = toWorld(event.clientX, event.clientY);
    pointer.x = world.x;
    pointer.y = world.y;
    pointer.active = 1;
  });
  document.addEventListener("pointerdown", (event) => {
    uniforms.uPulseOrigin.value.copy(toWorld(event.clientX, event.clientY));
    uniforms.uPulseAge.value = 0;
  });
  let visible = true;
  onVisible(mount, (state) => {
    visible = state || home;
  });
  const motion = { progress: 0, offsetX: home ? 1.55 : 1.7, scrollSpin: 0, velocity: 0 };
  onScroll(({ progress, velocity, y }) => {
    motion.progress = home ? progress : clamp(y / Math.max(1, mount.clientHeight), 0, 1);
    motion.velocity = velocity;
  });
  if (!home) {
    points.position.x = wideScreen() ? 2.2 : 0.6;
    points.scale.setScalar(wideScreen() ? 0.85 : 0.6);
  }
  canvas.dataset.ready = "";
  mount.dataset.live = "";
  const smoothed = { x: 99, y: 99, strength: 0 };
  onTick((time, delta) => {
    if (!visible || document.hidden) {
      return;
    }
    uniforms.uTime.value = time / 1000;
    smoothed.x = lerp(smoothed.x, pointer.x, 0.12);
    smoothed.y = lerp(smoothed.y, pointer.y, 0.12);
    smoothed.strength = lerp(smoothed.strength, pointer.active, 0.05);
    uniforms.uPointer.value.set(smoothed.x, smoothed.y, 0);
    uniforms.uPointerStrength.value = smoothed.strength;
    if (uniforms.uPulseAge.value >= 0) {
      uniforms.uPulseAge.value += delta / 1100;
      if (uniforms.uPulseAge.value > 1) {
        uniforms.uPulseAge.value = -1;
      }
    }
    motion.scrollSpin = lerp(motion.scrollSpin, motion.velocity * 0.004, 0.08);
    if (home) {
      const target = weightsAt(motion.progress);
      uniforms.uMix.value.lerp(new Vector4(...target.mix), 0.08);
      const x = wideScreen() ? target.x : target.x * 0.25;
      points.position.x = lerp(points.position.x, x, 0.06);
      points.rotation.y += 0.0016 * delta * 0.06 + motion.scrollSpin;
      points.rotation.x = lerp(points.rotation.x, motion.progress * 1.4 - 0.2, 0.05);
      const fade = motion.progress < 0.08 ? 0.9 : endFade(motion.progress);
      uniforms.uOpacity.value = lerp(uniforms.uOpacity.value, fade, 0.05);
    } else {
      points.rotation.y += 0.0012 * delta * 0.06 + motion.scrollSpin;
      points.rotation.x = Math.sin(time / 4000) * 0.3;
      uniforms.uOpacity.value = 0.55 * (1 - motion.progress);
    }
    renderer.render(scene, camera);
  });
}
