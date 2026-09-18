import EmblaCarousel from "embla-carousel";
import PhotoSwipeLightbox from "photoswipe/lightbox";

function setupLightbox() {
  const links = [...document.querySelectorAll("[data-media-zoom]")];
  if (!links.length) {
    return;
  }
  const dataSource = links.map((link) => ({
    src: link.getAttribute("href"),
    msrc: link.getAttribute("href"),
    width: Number(link.dataset.width),
    height: Number(link.dataset.height),
    alt: link.querySelector("img")?.alt ?? "",
    element: link,
  }));
  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import("photoswipe"),
  });
  lightbox.addFilter("thumbEl", (thumbnail, itemData) => itemData.element ?? thumbnail);
  lightbox.init();
  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
        return;
      }
      event.preventDefault();
      lightbox.loadAndOpen(index);
    });
  });
}

function setupCarousel(root) {
  const viewport = root.querySelector("[data-carousel-viewport]");
  if (!viewport) {
    return;
  }
  const embla = EmblaCarousel(viewport, { align: "start", loop: true });
  const dots = [...root.querySelectorAll("[data-carousel-dot]")];
  const update = () => {
    const selected = embla.selectedScrollSnap();
    dots.forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === selected));
    });
  };
  embla.on("select", update);
  embla.on("reInit", update);
  root
    .querySelector("[data-carousel-previous]")
    ?.addEventListener("click", () => embla.scrollPrev());
  root.querySelector("[data-carousel-next]")?.addEventListener("click", () => embla.scrollNext());
  for (const dot of dots) {
    dot.addEventListener("click", () => embla.scrollTo(Number(dot.dataset.carouselDot)));
  }
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        embla.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        embla.scrollNext();
      }
    },
    true,
  );
  update();
}

for (const root of document.querySelectorAll("[data-carousel]")) {
  setupCarousel(root);
}
setupLightbox();
