import { expect, test } from "bun:test";
import { setupExperimentPreviews } from "../client/components/experiment-previews.ts";

class Video extends EventTarget {
  style = { opacity: "0" };
  dataset: Record<string, string> = {};
  className = "";
  muted = false;
  loop = false;
  playsInline = false;
  preload = "";
  paused = true;
  removed = false;
  loads = 0;
  plays = 0;
  attributes = new Map<string, string>();
  get src(): string {
    return this.attributes.get("src") ?? "";
  }
  set src(value: string) {
    this.attributes.set("src", value);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  load(): void {
    this.loads += 1;
  }
  play(): Promise<void> {
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  remove(): void {
    this.removed = true;
  }
}

class Element extends EventTarget {
  video?: Video;
  poster?: Element;
  frame?: Element;
  links: Element[] = [];
  dataset: Record<string, string> = {};
  querySelector(selector: string): Element | Video | null {
    if (selector === "[data-card-media]") {
      return this.frame ?? null;
    }
    if (selector === "[data-preview-poster]") {
      return this.poster ?? this.frame?.poster ?? null;
    }
    return this.video && !this.video.removed ? this.video : null;
  }
  querySelectorAll(): Element[] {
    return this.links;
  }
  contains(link: Element): boolean {
    return this.links.includes(link);
  }
  append(video: Video): void {
    this.video = video;
  }
}

class Preference extends EventTarget {
  matches = false;
  saveData = false;
}

function fixture(
  run: (environment: {
    root: Element;
    links: Element[];
    document: EventTarget & { hidden: boolean; readyState: string };
    window: EventTarget;
    reduced: Preference;
    connection: Preference;
    observer: { observed: Set<Video>; threshold: number; emit(video: Video, ratio: number): void };
    refresh: () => void;
  }) => void,
): void {
  const links = ["one", "two"].map((name) => {
    const link = new Element();
    link.dataset.cardVideo = `/assets/project-previews/mock-${name}/demo.mp4`;
    link.frame = new Element();
    link.frame.poster = new Element();
    return link;
  });
  const root = new Element();
  root.links = links;
  const reduced = new Preference();
  const connection = new Preference();
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    readyState: "interactive",
    createElement: () => new Video(),
  });
  const window = new EventTarget();
  let observer:
    | {
        observed: Set<Video>;
        threshold: number;
        emit(video: Video, ratio: number): void;
      }
    | undefined;
  class Observer {
    observed = new Set<Video>();
    threshold: number;
    constructor(
      private callback: (entries: unknown[]) => void,
      options: { threshold: number },
    ) {
      this.threshold = options.threshold;
      observer = this;
    }
    observe(video: Video): void {
      this.observed.add(video);
    }
    unobserve(video: Video): void {
      this.observed.delete(video);
    }
    disconnect(): void {
      this.observed.clear();
    }
    emit(video: Video, ratio: number): void {
      this.callback([{ target: video, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    }
  }
  const values = {
    document,
    navigator: { connection },
    HTMLElement: Element,
    HTMLAnchorElement: Element,
    HTMLImageElement: Element,
    HTMLVideoElement: Video,
    IntersectionObserver: Observer,
    matchMedia: () => reduced,
    requestIdleCallback: (callback: () => void) => callback(),
    addEventListener: window.addEventListener.bind(window),
  };
  const descriptors = Object.fromEntries(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      Object.defineProperty(globalThis, key, { value, configurable: true });
    }
    const refresh = setupExperimentPreviews(root as unknown as HTMLElement);
    if (!observer) {
      throw new Error("Preview observer missing");
    }
    run({ root, links, document, window, reduced, connection, observer, refresh });
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  }
}

test("visible cards autoplay at half visibility and keep their source when paused offscreen", () => {
  fixture(({ links, observer, document }) => {
    const video = links[0]?.frame?.video;
    if (!video) {
      throw new Error("Card video missing");
    }
    expect(observer.threshold).toBe(0.5);
    expect(document.readyState).toBe("interactive");
    expect(video.src).toBe("");
    observer.emit(video, 0.49);
    expect(video.plays).toBe(0);
    observer.emit(video, 0.5);
    expect(video.muted && video.loop && video.playsInline).toBe(true);
    expect(video.preload).toBe("none");
    expect(video.paused).toBe(false);
    expect(video.src).toContain("mock-one/demo.mp4");
    video.dispatchEvent(new Event("loadeddata"));
    expect(video.style.opacity).toBe("1");
    observer.emit(video, 0.2);
    expect(video.paused).toBe(true);
    expect(video.src).not.toBe("");
    observer.emit(video, 1);
    expect(video.loads).toBe(1);
    expect(video.plays).toBe(2);
  });
});

test("filtering releases removed cards and observes new result cards without hover", () => {
  fixture(({ root, links, observer, refresh }) => {
    const video = links[0]?.frame?.video;
    if (!video) {
      throw new Error("Card video missing");
    }
    observer.emit(video, 1);
    root.links = links.slice(1);
    refresh();
    expect(video.paused).toBe(true);
    expect(video.src).toBe("");
    expect(observer.observed.has(video)).toBe(false);
    root.links = links;
    refresh();
    expect(observer.observed.has(video)).toBe(true);
    observer.emit(video, 1);
    expect(video.paused).toBe(false);
  });
});

test("motion and data-saving preferences release media, while document visibility pauses and resumes", () => {
  fixture(({ links, observer, reduced, connection, document }) => {
    const video = links[0]?.frame?.video;
    if (!video) {
      throw new Error("Card video missing");
    }
    observer.emit(video, 1);
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(video.paused).toBe(true);
    expect(video.src).not.toBe("");
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(video.paused).toBe(false);
    reduced.matches = true;
    reduced.dispatchEvent(new Event("change"));
    expect(video.src).toBe("");
    expect(video.style.opacity).toBe("0");
    reduced.matches = false;
    reduced.dispatchEvent(new Event("change"));
    expect(video.paused).toBe(false);
    connection.saveData = true;
    connection.dispatchEvent(new Event("change"));
    expect(video.src).toBe("");
  });
});

test("failed media falls back to its poster and page lifecycle releases observers and streams", () => {
  fixture(({ links, observer, window, refresh }) => {
    const first = links[0]?.frame?.video;
    const second = links[1]?.frame?.video;
    if (!first || !second) {
      throw new Error("Card videos missing");
    }
    observer.emit(first, 1);
    first.dispatchEvent(new Event("error"));
    expect(first.removed).toBe(true);
    expect(observer.observed.has(first)).toBe(false);
    refresh();
    expect(links[0]?.frame?.video).toBe(first);
    observer.emit(second, 1);
    window.dispatchEvent(new Event("pagehide"));
    expect(observer.observed.size).toBe(0);
    expect(second.paused).toBe(true);
    expect(second.src).toBe("");
    window.dispatchEvent(new Event("pageshow"));
    expect(observer.observed.has(second)).toBe(true);
  });
});
