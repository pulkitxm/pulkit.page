import { isPlainLeftClick } from "../lib/events.ts";
import { createGalleryVideoPlayer, type GalleryVideoPlayer } from "./gallery-video-player.ts";

const videoSelector = "[data-gallery-video]";

function videoLink(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>(videoSelector) : null;
}

export function setupGalleryVideos(): void {
  if (!document.querySelector(videoSelector)) {
    return;
  }
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = globalThis.matchMedia("(hover: hover) and (pointer: fine)");
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData: boolean } })
    .connection;
  let player: GalleryVideoPlayer | undefined;
  let preview: HTMLVideoElement | undefined;
  let active: HTMLAnchorElement | undefined;
  let opening = false;
  let generation = 0;
  const stop = (): void => {
    generation += 1;
    if (active) {
      observer.unobserve(active);
    }
    active = undefined;
    if (preview) {
      preview.pause();
      preview.removeAttribute("src");
      preview.load();
      preview.remove();
    }
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.target === active && !entry.isIntersecting)) {
      stop();
    }
  });
  const start = (link: HTMLAnchorElement): void => {
    if (
      active === link ||
      opening ||
      reducedMotion.matches ||
      !finePointer.matches ||
      connection?.saveData ||
      document.hidden ||
      document.querySelector("dialog[open]")
    ) {
      return;
    }
    stop();
    const attempt = generation;
    const source = link.dataset.videoPreview;
    if (!source) {
      return;
    }
    preview ??= document.createElement("video");
    preview.className =
      "pointer-events-none absolute inset-0 m-0 size-full object-contain opacity-0 transition-opacity duration-200";
    preview.style.opacity = "0";
    preview.setAttribute("aria-hidden", "true");
    preview.muted = true;
    preview.loop = true;
    preview.playsInline = true;
    preview.preload = "none";
    preview.src = source;
    link.append(preview);
    active = link;
    observer.observe(link);
    preview.play().then(
      () => {
        if (attempt === generation && active === link && preview) {
          preview.style.opacity = "1";
        }
      },
      () => {
        if (attempt === generation && active === link) {
          stop();
        }
      },
    );
  };
  document.addEventListener("pointerover", (event) => {
    const link = videoLink(event.target);
    if (
      link &&
      event.pointerType !== "touch" &&
      !link.contains(event.relatedTarget as Node | null)
    ) {
      start(link);
    }
  });
  document.addEventListener("pointerout", (event) => {
    const link = videoLink(event.target);
    if (
      link === active &&
      !link?.contains(event.relatedTarget as Node | null) &&
      !link?.contains(document.activeElement)
    ) {
      stop();
    }
  });
  document.addEventListener("focusin", (event) => {
    const link = videoLink(event.target);
    if (link) {
      start(link);
    }
  });
  document.addEventListener("focusout", (event) => {
    if (videoLink(event.target) === active && !active?.matches(":hover")) {
      stop();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    }
  });
  globalThis.addEventListener("pagehide", stop);
  document.addEventListener("media-viewer-open", stop);
  reducedMotion.addEventListener("change", stop);
  finePointer.addEventListener("change", stop);
  connection?.addEventListener("change", stop);
  document.addEventListener("click", (event) => {
    const link = videoLink(event.target);
    if (!link || !isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    opening = true;
    stop();
    player ??= createGalleryVideoPlayer();
    player.open(link);
    opening = false;
  });
}
