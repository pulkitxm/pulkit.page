for (const carousel of document.querySelectorAll("[data-carousel]")) {
  const track = carousel.querySelector("[data-carousel-track]");
  if (!track) {
    continue;
  }
  const previous = carousel.querySelector("[data-carousel-previous]");
  const next = carousel.querySelector("[data-carousel-next]");
  const status = carousel.querySelector("[data-carousel-status]");
  const total = track.children.length;
  const current = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
  const show = (index) => {
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };
  const update = () => {
    const index = current();
    status.textContent = `${index + 1} / ${total}`;
    previous.disabled = index === 0;
    next.disabled = index === total - 1;
  };
  previous.addEventListener("click", () => show(Math.max(current() - 1, 0)));
  next.addEventListener("click", () => show(Math.min(current() + 1, total - 1)));
  track.addEventListener("scroll", update, { passive: true });
  update();
}
