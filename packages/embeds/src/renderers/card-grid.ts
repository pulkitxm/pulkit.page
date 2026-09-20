import { optionalNumber, readRecords, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const gridColumns: Readonly<Record<number, string>> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 min-[48rem]:grid-cols-3",
};

const cardClass = "rounded-xl border border-line bg-surface/40 p-4";
const titleClass = "m-0 font-semibold text-base text-fg leading-tight";
const bodyClass = "mt-2 mb-0 text-md text-muted leading-normal";
const eyebrowClass = "m-0 font-medium text-2xs text-muted uppercase tracking-[0.08em]";

export const render: EmbedRenderer = (props, { escapeHtml }) => {
  const columns = optionalNumber(props, "columns", "card-grid") ?? 2;
  const columnClass = gridColumns[columns];
  if (!columnClass) {
    throw new Error(`Unsupported card-grid columns: ${columns}`);
  }
  const cards = readRecords(props, "cards", "card-grid")
    .map((card) => {
      const title = escapeHtml(readString(card, "title", "card-grid"));
      const body = escapeHtml(readString(card, "body", "card-grid"));
      const step = optionalNumber(card, "step", "card-grid");
      const eyebrow =
        step === undefined ? "" : `<p class="${eyebrowClass}">Step ${String(step)}</p>`;
      return `<div class="${cardClass}">${eyebrow}<h3 class="${titleClass}">${title}</h3><p class="${bodyClass}">${body}</p></div>`;
    })
    .join("");
  return `<div class="my-6 grid gap-3 ${columnClass}">${cards}</div>`;
};
