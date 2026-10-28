import { Camera, Geometry, Mesh, Program, Renderer, Transform } from "ogl";
import type { SceneMessage, SceneSetup } from "./protocol.ts";
import { fragmentShader, vertexShader } from "./shaders.ts";
import { knot, monogram, sphere, wave } from "./shapes.ts";

type Weights = [number, number, number, number];

const homeStops: readonly { at: number; mix: Weights; x: number }[] = [
  { at: 0, mix: [1, 0, 0, 0], x: 1.55 },
  { at: 0.18, mix: [0, 1, 0, 0], x: 2 },
  { at: 0.42, mix: [0, 0, 1, 0], x: 2.1 },
  { at: 0.7, mix: [0, 0, 0, 1], x: 1.2 },
  { at: 1, mix: [1, 0, 0, 0], x: 2.2 },
];

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stopAt(progress: number): { mix: Weights; x: number } {
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
  return { mix: [1, 0, 0, 0], x: 2.2 };
}

type Schedule = (callback: (time: number) => void) => number;

export interface Scene {
  receive(message: SceneMessage): void;
}

export function createScene(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  setup: SceneSetup,
  schedule: Schedule,
): Scene {
  const home = setup.mode === "home";
  const renderer = new Renderer({
    canvas: canvas as HTMLCanvasElement,
    dpr: setup.pixelRatio,
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 40, near: 0.1, far: 50 });
  camera.position.z = 7.5;
  const scene = new Transform();
  const seeds = new Float32Array(setup.count);
  for (let index = 0; index < setup.count; index++) {
    seeds[index] = Math.random();
  }
  const geometry = new Geometry(gl, {
    position: { size: 3, data: monogram(setup.count) },
    aSphere: { size: 3, data: sphere(setup.count) },
    aKnot: { size: 3, data: knot(setup.count) },
    aWave: { size: 3, data: wave(setup.count) },
    aSeed: { size: 1, data: seeds },
  });
  const uniforms = {
    uMix: { value: home ? [1, 0, 0, 0] : [0, 0, 1, 0] },
    uTime: { value: 0 },
    uSize: { value: setup.width > 1000 ? 2.4 : 2 },
    uPixelRatio: { value: setup.pixelRatio },
    uPointer: { value: [99, 99, 0] },
    uPointerStrength: { value: 0 },
    uPulseOrigin: { value: [0, 0, 0] },
    uPulseAge: { value: -1 },
    uColor: { value: setup.color },
    uOpacity: { value: home ? 0.9 : 0.5 },
  };
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const points = new Mesh(gl, { mode: gl.POINTS, geometry, program });
  points.setParent(scene);
  if (!home) {
    points.scale.set(setup.width > 1000 ? 0.85 : 0.6);
  }
  const state = {
    width: setup.width,
    height: setup.height,
    pointer: [99, 99],
    target: [99, 99],
    active: 0,
    strength: 0,
    progress: 0,
    velocity: 0,
    spin: 0,
    visible: true,
    running: false,
    last: 0,
    offsetX: home ? 1.55 : 2.2,
  };
  const resize = () => {
    renderer.setSize(state.width, state.height);
    camera.perspective({ aspect: state.width / Math.max(1, state.height) });
  };
  resize();
  const toWorld = (x: number, y: number): [number, number] => {
    const halfHeight = Math.tan((40 * Math.PI) / 360) * camera.position.z;
    return [x * halfHeight * (state.width / Math.max(1, state.height)), y * halfHeight];
  };
  const frame = (time: number) => {
    const delta = state.last ? Math.min(64, time - state.last) : 16;
    state.last = time;
    uniforms.uTime.value = time / 1000;
    state.pointer[0] = lerp(state.pointer[0] ?? 0, state.target[0] ?? 0, 0.12);
    state.pointer[1] = lerp(state.pointer[1] ?? 0, state.target[1] ?? 0, 0.12);
    state.strength = lerp(state.strength, state.active, 0.05);
    uniforms.uPointer.value = [state.pointer[0] ?? 0, state.pointer[1] ?? 0, 0];
    uniforms.uPointerStrength.value = state.strength;
    if (uniforms.uPulseAge.value >= 0) {
      uniforms.uPulseAge.value += delta / 1100;
      if (uniforms.uPulseAge.value > 1) {
        uniforms.uPulseAge.value = -1;
      }
    }
    state.spin = lerp(state.spin, state.velocity * 0.0004, 0.08);
    const wide = state.width > 1000;
    if (home) {
      const target = stopAt(state.progress);
      uniforms.uMix.value = uniforms.uMix.value.map((value, slot) =>
        lerp(value, target.mix[slot] ?? 0, 0.08),
      );
      points.position.x = lerp(points.position.x, wide ? target.x : 0, 0.06);
      points.position.y = lerp(points.position.y, wide ? 0 : 1.3 - state.progress * 1.3, 0.06);
      points.rotation.x = lerp(points.rotation.x, state.progress * 1.4 - 0.2, 0.05);
      uniforms.uOpacity.value = lerp(
        uniforms.uOpacity.value,
        state.progress < 0.06 ? 0.9 : 0.4,
        0.05,
      );
    } else {
      points.position.x = wide ? 2.2 : 0.8;
      points.rotation.x = Math.sin(time / 4000) * 0.3;
      uniforms.uOpacity.value = 0.5 * (1 - state.progress);
    }
    points.rotation.y += 0.0016 * delta * 0.06 + state.spin;
    renderer.render({ scene, camera });
    if (state.visible && !setup.still) {
      schedule(frame);
    } else {
      state.running = false;
    }
  };
  const start = () => {
    if (!state.running && state.visible) {
      state.running = true;
      state.last = 0;
      schedule(frame);
    }
  };
  start();
  return {
    receive(message) {
      switch (message.type) {
        case "resize":
          state.width = message.width;
          state.height = message.height;
          resize();
          if (setup.still) {
            schedule(frame);
          }
          break;
        case "pointer":
          state.target = toWorld(message.x, message.y);
          state.active = message.active ? 1 : 0;
          break;
        case "pulse":
          uniforms.uPulseOrigin.value = [...toWorld(message.x, message.y), 0];
          uniforms.uPulseAge.value = 0;
          break;
        case "scroll":
          state.progress = message.progress;
          state.velocity = message.velocity;
          if (setup.still) {
            schedule(frame);
          }
          break;
        case "visible":
          state.visible = message.visible;
          start();
          break;
        case "color":
          uniforms.uColor.value = message.color;
          if (setup.still) {
            schedule(frame);
          }
          break;
      }
    },
  };
}
