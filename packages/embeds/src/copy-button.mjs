const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const copyIcon = `<svg ${iconAttributes} class="size-3.5" data-copy-idle><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIcon = `<svg ${iconAttributes} class="hidden size-3.5" data-copy-done><path d="M20 6 9 17l-5-5"/></svg>`;

export const codeCopyScript = "/assets/embeds/code-copy.js";

export function copyButton(classes, attribute) {
  return `<button type="button" class="${classes} inline-flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-surface p-0 text-muted transition-colors duration-150 hover:bg-line hover:text-fg" aria-label="Copy to clipboard" ${attribute}>${copyIcon}${checkIcon}</button>`;
}
