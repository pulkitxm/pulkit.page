for (const link of document.querySelectorAll("[data-document-frame]")) {
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const frame = document.createElement("iframe");
    frame.src = link.getAttribute("href");
    frame.title = link.dataset.title ?? "";
    frame.className = link.dataset.frameClass ?? "";
    frame.loading = "lazy";
    link.replaceWith(frame);
  });
}
