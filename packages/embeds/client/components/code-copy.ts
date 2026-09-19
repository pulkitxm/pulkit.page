import { attachCopyButton } from "../lib/copy-feedback.ts";

export function setupCodeCopy(button: HTMLElement): void {
  const code = button.closest("[data-code-block]")?.querySelector("code");
  if (!code) {
    return;
  }
  const lines = code.children;
  attachCopyButton(button, () => [...lines].map((line) => line.textContent).join("\n"));
}
