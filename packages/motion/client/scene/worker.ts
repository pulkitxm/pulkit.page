import type { WorkerMessage } from "./protocol.ts";
import { createScene, type Scene } from "./renderer.ts";

let scene: Scene | undefined;
const schedule = (callback: (time: number) => void): number =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(callback)
    : Number(setTimeout(() => callback(performance.now()), 16));

addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    scene = createScene(message.canvas, message.setup, schedule);
    return;
  }
  scene?.receive(message);
});
