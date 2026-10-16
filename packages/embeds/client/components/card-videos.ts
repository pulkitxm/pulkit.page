function activate(media: HTMLElement, video: HTMLVideoElement, visible: boolean): void {
  const source = media.dataset.demo ?? "";
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
      const media = entry.target;
      const video = media.querySelector("[data-card-video]");
      if (media instanceof HTMLElement && video instanceof HTMLVideoElement) {
        activate(media, video, entry.isIntersecting);
      }
    }
  },
  { rootMargin: "200px" },
);

export function watchCardVideo(media: HTMLElement): void {
  const video = media.querySelector("[data-card-video]");
  if (!(video instanceof HTMLVideoElement) || !media.dataset.demo) {
    return;
  }
  video.muted = true;
  video.addEventListener("loadeddata", () => {
    video.style.opacity = "1";
  });
  video.addEventListener("error", () => {
    video.remove();
  });
  observer.observe(media);
}
