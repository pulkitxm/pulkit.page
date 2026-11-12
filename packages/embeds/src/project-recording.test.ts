import { expect, test } from "bun:test";
import { initProjectRecording } from "../client/components/project-recording.ts";

class Button extends EventTarget {
  hidden = true;
  icon = { hidden: true };
  attributes = new Map<string, string>();
  querySelector() {
    return this.icon;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  click() {
    this.dispatchEvent(new Event("click"));
  }
}

class Video extends EventTarget {
  dataset = { src: "/assets/project-previews/hero-sections--mock/demo.mp4" };
  button = new Button();
  parentElement = { querySelector: () => this.button };
  attributes = new Map<string, string>();
  muted = false;
  loop = false;
  playsInline = false;
  controls = false;
  autoplay = false;
  preload = "";
  paused = true;
  playCalls = 0;
  loadCalls = 0;
  rejectNext = false;
  get src() {
    return this.attributes.get("src") ?? "";
  }
  set src(value: string) {
    this.attributes.set("src", value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  load() {
    this.loadCalls += 1;
  }
  play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectNext) {
      this.rejectNext = false;
      return Promise.reject(new Error("Synthetic autoplay rejection"));
    }
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

async function fixture(
  run: (value: {
    video: Video;
    document: EventTarget & { hidden: boolean };
    events: EventTarget;
    reduced: EventTarget & { matches: boolean };
    connection: EventTarget & { saveData: boolean };
    visible: (ratio: number) => void;
    dispose: () => void;
    observers: () => number;
  }) => void | Promise<void>,
  options: { reduced?: boolean; saveData?: boolean; source?: string } = {},
) {
  const video = new Video();
  video.dataset.src = options.source ?? video.dataset.src;
  const document = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: options.reduced ?? false });
  const connection = Object.assign(new EventTarget(), { saveData: options.saveData ?? false });
  let callback: IntersectionObserverCallback | undefined;
  let observing = false;
  let count = 0;
  class Observer {
    constructor(handler: IntersectionObserverCallback) {
      callback = handler;
      count += 1;
    }
    observe() {
      observing = true;
    }
    disconnect() {
      observing = false;
    }
  }
  const values: Record<string, unknown> = {
    document,
    navigator: { connection },
    matchMedia: () => reduced,
    IntersectionObserver: Observer,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const originals = new Map(
    Object.keys(values).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const dispose = initProjectRecording(video as unknown as HTMLVideoElement);
  try {
    await run({
      video,
      document,
      events,
      reduced,
      connection,
      dispose,
      observers: () => count,
      visible: (ratio) => {
        if (observing) {
          callback?.(
            [
              { target: video, isIntersecting: ratio > 0, intersectionRatio: ratio },
            ] as unknown as IntersectionObserverEntry[],
            {} as IntersectionObserver,
          );
        }
      },
    });
  } finally {
    dispose();
    for (const [name, descriptor] of originals) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
  }
}

test("detail playback loads only at fifty percent visibility and pauses outside the page", () =>
  fixture(async ({ video, visible, document, events }) => {
    expect(video.getAttribute("src")).toBeNull();
    visible(0.49);
    expect(video.playCalls).toBe(0);
    visible(0.5);
    await Promise.resolve();
    expect(video.src).toBe(video.dataset.src);
    expect(video.paused).toBe(false);
    expect([video.muted, video.loop, video.playsInline, video.autoplay]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(video.controls).toBe(false);
    expect(video.button.icon.hidden).toBe(true);
    visible(0.25);
    expect(video.paused).toBe(true);
    visible(1);
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(video.paused).toBe(true);
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(video.paused).toBe(false);
    events.dispatchEvent(new Event("pagehide"));
    expect(video.paused).toBe(true);
    events.dispatchEvent(new Event("pageshow"));
    expect(video.paused).toBe(false);
  }));

test("motion and data preferences require explicit playback without native control chrome", async () => {
  for (const options of [{ reduced: true }, { saveData: true }]) {
    await fixture(async ({ video, visible }) => {
      visible(1);
      expect(video.getAttribute("src")).toBeNull();
      expect(video.paused).toBe(true);
      expect(video.button.icon.hidden).toBe(false);
      video.button.click();
      await Promise.resolve();
      expect(video.paused).toBe(false);
      expect(video.controls).toBe(false);
      expect(video.autoplay).toBe(false);
      expect(video.button.icon.hidden).toBe(true);
      video.button.click();
      expect(video.paused).toBe(true);
      expect(video.button.attributes.get("aria-label")).toBe("Play recording");
      expect(video.button.icon.hidden).toBe(false);
    }, options);
  }
});

test("preference changes and an explicit pause stop automatic resumption", () =>
  fixture(async ({ video, visible, reduced }) => {
    visible(1);
    await Promise.resolve();
    reduced.matches = true;
    reduced.dispatchEvent(new Event("change"));
    expect(video.paused).toBe(true);
    expect(video.button.icon.hidden).toBe(false);
    reduced.matches = false;
    reduced.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(video.paused).toBe(false);
    video.button.click();
    visible(0);
    visible(1);
    expect(video.paused).toBe(true);
    expect(video.button.icon.hidden).toBe(false);
    video.button.click();
    await Promise.resolve();
    expect(video.paused).toBe(false);
  }));

test("blocked autoplay provides a working manual fallback and disposal releases the source", () =>
  fixture(async ({ video, visible, dispose, events }) => {
    video.rejectNext = true;
    visible(1);
    await Promise.resolve();
    expect(video.paused).toBe(true);
    expect(video.button.icon.hidden).toBe(false);
    expect(video.button.attributes.get("aria-label")).toBe("Play recording");
    video.button.click();
    await Promise.resolve();
    expect(video.paused).toBe(false);
    expect(video.button.attributes.get("aria-label")).toBe("Pause recording");
    dispose();
    const calls = video.playCalls;
    expect(video.paused).toBe(true);
    expect(video.getAttribute("src")).toBeNull();
    video.button.click();
    events.dispatchEvent(new Event("pageshow"));
    visible(1);
    expect(video.playCalls).toBe(calls);
    const loads = video.loadCalls;
    dispose();
    expect(video.loadCalls).toBe(loads);
  }));

test("detail playback never loads external or retired recording sources", async () => {
  for (const source of ["https://example.test/demo.mp4", "/assets/old-gallery/demo.mp4"]) {
    await fixture(
      ({ video, visible, observers }) => {
        visible(1);
        expect(observers()).toBe(0);
        expect(video.playCalls).toBe(0);
        expect(video.getAttribute("src")).toBeNull();
      },
      { source },
    );
  }
});

test("switching to Code pauses immediately and returning to Preview resumes eligible playback", () =>
  fixture(async ({ video, visible }) => {
    visible(1);
    await Promise.resolve();
    expect(video.paused).toBe(false);
    video.dispatchEvent(new CustomEvent("project-viewchange", { detail: { view: "code" } }));
    expect(video.paused).toBe(true);
    visible(1);
    expect(video.paused).toBe(true);
    video.dispatchEvent(new CustomEvent("project-viewchange", { detail: { view: "preview" } }));
    await Promise.resolve();
    expect(video.paused).toBe(false);
  }));
