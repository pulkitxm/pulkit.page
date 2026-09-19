import { requireElement } from "./dom.ts";

const resetDelay = 1500;

export function attachCopyButton(button: HTMLElement, readText: () => string): void {
  const idleLabel = button.getAttribute("aria-label") ?? "";
  const idle = requireElement(button, "[data-copy-idle]", SVGElement);
  const done = requireElement(button, "[data-copy-done]", SVGElement);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = (copied: boolean): void => {
    button.setAttribute("aria-label", copied ? "Copied" : idleLabel);
    idle.classList.toggle("hidden", copied);
    done.classList.toggle("hidden", !copied);
  };
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(readText());
    show(true);
    clearTimeout(timer);
    timer = setTimeout(() => show(false), resetDelay);
  });
}
