import PhotoSwipeLightbox from "photoswipe/lightbox";
import { findElement, findElements } from "../lib/dom.ts";
import { isPlainLeftClick } from "../lib/events.ts";

const zoomSelector = "[data-media-zoom]";
const fallbackWidth = 1200;
const fallbackHeight = 800;

function styleReady(): Promise<void> {
  const link = findElement(document, "[data-lightbox-style]", HTMLLinkElement);
  if (!link) {
    return Promise.resolve();
  }
  link.media = "all";
  if (link.sheet) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
  });
}

export function setupLightbox(): void {
  const links = findElements(document, zoomSelector, HTMLAnchorElement);
  if (links.length === 0) {
    return;
  }
  const ready = styleReady();
  const dataSource = links.map((link) => ({
    src: link.getAttribute("href") ?? undefined,
    msrc: link.getAttribute("href") ?? undefined,
    width: Number(link.dataset.width) || 0,
    height: Number(link.dataset.height) || 0,
    alt: findElement(link, "img", HTMLImageElement)?.alt ?? "",
    element: link,
  }));
  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import("photoswipe"),
    thumbSelector: zoomSelector,
  });
  lightbox.addFilter("itemData", (itemData) => {
    if (!(itemData.width && itemData.height)) {
      const image = itemData.element?.querySelector("img");
      itemData.width = image?.naturalWidth || fallbackWidth;
      itemData.height = image?.naturalHeight || fallbackHeight;
    }
    return itemData;
  });
  lightbox.init();
  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      event.preventDefault();
      lightbox.options.returnFocus = event.detail === 0;
      ready.then(() => lightbox.loadAndOpen(index));
    });
  });
}
