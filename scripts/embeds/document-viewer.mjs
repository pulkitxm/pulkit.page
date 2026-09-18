import { ExternalLink } from "lucide";
import { lucideSvg } from "./tweet.mjs";

const cardClass =
  "rounded-xl border border-line bg-surface text-fg shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]";
const frameClass = "block h-60 w-full rounded-md border-0 min-[64rem]:h-96";

export function documentCard({ title, documentUrl }, escapeHtml) {
  const heading = `<div class="flex flex-col space-y-1.5 p-6"><div class="flex items-center font-semibold text-xl leading-tight tracking-tight">${escapeHtml(title)}<a class="ml-2 inline-flex items-center text-inherit" href="${escapeHtml(documentUrl)}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-5 shrink-0")}<span class="sr-only">Open document</span></a></div></div>`;
  const body = `<div class="p-6 pt-0"><iframe class="${frameClass}" src="${escapeHtml(documentUrl)}" title="${escapeHtml(title)}" loading="lazy"></iframe></div>`;
  return `<div class="${cardClass}">${heading}${body}</div>`;
}

export function render(props, { escapeHtml }) {
  return `<div class="relative my-8">${documentCard(props, escapeHtml)}</div>`;
}
