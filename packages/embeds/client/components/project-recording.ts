export function initProjectRecording(video: HTMLVideoElement): () => void {
  const source = video.dataset.src ?? "";
  if (!/^\/assets\/project-previews\/[a-z0-9-]+\/demo\.mp4$/.test(source)) {
    return () => undefined;
  }
  const button = video.parentElement?.querySelector<HTMLButtonElement>("[data-project-playback]");
  const icon = button?.querySelector<HTMLElement>("[data-project-playback-icon]");
  const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData: boolean } })
    .connection;
  let visible = false;
  let inPreview = true;
  let userPaused = false;
  let manual = false;
  let blocked = false;
  let disposed = false;
  let generation = 0;
  const needsGesture = (): boolean => reduced.matches || Boolean(connection?.saveData);
  const update = (): void => {
    if (button) {
      button.hidden = false;
      button.setAttribute("aria-label", video.paused ? "Play recording" : "Pause recording");
    }
    if (icon) {
      icon.hidden = !(video.paused && (userPaused || blocked || needsGesture()));
    }
  };
  const pause = (): void => {
    generation += 1;
    video.pause();
    update();
  };
  const play = (): void => {
    if (disposed || !inPreview || document.hidden) {
      return;
    }
    const attempt = ++generation;
    video.autoplay = !needsGesture();
    if (video.getAttribute("src") !== source) {
      video.src = source;
      video.load();
    }
    video.play().then(
      () => {
        if (attempt === generation && !disposed) {
          blocked = false;
          update();
        }
      },
      () => {
        if (attempt === generation && !disposed) {
          blocked = true;
          video.autoplay = false;
          update();
        }
      },
    );
  };
  const sync = (): void => {
    if (
      !disposed &&
      inPreview &&
      visible &&
      !document.hidden &&
      !userPaused &&
      (manual || !needsGesture())
    ) {
      play();
    } else {
      video.autoplay = false;
      pause();
    }
  };
  const preferencesChanged = (): void => {
    manual = false;
    sync();
  };
  const viewChanged = (event: Event): void => {
    const view = (event as CustomEvent<{ view?: string }>).detail?.view;
    if (view === "preview" || view === "code") {
      inPreview = view === "preview";
      sync();
    }
  };
  const toggle = (): void => {
    if (video.paused) {
      userPaused = false;
      manual = true;
      play();
    } else {
      userPaused = true;
      manual = false;
      pause();
    }
  };
  const failed = (): void => {
    blocked = true;
    manual = false;
    video.autoplay = false;
    pause();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === video) {
          visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          sync();
        }
      }
    },
    { threshold: 0.5 },
  );
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.controls = false;
  video.preload = "none";
  button?.addEventListener("click", toggle);
  video.addEventListener("play", update);
  video.addEventListener("pause", update);
  video.addEventListener("error", failed);
  video.addEventListener("project-viewchange", viewChanged);
  document.addEventListener("visibilitychange", sync);
  globalThis.addEventListener("pagehide", pause);
  globalThis.addEventListener("pageshow", sync);
  reduced.addEventListener("change", preferencesChanged);
  connection?.addEventListener("change", preferencesChanged);
  observer.observe(video);
  update();
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    observer.disconnect();
    button?.removeEventListener("click", toggle);
    video.removeEventListener("play", update);
    video.removeEventListener("pause", update);
    video.removeEventListener("error", failed);
    video.removeEventListener("project-viewchange", viewChanged);
    document.removeEventListener("visibilitychange", sync);
    globalThis.removeEventListener("pagehide", pause);
    globalThis.removeEventListener("pageshow", sync);
    reduced.removeEventListener("change", preferencesChanged);
    connection?.removeEventListener("change", preferencesChanged);
    pause();
    video.removeAttribute("src");
    video.load();
  };
}
