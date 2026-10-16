import { findElement, findElements } from "../lib/dom.ts";
import { setupFileExplorer } from "./file-explorer.ts";

type View = "preview" | "code";

export function setupProjectView(root: HTMLElement): void {
  const buttons = findElements(root, "[data-project-view]", HTMLButtonElement);
  const preview = findElement(root, '[data-project-panel="preview"]', HTMLElement);
  const code = findElement(root, '[data-project-panel="code"]', HTMLElement);
  const project = root.dataset.projectPath ?? "";
  if (!(preview && code)) {
    return;
  }
  let explorer = false;
  const show = (view: View): void => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.projectView === view));
    }
    preview.hidden = view === "code";
    code.hidden = view !== "code";
    const video = preview.querySelector("video");
    if (view === "code") {
      video?.pause();
      if (!explorer) {
        explorer = true;
        setupFileExplorer(code, project);
      }
    }
    const url = new URL(globalThis.location.href);
    if (view === "code") {
      url.searchParams.set("view", "code");
    } else {
      url.searchParams.delete("view");
    }
    globalThis.history.replaceState(globalThis.history.state, "", url);
  };
  for (const button of buttons) {
    button.addEventListener("click", () =>
      show(button.dataset.projectView === "code" ? "code" : "preview"),
    );
  }
  if (new URLSearchParams(globalThis.location.search).get("view") === "code") {
    show("code");
  }
}
