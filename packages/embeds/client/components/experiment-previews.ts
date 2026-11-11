import { findElement } from "../lib/dom.ts";

export function setupExperimentPreviews(root: HTMLElement): () => void {
  const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = globalThis.matchMedia("(hover: hover) and (pointer: fine)");
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData: boolean } })
    .connection;
  let active: HTMLAnchorElement | undefined;
  let video: HTMLVideoElement | undefined;
  let generation = 0;
  let suspended = false;
  const stop = (): void => {
    generation += 1;
    if (active) {
      observer.unobserve(active);
    }
    active = undefined;
    if (!video) {
      return;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    video = undefined;
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.target === active && !entry.isIntersecting)) {
      stop();
    }
  });
  const linkAt = (target: EventTarget | null): HTMLAnchorElement | null =>
    target instanceof Element ? target.closest<HTMLAnchorElement>("[data-card-link]") : null;
  const start = (link: HTMLAnchorElement): void => {
    if (
      suspended ||
      active === link ||
      reduced.matches ||
      !pointer.matches ||
      connection?.saveData ||
      document.hidden ||
      !root.contains(link)
    ) {
      return;
    }
    stop();
    const source = link.dataset.cardVideo;
    const frame = findElement(link, "[data-card-media]", HTMLElement);
    const poster = findElement(link, "[data-preview-poster]", HTMLImageElement);
    if (!source || !frame || !poster) {
      return;
    }
    const attempt = generation;
    const preview = document.createElement("video");
    preview.className =
      "pointer-events-none absolute inset-0 m-0 size-full object-cover opacity-0 transition-opacity duration-200 motion-reduce:transition-none";
    preview.setAttribute("aria-hidden", "true");
    preview.muted = true;
    preview.loop = true;
    preview.playsInline = true;
    preview.preload = "none";
    preview.src = source;
    active = link;
    video = preview;
    frame.append(preview);
    observer.observe(link);
    preview.play().then(
      () => {
        if (attempt === generation && video === preview && root.contains(link)) {
          preview.style.opacity = "1";
        }
      },
      () => {
        if (attempt === generation && video === preview) {
          stop();
        }
      },
    );
  };
  root.addEventListener("pointerover", (event) => {
    const link = linkAt(event.target);
    if (
      link &&
      event.pointerType !== "touch" &&
      !link.contains(event.relatedTarget as Node | null)
    ) {
      start(link);
    }
  });
  root.addEventListener("pointerout", (event) => {
    const link = linkAt(event.target);
    if (
      link === active &&
      !link?.contains(event.relatedTarget as Node | null) &&
      !link?.contains(document.activeElement)
    ) {
      stop();
    }
  });
  root.addEventListener("pointermove", (event) => {
    if (suspended && event.pointerType !== "touch") {
      suspended = false;
      const link = linkAt(event.target);
      if (link) {
        start(link);
      }
    }
  });
  root.addEventListener("focusin", (event) => {
    const link = linkAt(event.target);
    if (link) {
      suspended = false;
      start(link);
    }
  });
  root.addEventListener("focusout", (event) => {
    if (linkAt(event.target) === active && !active?.matches(":hover")) {
      stop();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    }
  });
  globalThis.addEventListener("pagehide", stop);
  reduced.addEventListener("change", stop);
  pointer.addEventListener("change", stop);
  connection?.addEventListener("change", stop);
  return () => {
    suspended = true;
    stop();
  };
}
