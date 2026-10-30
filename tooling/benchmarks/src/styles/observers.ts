interface Observations {
  lcp: number | null;
  lcpTarget: string;
  cls: number;
  longTasks: { start: number; duration: number }[];
  events: number[];
  supported: string[];
}

declare global {
  var styleBenchmarkObservations: Observations;
}

export function installObservers(): void {
  const state: Observations = {
    lcp: null,
    lcpTarget: "",
    cls: 0,
    longTasks: [],
    events: [],
    supported: [...PerformanceObserver.supportedEntryTypes],
  };
  globalThis.styleBenchmarkObservations = state;
  let sessionStart = 0;
  let lastShift = 0;
  let sessionValue = 0;
  for (const type of ["largest-contentful-paint", "layout-shift", "longtask", "event"]) {
    if (!state.supported.includes(type)) {
      continue;
    }
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (type === "largest-contentful-paint") {
          state.lcp = entry.startTime;
          const target = entry as PerformanceEntry & { element?: Element };
          state.lcpTarget = target.element?.tagName.toLowerCase() ?? "unknown";
        } else if (type === "layout-shift") {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (shift.hadRecentInput) {
            continue;
          }
          if (entry.startTime - lastShift > 1000 || entry.startTime - sessionStart > 5000) {
            sessionValue = 0;
            sessionStart = entry.startTime;
          }
          sessionValue += shift.value;
          lastShift = entry.startTime;
          state.cls = Math.max(state.cls, sessionValue);
        } else if (type === "longtask") {
          state.longTasks.push({ start: entry.startTime, duration: entry.duration });
        } else if ((entry as PerformanceEntry & { interactionId?: number }).interactionId) {
          state.events.push(entry.duration);
        }
      }
    });
    observer.observe({
      type,
      buffered: true,
      ...(type === "event" ? { durationThreshold: 16 } : {}),
    });
  }
}

export function navigationMetrics() {
  const state = globalThis.styleBenchmarkObservations;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!navigation) {
    throw new Error("Navigation timing is unavailable");
  }
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const now = performance.now();
  const observedBlocking = state.longTasks.reduce(
    (sum, task) =>
      sum +
      Math.max(0, Math.min(task.start + task.duration, now) - Math.max(task.start + 50, fcp ?? 0)),
    0,
  );
  return {
    metrics: {
      ttfbMs: navigation.responseStart,
      responseEndMs: navigation.responseEnd,
      domInteractiveMs: navigation.domInteractive,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      fcpMs: fcp,
      lcpMs: state.lcp,
      cls: state.supported.includes("layout-shift") ? state.cls : null,
      observedBlockingMs: state.supported.includes("longtask") ? observedBlocking : null,
      longTasks: state.supported.includes("longtask") ? state.longTasks.length : null,
      requestCount: resources.length + 1,
      cacheHits: resources.filter(
        (resource) => resource.transferSize === 0 && resource.encodedBodySize > 0,
      ).length,
      transferBytes:
        navigation.transferSize +
        resources.reduce((sum, resource) => sum + resource.transferSize, 0),
      observationWindowMs: now,
    },
    lcpTarget: state.lcpTarget,
    unsupported: ["largest-contentful-paint", "layout-shift", "longtask", "event"].filter(
      (name) => !state.supported.includes(name),
    ),
  };
}

export function clickPaintProbe(): void {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) {
    throw new Error("Theme button is unavailable");
  }
  const target = globalThis as typeof globalThis & { styleBenchmarkClick?: number | null };
  target.styleBenchmarkClick = null;
  button.addEventListener(
    "click",
    () => {
      const started = performance.now();
      const observer = new MutationObserver(() => {
        observer.disconnect();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            target.styleBenchmarkClick = performance.now() - started;
          }),
        );
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    },
    { capture: true, once: true },
  );
}

export function styleStress(): number {
  const root = document.documentElement;
  const previous = root.dataset.theme;
  const started = performance.now();
  for (let index = 0; index < 40; index++) {
    root.dataset.theme = index % 2 === 0 ? "light" : "dark";
    void document.body.offsetHeight;
  }
  const elapsed = performance.now() - started;
  if (previous === undefined) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = previous;
  }
  return elapsed / 40;
}
