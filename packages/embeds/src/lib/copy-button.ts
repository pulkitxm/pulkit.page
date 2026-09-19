import { checkIcon, copyIcon } from "./icons.ts";

export const codeCopyScript = "/assets/embeds/code-copy.js";

export function copyButton(classes: string, attribute: string): string {
  return `<button type="button" class="${classes} inline-flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-surface p-0 text-muted transition-colors duration-150 hover:bg-line hover:text-fg" aria-label="Copy to clipboard" ${attribute}>${copyIcon}${checkIcon}</button>`;
}
