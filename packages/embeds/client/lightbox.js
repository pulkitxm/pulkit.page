import PhotoSwipeLightbox from "photoswipe/lightbox";

function styleReady() {
  const link = document.querySelector("[data-lightbox-style]");
  if (!link) {
    return Promise.resolve();
  }
  link.media = "all";
  if (link.sheet) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
  });
}

function setupLightbox() {
  const links = [...document.querySelectorAll("[data-media-zoom]")];
  if (links.length === 0) {
    return;
  }
  const ready = styleReady();
  const dataSource = links.map((link) => ({
    src: link.getAttribute("href"),
    msrc: link.getAttribute("href"),
    width: Number(link.dataset.width) || 0,
    height: Number(link.dataset.height) || 0,
    alt: link.querySelector("img")?.alt ?? "",
    element: link,
  }));
  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import("photoswipe"),
  });
  lightbox.addFilter("itemData", (itemData) => {
    if (!itemData.width || !itemData.height) {
      const image = itemData.element?.querySelector("img");
      itemData.width = image?.naturalWidth || 1200;
      itemData.height = image?.naturalHeight || 800;
    }
    return itemData;
  });
  lightbox.addFilter("thumbEl", (thumbnail, itemData) => itemData.element ?? thumbnail);
  lightbox.init();
  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
        return;
      }
      event.preventDefault();
      ready.then(() => lightbox.loadAndOpen(index));
    });
  });
}

setupLightbox();
