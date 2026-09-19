import EmblaCarousel from "embla-carousel";

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
