import { elements } from "../lib/env.ts";
import { pauseScroll } from "../lib/scroll.ts";

export function startMenu(): void {
  const [dialog] = elements("[data-menu]", HTMLDialogElement);
  const [toggle] = elements("[data-menu-toggle]", HTMLButtonElement);
  if (!(dialog && toggle)) {
    return;
  }
  elements("[data-menu-links] a", HTMLElement, dialog).forEach((link, index) => {
    link.style.setProperty("--i", String(index));
  });
  const close = () => {
    if (!dialog.open || dialog.dataset.closing !== undefined) {
      return;
    }
    dialog.dataset.closing = "";
    toggle.setAttribute("aria-expanded", "false");
    const panel = dialog.firstElementChild;
    const finish = () => {
      delete dialog.dataset.closing;
      dialog.close();
      pauseScroll(false);
    };
    if (panel && getComputedStyle(panel).animationName !== "none") {
      panel.addEventListener("animationend", finish, { once: true });
    } else {
      finish();
    }
  };
  toggle.addEventListener("click", () => {
    if (dialog.open) {
      close();
      return;
    }
    toggle.setAttribute("aria-expanded", "true");
    dialog.show();
    pauseScroll(true);
    dialog.querySelector<HTMLElement>("[data-menu-links] a")?.focus({ preventScroll: true });
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      toggle.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog.open) {
      close();
      toggle.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  globalThis.addEventListener("pageshow", () => {
    if (dialog.open) {
      delete dialog.dataset.closing;
      dialog.close();
      toggle.setAttribute("aria-expanded", "false");
      pauseScroll(false);
    }
  });
}
