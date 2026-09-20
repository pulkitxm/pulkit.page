import { readRecords, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const cellClass = "flex flex-col items-center gap-1 bg-bg px-3 py-5 text-center";
const labelClass = "order-2 text-2xs text-muted uppercase tracking-[0.08em]";
const valueClass = "order-1 m-0 font-bold text-fg text-xl leading-tight";

export const render: EmbedRenderer = (props, { escapeHtml }) => {
  const cells = readRecords(props, "stats", "stat-row")
    .map((stat) => {
      const label = escapeHtml(readString(stat, "label", "stat-row"));
      const value = escapeHtml(readString(stat, "value", "stat-row"));
      return `<div class="${cellClass}"><dt class="${labelClass}">${label}</dt><dd class="${valueClass}">${value}</dd></div>`;
    })
    .join("");
  return `<dl class="my-8 grid grid-cols-2 gap-px border-line border-y bg-line sm:grid-cols-4">${cells}</dl>`;
};
