for (const root of document.querySelectorAll("[data-document-tabs]")) {
  const tabs = [...root.querySelectorAll("[data-document-tab]")];
  const panels = [...root.querySelectorAll("[data-document-panel]")];
  const indicator = root.querySelector("[data-document-indicator]");
  if (tabs.length === 0) {
    continue;
  }
  const select = (index, focus) => {
    for (const [position, tab] of tabs.entries()) {
      const selected = position === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const [position, panel] of panels.entries()) {
      panel.hidden = position !== index;
    }
    indicator.style.transform = `translateX(${index * 100}%)`;
    if (focus) {
      tabs[index].focus();
    }
  };
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => select(index, false));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? tabs.length - 1 : 1;
      select((index + step) % tabs.length, true);
    });
  }
}
