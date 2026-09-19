const badgeClass =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-transparent bg-surface px-2 py-0.5 font-medium text-fg text-sm";

export function render({ technologies }, { escapeHtml }) {
  const badges = technologies
    .map((technology) => `<span class="${badgeClass}">${escapeHtml(technology)}</span>`)
    .join("");
  return `<div class="my-6 flex flex-wrap gap-2">${badges}</div>`;
}
