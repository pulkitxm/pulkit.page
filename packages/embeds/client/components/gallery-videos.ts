import { findElement, findElements } from "../lib/dom.ts";
import { isPlainLeftClick } from "../lib/events.ts";

export function setupGalleryVideos(): void {
  const links = findElements(document, "[data-gallery-video]", HTMLAnchorElement);
  if (links.length === 0) {
    return;
  }
  const dialog = document.createElement("dialog");
  dialog.className =
    "fixed inset-0 m-auto max-h-[94dvh] w-[min(96vw,72rem)] max-w-none overflow-visible rounded-lg border-0 bg-[#000] p-0 text-[#fff] backdrop:bg-[#000]/85";
  dialog.setAttribute("aria-label", "Video player");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.setAttribute("aria-label", "Close video");
  close.autofocus = true;
  close.className =
    "absolute top-3 right-3 z-10 cursor-pointer rounded-md border-0 [font:inherit] bg-[#000]/80 px-3 py-2 text-sm text-[#fff]";
  const player = document.createElement("video");
  player.className = "m-0 block max-h-[90dvh] w-full rounded-lg object-contain";
  player.controls = true;
  player.playsInline = true;
  player.preload = "metadata";
  dialog.append(close, player);
  document.body.append(dialog);
  let opener: HTMLAnchorElement | undefined;
  let overflow = "";
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    player.pause();
    player.removeAttribute("src");
    player.load();
    document.documentElement.style.overflow = overflow;
    opener?.focus({ preventScroll: true });
  });
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const pauseAll = (): void => {
    for (const video of findElements(document, "[data-video-preview]", HTMLVideoElement)) {
      video.pause();
      video.style.opacity = "0";
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAll();
    }
  });
  reducedMotion.addEventListener("change", pauseAll);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting && entry.target instanceof HTMLVideoElement) {
        entry.target.pause();
        entry.target.style.opacity = "0";
      }
    }
  });
  for (const link of links) {
    const preview = findElement(link, "[data-video-preview]", HTMLVideoElement);
    if (!preview) {
      continue;
    }
    preview.muted = true;
    let active = false;
    const stop = (): void => {
      active = false;
      preview.pause();
      preview.style.opacity = "0";
    };
    const start = (): void => {
      if (reducedMotion.matches || dialog.open) {
        return;
      }
      active = true;
      preview.src ||= preview.dataset.videoPreview ?? "";
      preview
        .play()
        .then(() => {
          if (active && !document.hidden && !dialog.open && !reducedMotion.matches) {
            preview.style.opacity = "1";
          } else {
            stop();
          }
        })
        .catch(stop);
    };
    observer.observe(preview);
    link.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") {
        start();
      }
    });
    link.addEventListener("pointerleave", stop);
    link.addEventListener("focus", start);
    link.addEventListener("blur", stop);
    link.addEventListener("click", (event) => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      event.preventDefault();
      pauseAll();
      opener = link;
      player.src = link.href;
      player.poster = findElement(link, "img", HTMLImageElement)?.src ?? "";
      dialog.setAttribute("aria-label", link.getAttribute("aria-label") ?? "Video player");
      overflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      dialog.showModal();
      player.play().catch(() => {});
    });
  }
}
