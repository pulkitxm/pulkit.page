import { findElements, requireElement } from "../lib/dom.ts";
import { onArrowKey } from "../lib/events.ts";

export function setupDocumentTabs(root: HTMLElement): void {
  const tabs = findElements(root, "[data-document-tab]", HTMLElement);
  const panels = findElements(root, "[data-document-panel]", HTMLElement);
  if (tabs.length === 0) {
    return;
  }
  const indicator = requireElement(root, "[data-document-indicator]", HTMLElement);
  const select = (index: number, focus: boolean): void => {
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
      tabs[index]?.focus();
    }
  };
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => select(index, false));
    onArrowKey(tab, (direction) => {
      const step = direction < 0 ? tabs.length - 1 : 1;
      select((index + step) % tabs.length, true);
    });
  }
}
