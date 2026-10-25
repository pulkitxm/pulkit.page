import { afterPageLoad } from "@pulkit/shared/idle";

const sources = new WeakMap<HTMLVideoElement, string>();

function activate(video: HTMLVideoElement, visible: boolean): void {
  const source = sources.get(video) ?? "";
  if (visible) {
    if (video.getAttribute("src") !== source) {
      video.src = source;
      video.load();
    }
    video.play().catch(() => undefined);
    return;
  }
  video.pause();
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (video instanceof HTMLVideoElement) {
        activate(video, entry.isIntersecting && entry.intersectionRatio >= 0.5);
      }
    }
  },
  { threshold: 0.5 },
);

export function watchVisibleVideo(video: HTMLVideoElement, source: string): void {
  sources.set(video, source);
  video.muted = true;
  afterPageLoad(() => {
    if (video.isConnected) {
      observer.observe(video);
    }
  });
}

export function watchCardVideo(media: HTMLElement): void {
  const video = media.querySelector("[data-card-video]");
  if (!(video instanceof HTMLVideoElement) || !media.dataset.demo) {
    return;
  }
  video.addEventListener("loadeddata", () => {
    video.style.opacity = "1";
  });
  video.addEventListener("error", () => {
    video.remove();
  });
  watchVisibleVideo(video, media.dataset.demo);
}
