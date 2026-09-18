for (const root of document.querySelectorAll("[data-youtube-embed]")) {
  const play = root.querySelector("[data-youtube-play]");
  play?.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(root.dataset.videoId)}?autoplay=1&rel=0&modestbranding=1`;
    frame.title = root.dataset.title ?? "";
    frame.className = root.dataset.frameClass ?? "";
    frame.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.loading = "lazy";
    frame.allowFullscreen = true;
    root.replaceChildren(frame);
  });
}
