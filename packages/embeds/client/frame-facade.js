function show(root, name) {
  for (const panel of root.querySelectorAll("[data-frame-panel]")) {
    panel.hidden = panel.dataset.framePanel !== name;
  }
}

for (const root of document.querySelectorAll("[data-frame-facade]")) {
  let current;
  const run = () => {
    current?.remove();
    show(root, "loading");
    const frame = document.createElement("iframe");
    current = frame;
    frame.addEventListener("load", () => show(root, ""));
    frame.addEventListener("error", () => show(root, "error"));
    frame.title = root.dataset.frameTitle ?? "";
    frame.className = root.dataset.frameClass ?? "";
    if (root.dataset.frameSandbox !== undefined) {
      frame.setAttribute("sandbox", root.dataset.frameSandbox);
    }
    if (root.dataset.frameAllow !== undefined) {
      frame.setAttribute("allow", root.dataset.frameAllow);
    }
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.src = root.dataset.frameSrc;
    root.prepend(frame);
  };
  for (const button of root.querySelectorAll("[data-frame-run]")) {
    button.addEventListener("click", run);
  }
}
