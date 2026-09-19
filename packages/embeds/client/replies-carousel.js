const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");

for (const root of document.querySelectorAll("[data-replies-carousel]")) {
  const track = root.querySelector("[data-replies-track]");
  if (!track) {
    continue;
  }
  let animation;
  const start = () => {
    animation?.cancel();
    animation = undefined;
    if (reducedMotion.matches) {
      return;
    }
    animation = track.animate([{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }], {
      duration: 45000,
      easing: "linear",
      iterations: Number.POSITIVE_INFINITY,
    });
  };
  root.addEventListener("mouseenter", () => animation?.pause());
  root.addEventListener("mouseleave", () => animation?.play());
  reducedMotion.addEventListener("change", start);
  start();
}
