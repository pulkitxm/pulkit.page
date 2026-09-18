import { ExternalLink, FileText } from "lucide";
import { lucideSvg } from "./tweet.mjs";

const cardClass =
  "rounded-xl border border-line bg-surface text-fg shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]";
const frameClass = "block h-60 w-full rounded-md border-0 min-[64rem]:h-96";
const placeholderClass =
  "flex h-60 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-line border-dashed bg-bg text-muted no-underline transition-colors hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 min-[64rem]:h-96";

export function documentCard({ title, documentUrl }, { assets, escapeHtml }) {
  assets.script("/assets/embeds/document-frame.js");
  const url = escapeHtml(documentUrl);
  const name = escapeHtml(title);
  const heading = `<div class="flex flex-col space-y-1.5 p-6"><div class="flex items-center font-semibold text-xl leading-tight tracking-tight">${name}<a class="ml-2 inline-flex items-center text-inherit" href="${url}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-5 shrink-0")}<span class="sr-only">Open document</span></a></div></div>`;
  const placeholder = `<a class="${placeholderClass}" href="${url}" target="_blank" rel="noopener noreferrer" data-document-frame data-title="${name}" data-frame-class="${frameClass}">${lucideSvg(FileText, "size-6 shrink-0")}<span class="font-medium text-sm">Show ${name}</span></a>`;
  return `<div class="${cardClass}">${heading}<div class="p-6 pt-0">${placeholder}</div></div>`;
}

export function render(props, context) {
  return `<div class="relative my-8">${documentCard(props, context)}</div>`;
}
