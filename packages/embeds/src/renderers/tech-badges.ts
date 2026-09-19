import { readList } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const badgeClass =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-transparent bg-surface px-2 py-0.5 font-medium text-fg text-sm";

export const render: EmbedRenderer = (props, { escapeHtml }) => {
  const badges = readList(props, "technologies", "tech-badges")
    .map((technology) => `<span class="${badgeClass}">${escapeHtml(technology)}</span>`)
    .join("");
  return `<div class="my-6 flex flex-wrap gap-2">${badges}</div>`;
};
