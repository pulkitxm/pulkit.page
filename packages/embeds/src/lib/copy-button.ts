import { checkIcon, copyIcon } from "./icons.ts";

export const codeCopyScript = "/assets/embeds/code-copy.js";

export function copyButton(classes: string, attribute: string): string {
  return `<button type="button" class="${classes} inline-flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-surface p-0 text-muted transition-[color,background-color,scale] duration-150 ease-out hover:bg-line hover:text-fg active:scale-90" aria-label="Copy to clipboard" ${attribute}>${copyIcon}${checkIcon}</button>`;
}
