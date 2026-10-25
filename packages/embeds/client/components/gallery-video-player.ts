import { findElement } from "../lib/dom.ts";

export interface GalleryVideoPlayer {
  open(link: HTMLAnchorElement): void;
}

export function createGalleryVideoPlayer(): GalleryVideoPlayer {
  const dialog = document.createElement("dialog");
  dialog.className =
    "fixed inset-0 m-auto max-h-[94dvh] w-[min(96vw,72rem)] max-w-none overflow-hidden rounded-xl border border-[#fff]/15 bg-[#111] p-0 text-[#fff] shadow-xl backdrop:bg-[#000]/85";
  const header = document.createElement("header");
  header.className = "flex min-h-16 items-center justify-between gap-4 px-4 py-3";
  const title = document.createElement("span");
  title.className = "min-w-0 truncate text-sm";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close ×";
  close.setAttribute("aria-label", "Close video");
  close.autofocus = true;
  close.className =
    "shrink-0 cursor-pointer rounded-full border border-[#fff]/25 bg-[#fff]/10 px-3 py-1.5 text-sm text-[#fff] [font:inherit] hover:bg-[#fff]/20 focus-visible:outline-2 focus-visible:outline-offset-2";
  const player = document.createElement("video");
  player.className = "m-0 block max-h-[calc(94dvh-4rem)] w-full bg-[#000] object-contain";
  player.controls = true;
  player.playsInline = true;
  player.preload = "none";
  const status = document.createElement("p");
  status.className = "m-0 px-4 py-3 text-sm";
  status.setAttribute("role", "status");
  const fallback = document.createElement("a");
  fallback.className = "text-inherit underline";
  fallback.textContent = "Open video directly";
  fallback.hidden = true;
  header.append(title, close);
  dialog.append(header, player, status);
  document.body.append(dialog);
  let opener: HTMLAnchorElement | undefined;
  let overflow = "";
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    ) {
      dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    player.pause();
    player.removeAttribute("src");
    player.removeAttribute("poster");
    player.load();
    document.documentElement.style.overflow = overflow;
    opener?.focus({ preventScroll: true });
  });
  player.addEventListener("loadeddata", () => {
    status.hidden = true;
  });
  player.addEventListener("error", () => {
    if (dialog.open) {
      status.replaceChildren(document.createTextNode("This video could not load. "), fallback);
      fallback.hidden = false;
      status.hidden = false;
    }
  });
  return {
    open(link) {
      opener = link;
      const poster = findElement(link, "[data-gallery-image]", HTMLImageElement);
      title.textContent = poster?.alt || "Video";
      dialog.setAttribute("aria-label", title.textContent);
      status.replaceChildren(document.createTextNode("Loading video… "), fallback);
      status.hidden = false;
      fallback.hidden = true;
      fallback.href = link.href;
      player.poster = poster?.currentSrc || poster?.src || "";
      player.src = link.href;
      overflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      dialog.showModal();
      player.play().catch(() => {});
    },
  };
}
