export type SceneMode = "home" | "page";

export interface SceneSetup {
  mode: SceneMode;
  width: number;
  height: number;
  pixelRatio: number;
  count: number;
  color: [number, number, number];
  still: boolean;
}

export type SceneMessage =
  | { type: "resize"; width: number; height: number }
  | { type: "pointer"; x: number; y: number; active: boolean }
  | { type: "pulse"; x: number; y: number }
  | { type: "scroll"; progress: number; velocity: number }
  | { type: "visible"; visible: boolean }
  | { type: "color"; color: [number, number, number] };

export type WorkerMessage =
  | { type: "init"; canvas: OffscreenCanvas; setup: SceneSetup }
  | SceneMessage;
