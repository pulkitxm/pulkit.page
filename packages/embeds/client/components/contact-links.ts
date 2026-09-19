import { attachCopyButton } from "../lib/copy-feedback.ts";

export function setupContactCopy(button: HTMLElement): void {
  attachCopyButton(button, () => button.dataset.contactCopy ?? "");
}
