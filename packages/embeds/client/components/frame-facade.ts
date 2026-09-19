import { findElements } from "../lib/dom.ts";
import { createFrame } from "../lib/frames.ts";

function show(root: HTMLElement, name: string): void {
  for (const panel of findElements(root, "[data-frame-panel]", HTMLElement)) {
    panel.hidden = panel.dataset.framePanel !== name;
  }
}

export function setupFrameFacade(root: HTMLElement): void {
  let current: HTMLIFrameElement | undefined;
  const run = (): void => {
    current?.remove();
    show(root, "loading");
    const frame = createFrame({
      src: root.dataset.frameSrc ?? "",
      title: root.dataset.frameTitle,
      className: root.dataset.frameClass,
      sandbox: root.dataset.frameSandbox,
      allow: root.dataset.frameAllow,
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    current = frame;
    frame.addEventListener("load", () => show(root, ""));
    frame.addEventListener("error", () => show(root, "error"));
    root.prepend(frame);
  };
  for (const button of findElements(root, "[data-frame-run]", HTMLElement)) {
    button.addEventListener("click", run);
  }
}
