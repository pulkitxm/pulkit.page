import type { EmbedRenderer } from "../types.ts";

export const render: EmbedRenderer = (props, { escapeHtml }) =>
  `<span class="inline-flex items-center gap-1">${escapeHtml(props.text)}<span title="${escapeHtml(props.tip)}" class="inline-flex size-4 cursor-help items-center justify-center rounded-full bg-surface text-[10px] font-bold text-muted">i</span></span>`;
