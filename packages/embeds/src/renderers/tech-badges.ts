import { readRecords, readString, readStrings } from "../lib/props.ts";
import type { EmbedRenderer, EscapeHtml } from "../types.ts";

const badgeClass =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-transparent bg-surface px-2 py-0.5 font-medium text-fg text-sm";

function badges(technologies: readonly string[], escapeHtml: EscapeHtml): string {
  return technologies
    .map((technology) => `<span class="${badgeClass}">${escapeHtml(technology)}</span>`)
    .join("");
}

export const render: EmbedRenderer = (props, { escapeHtml }) => {
  if (props.groups === undefined) {
    return `<div class="my-6 flex flex-wrap gap-2">${badges(readStrings(props, "technologies", "tech-badges"), escapeHtml)}</div>`;
  }
  const rows = readRecords(props, "groups", "tech-badges")
    .map((group) => {
      const label = escapeHtml(readString(group, "label", "tech-badges"));
      const technologies = badges(readStrings(group, "technologies", "tech-badges"), escapeHtml);
      return `<dt class="m-0 font-medium text-muted text-sm sm:pt-1">${label}</dt><dd class="m-0 flex flex-wrap gap-2">${technologies}</dd>`;
    })
    .join("");
  return `<dl class="my-6 grid gap-x-6 gap-y-2 sm:grid-cols-[7rem_1fr] sm:gap-y-5">${rows}</dl>`;
};
