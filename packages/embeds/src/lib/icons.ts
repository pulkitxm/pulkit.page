import type { IconNode } from "lucide";

const svgAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const iconAttributes = `${svgAttributes} aria-hidden="true"`;

export const copyIcon = `<svg ${iconAttributes} class="size-3.5" data-copy-idle><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

export const checkIcon = `<svg ${iconAttributes} class="hidden size-3.5" data-copy-done><path d="M20 6 9 17l-5-5"/></svg>`;

export function lucideSvg(icon: IconNode, classes: string): string {
  const children = icon
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .map(([name, value]) => `${name}="${value}"`)
          .join(" ")} />`,
    )
    .join("");
  return `<svg ${svgAttributes} class="${classes}" aria-hidden="true">${children}</svg>`;
}
