import PhotoSwipeLightbox from "photoswipe/lightbox";

function setupLightbox() {
  const links = [...document.querySelectorAll("[data-media-zoom]")];
  if (links.length === 0) {
    return;
  }
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
      lightbox.options.returnFocus = event.detail === 0;
      lightbox.loadAndOpen(index);
    });
  });
}

setupLightbox();
