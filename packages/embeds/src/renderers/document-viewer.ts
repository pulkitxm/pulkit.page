import { ExternalLink } from "lucide";
import { lucideSvg } from "../lib/icons.ts";
import { readString } from "../lib/props.ts";
import type { EmbedContext, EmbedProps, EmbedRenderer } from "../types.ts";

const cardClass =
  "rounded-xl border border-line bg-surface text-fg shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]";
const frameClass = "block h-60 w-full rounded-md border-0 min-[64rem]:h-96";
export function documentCard(props: EmbedProps, { escapeHtml }: EmbedContext): string {
  const url = escapeHtml(readString(props, "documentUrl", "document-viewer"));
  const name = escapeHtml(readString(props, "title", "document-viewer"));
  const heading = `<div class="flex flex-col space-y-1.5 p-6"><div class="flex items-center font-semibold text-xl leading-tight tracking-tight">${name}<a class="ml-2 inline-flex items-center text-inherit" href="${url}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-5 shrink-0")}<span class="sr-only">Open ${name}</span></a></div></div>`;
  const frame = `<iframe class="${frameClass}" src="${url}" title="${name}" loading="lazy"></iframe>`;
  const download = `<a class="mt-3 inline-block text-sm text-muted underline underline-offset-4 hover:text-fg" href="${url}" download>Download ${name} (PDF)</a>`;
  return `<div class="${cardClass}">${heading}<div class="p-6 pt-0">${frame}${download}</div></div>`;
}

export const render: EmbedRenderer = (props, context) =>
  `<div class="relative my-8">${documentCard(props, context)}</div>`;
