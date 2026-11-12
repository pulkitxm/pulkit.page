import { afterPageLoad } from "@pulkit/shared/idle";
import { findElement, findElements } from "../lib/dom.ts";

interface Preview {
  link: HTMLAnchorElement;
  source: string;
  visible: boolean;
}

export function setupExperimentPreviews(root: HTMLElement): () => void {
  const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData: boolean } })
    .connection;
  const previews = new Map<HTMLVideoElement, Preview>();
  const initialized = new WeakSet<HTMLVideoElement>();
  const failed = new WeakSet<HTMLAnchorElement>();
  let ready = false;

  const release = (video: HTMLVideoElement): void => {
    video.pause();
    if (video.hasAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
    video.style.opacity = "0";
  };

  const update = (video: HTMLVideoElement, preview: Preview): void => {
    if (reduced.matches || connection?.saveData) {
      release(video);
      return;
    }
    if (!preview.visible || document.hidden || !root.contains(preview.link)) {
      video.pause();
      return;
    }
    if (video.getAttribute("src") !== preview.source) {
      video.src = preview.source;
      video.load();
    }
    video.play().catch(() => undefined);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) {
          continue;
        }
        const preview = previews.get(video);
        if (preview) {
          preview.visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          update(video, preview);
        }
      }
    },
    { threshold: 0.5 },
  );

  const refresh = (): void => {
    if (!ready) {
      return;
    }
    const links = new Set(findElements(root, "[data-card-link]", HTMLAnchorElement));
    for (const [video, preview] of previews) {
      if (!links.has(preview.link)) {
        observer.unobserve(video);
        release(video);
        previews.delete(video);
      }
    }
    for (const link of links) {
      const source = link.dataset.cardVideo;
      const frame = findElement(link, "[data-card-media]", HTMLElement);
      const poster = findElement(link, "[data-preview-poster]", HTMLImageElement);
      if (!source || !frame || !poster || failed.has(link)) {
        continue;
      }
      let video = findElement(frame, "[data-card-preview-video]", HTMLVideoElement);
      if (!video) {
        video = document.createElement("video");
        video.className =
          "pointer-events-none absolute inset-0 m-0 size-full object-cover opacity-0 transition-opacity duration-500 motion-reduce:transition-none";
        video.dataset.cardPreviewVideo = "";
        video.setAttribute("aria-hidden", "true");
        video.loop = true;
        video.playsInline = true;
        video.preload = "none";
        frame.append(video);
      }
      if (previews.has(video)) {
        continue;
      }
      video.muted = true;
      const preview = { link, source, visible: false };
      previews.set(video, preview);
      if (!initialized.has(video)) {
        initialized.add(video);
        video.addEventListener("loadeddata", () => {
          if (previews.has(video) && !reduced.matches && !connection?.saveData) {
            video.style.opacity = "1";
          }
        });
        video.addEventListener("error", () => {
          observer.unobserve(video);
          previews.delete(video);
          failed.add(link);
          release(video);
          video.remove();
        });
      }
      observer.observe(video);
    }
  };

  const updateAll = (): void => {
    for (const [video, preview] of previews) {
      update(video, preview);
    }
  };

  document.addEventListener("visibilitychange", updateAll);
  reduced.addEventListener("change", updateAll);
  connection?.addEventListener("change", updateAll);
  globalThis.addEventListener("pagehide", () => {
    observer.disconnect();
    for (const video of previews.keys()) {
      release(video);
    }
    previews.clear();
  });
  globalThis.addEventListener("pageshow", refresh);
  afterPageLoad(() => {
    ready = true;
    refresh();
  });
  return refresh;
}
